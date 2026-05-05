/// <reference types="@react-three/fiber" />
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, ThreeElements } from '@react-three/fiber';
import { OrbitControls, Text, Stars, PerspectiveCamera } from '@react-three/drei';
import { FileNode } from '../types';

interface BuildingProps {
  node: FileNode;
  position: [number, number, number];
  depth: number;
  onSelect: (path: string) => void;
}

const Building: React.FC<BuildingProps> = ({ node, position, depth, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const isDirectory = node.type === 'directory';
  
  // Height based on depth or type
  const height = isDirectory ? 0.5 : 2 + Math.random() * 2;
  const color = isDirectory ? '#007acc' : '#4ec9b0';
  const size = isDirectory ? 2 : 0.8;

  useFrame((state) => {
    if (meshRef.current && !isDirectory) {
      meshRef.current.position.y = position[1] + height / 2 + Math.sin(state.clock.elapsedTime + position[0]) * 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh 
        ref={meshRef} 
        position={[0, height / 2, 0]} 
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.path);
        }}
      >
        {isDirectory ? (
           <boxGeometry args={[size, height, size]} />
        ) : (
           <cylinderGeometry args={[size * 0.5, size * 0.8, height, 6]} />
        )}
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      <Text
        position={[0, height + 0.5, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {node.name}
      </Text>
    </group>
  );
};

const District: React.FC<{ node: FileNode; position: [number, number, number]; depth: number; onSelect: (path: string) => void }> = ({ node, position, depth, onSelect }) => {
  const children = node.children || [];
  
  return (
    <group position={position}>
      <Building node={node} position={[0, 0, 0]} depth={depth} onSelect={onSelect} />
      {children.map((child, i) => {
        const angle = (i / children.length) * Math.PI * 2;
        const radius = 3 + depth * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        if (child.type === 'directory') {
          return <District key={child.path} node={child} position={[x, 0, z]} depth={depth + 1} onSelect={onSelect} />;
        } else {
          return <Building key={child.path} node={child} position={[x, 0, z]} depth={depth + 1} onSelect={onSelect} />;
        }
      })}
    </group>
  );
};

export const MemoryPalace: React.FC<{ fileTree: FileNode[]; onFileSelect: (path: string) => void }> = ({ fileTree, onFileSelect }) => {
  const rootNode = useMemo(() => ({
    name: "Root",
    type: "directory" as const,
    path: "/",
    children: fileTree
  }), [fileTree]);

  return (
    <div className="w-full h-full bg-[#0a0a0a] relative">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="text-vscode-blue font-bold tracking-tighter text-xl uppercase">Nexus Palace</h2>
        <p className="text-[10px] text-gray-500 font-mono">CODEBASE ARCHITECTURE VISUALIZATION</p>
      </div>

      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={50} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight
          position={[0, 20, 0]}
          angle={0.15}
          penumbra={1}
          intensity={2}
          castShadow
        />
        
        <District node={rootNode} position={[0, 0, 0]} depth={0} onSelect={onFileSelect} />
        
        <gridHelper args={[100, 50, "#222", "#111"]} position={[0, -0.1, 0]} />
        <OrbitControls makeDefault minDistance={5} maxDistance={50} />
      </Canvas>

      <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 font-mono space-y-1">
        <p>• L-CLICK: ROTATE</p>
        <p>• R-CLICK: PAN</p>
        <p>• SCROLL: ZOOM</p>
        <p>• CLICK BUILDING: INSPECT</p>
      </div>
    </div>
  );
};
