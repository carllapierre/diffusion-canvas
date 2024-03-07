from fastapi import Response, Request
from modal import Image, Stub, gpu, web_endpoint, build, enter

inference_image = Image.debian_slim().pip_install(
    "Pillow~=10.1.0",
    "diffusers~=0.24.0",
    "transformers~=4.35.2", 
    "accelerate~=0.25", 
    "safetensors~=0.4.1",  
)

stub = Stub("stable-diffusion-xl-turbo", image=inference_image)

with inference_image.imports():
    import torch
    from diffusers import AutoencoderKL, AutoPipelineForImage2Image
    from diffusers.utils import load_image
    from huggingface_hub import snapshot_download
    from PIL import Image as PILImage
    from io import BytesIO
    import base64

@stub.cls(gpu=gpu.T4(), container_idle_timeout=240)
class Model:
    @build()
    def download_models(self):

        ignore = [
            "*.bin",
            "*.onnx_data",
            "*/diffusion_pytorch_model.safetensors",
        ]

        snapshot_download("stabilityai/sdxl-turbo", ignore_patterns=ignore)
        snapshot_download("madebyollin/sdxl-vae-fp16-fix", ignore_patterns=ignore)

    @enter()
    def enter(self):
        self.pipe = AutoPipelineForImage2Image.from_pretrained(
            "stabilityai/sdxl-turbo",
            torch_dtype=torch.float16,
            variant="fp16",
            device_map="auto",
            vae=AutoencoderKL.from_pretrained(
                "madebyollin/sdxl-vae-fp16-fix",
                torch_dtype=torch.float16,
                device_map="auto",
            ),
        )

    @web_endpoint(method="POST")
    async def inference(self, request: Request):
        data = await request.json()
        
        image = data.get("image")
        num_iterations = data.get("num_iterations")
        prompt = data.get("prompt")

        img_data_in = base64.b64decode(image.split(",")[-1])

        byte_stream = BytesIO(img_data_in)
        pil_image = PILImage.open(byte_stream)
        init_image = load_image(pil_image).resize((512, 512))

        num_inference_steps = int(num_iterations)
        strength = 0.999 if num_iterations == 2 else 0.75
        assert num_inference_steps * strength >= 1

        output = self.pipe(
            prompt,
            image=init_image,
            num_inference_steps=num_inference_steps,
            strength=strength,
            guidance_scale=0.0,
            seed=42,
        ).images[0]

        byte_stream = BytesIO()
        output.save(byte_stream, format="jpeg")
        img_data_out = byte_stream.getvalue()

        return Response(content=img_data_out, media_type="image/jpeg")