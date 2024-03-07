import React, { useRef, useState, useEffect } from 'react';
import Button from '@material-ui/core/Button';
import Slider from '@material-ui/core/Slider';
import confetti from 'canvas-confetti';
import './App.css'; 
import CrossFade from 'react-crossfade-image';
import Mesh from './Mesh';


const colors = ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#BABAFF', '#FFBAF4', '#FFBAB3', '#D3D3D3'];
const panel = { border: '3px solid #ddd', borderRadius: '10px', backgroundColor: '#fff'};
const main = 'rgb(63 53 75)';
const size = 512;
const refreshRate = 600;
const sdxltEndpoint = process.env.REACT_APP_SDXLT_ENDPOINT;
const tripoEndpoint = process.env.REACT_APP_TRIPO_ENDPOINT;

const ColorPicker = ({ setColor, selectedColor }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
      {colors.map((color) => (
        <div
          	key={color}
          	onClick={() => setColor(color)}
          	style={{
				backgroundColor: color,
				width: '40px',
				height: '40px',
				borderRadius: '50%',
				cursor: 'pointer',
				boxShadow: color === selectedColor ? 'inset 0 0 0 4px rgb(145 134 134 / 33%)' : 'none'
          	}}
        ></div>
      ))}
    </div>
  );
};

function App() {
  
	const canvasRef = useRef(null);
	const contextRef = useRef(null);
	const [color, setColor] = useState(colors[0]);
	const [brushSize, setBrushSize] = useState(5);
	const [textPrompt, setTextPrompt] = useState('');
	const [isDrawing, setIsDrawing] = useState(false);
	const [imageSrc, setImageSrc] = useState(null);
	const [previousCanvasState, setPreviousCanvasState] = useState(null);
	const [mesh, setMesh] = useState(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		canvas.width = size * 2;  
		canvas.height = size * 2;
		canvas.style.width = `512px`;
		canvas.style.height = `512px`;
	
		const context = canvas.getContext("2d");
		context.scale(2, 2);
		context.lineCap = "round";
		contextRef.current = context;
		setDefault();
	}, []);

	useEffect(() => {
		if (contextRef.current) {
		contextRef.current.strokeStyle = color;
		contextRef.current.lineWidth = brushSize;
		}
	}, [color, brushSize]);

	useEffect(() => {
        const interval = setInterval(() => {
            checkCanvasChange();
        }, refreshRate);

        return () => clearInterval(interval);
    }, [previousCanvasState]);

	const checkCanvasChange = () => {
        const currentCanvasState = canvasRef.current.toDataURL();

        if (previousCanvasState && currentCanvasState !== previousCanvasState) {
            runImageGenInference();
        }

        setPreviousCanvasState(currentCanvasState);
    };

	const runImageGenInference = () => {
		const prompt = "3D Render of " + textPrompt;
	
		const imageDataUrl = canvasRef.current.toDataURL();
	
		let data = JSON.stringify({
			image: imageDataUrl, 
			prompt: prompt,
			num_iterations: 2
		});
	
		fetch(sdxltEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json', 
			},
			body: data
		})
		.then(response => response.blob())
		.then(blob => {
			let url = URL.createObjectURL(blob);
			updateImage(url);
		})
		.catch((error) => {
			console.error('Error:', error);
		});
	}

	const run3DInference = () => {
	
		const imageDataUrl = canvasRef.current.toDataURL();
	
		let data = JSON.stringify({
			image: imageDataUrl, 
		});
	
		fetch(tripoEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json', 
			},
			body: data
		})
		.then(response => response.blob())
		.then(blob => {
			let url = URL.createObjectURL(blob);
			setMesh(url);

			launchConfetti();
		})
		.catch((error) => {
			console.error('Error:', error);
		});
	}

	const startDrawing = ({ nativeEvent }) => {
		const { offsetX, offsetY } = nativeEvent;
		contextRef.current.beginPath();
		contextRef.current.moveTo(offsetX, offsetY);
		setIsDrawing(true);
	};

	const finishDrawing = () => {
		contextRef.current.closePath();
		setIsDrawing(false);
	};

	const launchConfetti = () => {
		confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
	};  

	const draw = ({ nativeEvent }) => {
		if (!isDrawing) { return; }
		const { offsetX, offsetY } = nativeEvent;
		contextRef.current.lineTo(offsetX, offsetY);
		contextRef.current.stroke();
	};

	const setDefault = () => {
		contextRef.current.fillStyle = "white";
		contextRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
	}

	const clearCanvas = () => {
		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');
		context.clearRect(0, 0, canvas.width, canvas.height);
		setDefault();
		updateImage(null);
		launchConfetti();
		setMesh(null);
	};

	function loadImageOnCanvas() {
		const image = new Image();
		image.src = imageSrc;
		image.onload = () => {
			const canvas = canvasRef.current;
			const context = canvas.getContext('2d');
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(image, 0, 0); 
		};
	}

	const updateImage = (newImageUrl) => {
		setImageSrc(newImageUrl);
    }
  
	return ( 
		<div style={{
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			flexDirection: 'column',
			height: '100vh',
			gap: '20px',
		}}>
			<div style={ { width: '40%' }}>
				<input className='prompt border' type="text" value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} />
			</div>
			<div style={{ 
				display: 'flex', 
				gap: '20px' 
			}}>
				<div style={{ ...panel, height: size }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px'}}>
						<ColorPicker setColor={setColor} selectedColor={color}/>
						<div style={{ marginTop: '20px', textAlign: 'center' }}>
						<div style={{color: main}}>Brush Size</div>
						<Slider
							style={{color: main}}
							value={brushSize}
							onChange={(e, newValue) => setBrushSize(newValue)}
							aria-labelledby="brush-size-slider"
							valueLabelDisplay="auto"
							min={1}
							max={100}
						/>
						</div>
						
						<Button style={{backgroundColor: main}} variant="contained" color="primary" onClick={clearCanvas}>
							Clear
						</Button>

						<Button style={{backgroundColor: main}} variant="contained" color="primary" onClick={loadImageOnCanvas}>
							Transfer
						</Button>

						<Button style={{backgroundColor: main}} variant="contained" color="primary" onClick={run3DInference}>
							Make it 3D
						</Button>
					</div>
				</div>
				
				<canvas
					onMouseDown={startDrawing}
					onMouseUp={finishDrawing}
					onMouseMove={draw}
					ref={canvasRef}
					style={{ ...panel}}
				/>

				<div className='image-container' style={{ ...panel, width: size, height: size }}>
					{mesh ? 
						<Mesh meshUrl={mesh} /> : 
						<CrossFade src={imageSrc} duration={400} timingFunction="ease-in-out" delay={0} alt="Original Image" /> 
					}
				</div>
			</div>
			
		</div>
	);

}

export default App;