import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

export default function Mesh({ meshUrl }) {
    const divRef = useRef(null); 

    useEffect(() => {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        const camera = new THREE.PerspectiveCamera(75, 512 / 512, 0.1, 1000);
        camera.position.set(0, 0, 1);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(512, 512);
        divRef.current.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 1, 1);
        scene.add(directionalLight);

        const controls = new OrbitControls(camera, renderer.domElement);

        const loader = new OBJLoader();
        loader.load(meshUrl, (obj) => {
            obj.rotation.x = THREE.MathUtils.degToRad(-90);
            scene.add(obj);
            console.log("Object loaded successfully");
        }, undefined, (error) => {
            console.error('An error happened during loading:', error);
        });

        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };

        animate();

        return () => {
            if (divRef.current.contains(renderer.domElement)) {
                divRef.current.removeChild(renderer.domElement);
            }
        };
    }, [meshUrl]);

    return <div ref={divRef} style={{ width: '512px', height: '512px' }}></div>;
}
