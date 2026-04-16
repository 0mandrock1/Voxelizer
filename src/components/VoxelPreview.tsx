import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Environment } from "@react-three/drei";
import { VoxelData } from "../services/geminiService";
import * as THREE from "three";
import { useMemo } from "react";

interface VoxelPreviewProps {
  data: VoxelData | null;
}

export function VoxelPreview({ data }: VoxelPreviewProps) {
  const voxelMesh = useMemo(() => {
    if (!data) return null;

    const { voxels, palette } = data;
    
    // We use InstancedMesh for performance
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();
    
    const mesh = new THREE.InstancedMesh(geometry, material, voxels.length);
    
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    voxels.forEach((v, i) => {
      // MagicaVoxel coordinates are often Z-up, but Three.js is Y-up.
      // We'll just map them directly for now.
      matrix.setPosition(v.x, v.z, v.y);
      mesh.setMatrixAt(i, matrix);
      
      const p = palette[v.colorIndex];
      if (p) {
        color.setRGB(p.r / 255, p.g / 255, p.b / 255);
        mesh.setColorAt(i, color);
      }
    });

    return mesh;
  }, [data]);

  return (
    <div className="w-full h-full bg-bg-surface overflow-hidden relative">
      {!data && (
        <div className="absolute inset-0 flex items-center justify-center text-text-secondary font-serif italic tracking-wider">
          Waiting for neural reconstruction...
        </div>
      )}
      <Canvas camera={{ position: [40, 40, 40], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[100, 100, 100]} intensity={1} />
        <pointLight position={[-100, -100, -100]} intensity={0.5} />
        <Environment preset="city" />
        
        <Center>
          {voxelMesh && <primitive object={voxelMesh} />}
        </Center>
        
        <OrbitControls makeDefault />
        <gridHelper args={[100, 100, 0x2a2a2a, 0x1c1c1c]} position={[0, -0.5, 0]} />
      </Canvas>
    </div>
  );
}
