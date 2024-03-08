from fastapi import Request
from fastapi.responses import FileResponse
from modal import Image, Stub, gpu, web_endpoint, build, enter, method

inference_image = Image.debian_slim().apt_install(
        "git"
    ).run_commands(
        "cd /root && pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu121",
        "cd /root && git clone https://github.com/VAST-AI-Research/TripoSR.git && cd TripoSR && pip install -r requirements.txt",
        "cd /root && ls",
    )

stub = Stub("tripo-sr-model", image=inference_image)

with inference_image.imports():
    import os
    import numpy as np
    import rembg
    import torch
    from PIL import Image as PILImage
    import base64
    from io import BytesIO
    import sys
    from huggingface_hub import snapshot_download
    sys.path.append('/root/TripoSR') 
    from tsr.system import TSR
    from tsr.utils import remove_background, resize_foreground

@stub.cls(gpu=gpu.A10G(), container_idle_timeout=240)
class Model:
    @build()
    def download_models(self):
        snapshot_download("stabilityai/TripoSR")
    
    @enter()
    def enter(self):
        self.model = TSR.from_pretrained(
            "stabilityai/TripoSR",
            config_name="config.yaml",
            weight_name="model.ckpt",
        )
        self.model.renderer.set_chunk_size(8192)
        self.model.to("cuda:0")

    @web_endpoint(method="POST")
    async def inference(self, request: Request):
        data = await request.json()
        
        image_data = data.get("image")
        do_remove_background = data.get("remove_background", True)
        foreground_ratio = data.get("foreground_ratio", 0.85)
        
        img_data_in = base64.b64decode(image_data.split(",")[-1])
        byte_stream = BytesIO(img_data_in)
        input_image = PILImage.open(byte_stream)

        output_dir = "/root/TripoSR/output"

        print('Processing image...')
        if do_remove_background == False:
            rembg_session = None
        else:
            rembg_session = rembg.new_session()

        if do_remove_background == False:
            image = np.array(input_image.convert("RGB"))
        else:
            image = remove_background(input_image, rembg_session)
            image = resize_foreground(image, foreground_ratio)
            image = np.array(image).astype(np.float32) / 255.0
            image = image[:, :, :3] * image[:, :, 3:4] + (1 - image[:, :, 3:4]) * 0.5
            image = PILImage.fromarray((image * 255.0).astype(np.uint8))
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
            image.save(os.path.join(output_dir, f"input.png"))


        print('Running model...')
        with torch.no_grad():
            scene_codes = self.model([image], device='cuda:0')

        print('Exporting mesh...')
        meshes = self.model.extract_mesh(scene_codes)
        meshes[0].export(os.path.join(output_dir, f"mesh.obj"))

        return FileResponse(path=os.path.join(output_dir, f"mesh.obj"), media_type='application/octet-stream', filename='mesh.obj')