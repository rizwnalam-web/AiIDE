/// <reference types="@react-three/fiber" />
import React, { useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Stars, PerspectiveCamera, Float, MeshDistortMaterial, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { Maximize2, Minimize2, X, Info } from 'lucide-react';
import { FileNode } from '../types';
import { cn } from '../lib/utils';

interface BuildingProps {
  node: FileNode;
  position: [number, number, number];
  depth: number;
  onSelect: (path: string) => void;
}

const Building: React.FC<BuildingProps> = ({ node, position, depth, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const isDirectory = node.type === 'directory';
  
  // Height based on depth or type
  const height = isDirectory ? 0.4 : 2 + Math.random() * 4;
  const color = isDirectory ? '#3b82f6' : hovered ? '#fff' : '#10b981';
  const size = isDirectory ? 2.5 : 0.8;

  useFrame((state) => {
    if (meshRef.current && !isDirectory) {
      meshRef.current.position.y = position[1] + height / 2 + Math.sin(state.clock.elapsedTime + position[0]) * 0.15;
    }
    if (meshRef.current && isDirectory) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group position={position}>
      <Float speed={isDirectory ? 1 : 2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh 
          ref={meshRef} 
          position={[0, height / 2, 0]} 
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node.path);
          }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          {isDirectory ? (
             <boxGeometry args={[size, height, size]} />
          ) : (
             <cylinderGeometry args={[size * 0.4, size * 0.7, height, 8]} />
          )}
          <meshStandardMaterial 
            color={color} 
            emissive={color}
            emissiveIntensity={hovered ? 2 : 0.5}
            roughness={0.1}
            metalness={0.9}
            transparent
            opacity={0.9}
          />
        </mesh>
      </Float>
      
      {hovered && (
        <Text
          position={[0, height + 1.2, 0]}
          fontSize={0.4}
          color="white"
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZJhiI2B.woff"
        >
          {node.name}
        </Text>
      )}
      
      {!hovered && depth < 2 && (
        <Text
          position={[0, height + 0.5, 0]}
          fontSize={0.25}
          color="#888"
          anchorX="center"
          anchorY="middle"
        >
          {node.name}
        </Text>
      )}
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
          return <District key={`${child.path}-${i}`} node={child} position={[x, 0, z]} depth={depth + 1} onSelect={onSelect} />;
        } else {
          return <Building key={`${child.path}-${i}`} node={child} position={[x, 0, z]} depth={depth + 1} onSelect={onSelect} />;
        }
      })}
    </group>
  );
};

export const MemoryPalace: React.FC<{ fileTree: FileNode[]; onFileSelect: (path: string) => void }> = ({ fileTree, onFileSelect }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const rootNode = useMemo(() => ({
    name: "Architectural Nexus",
    type: "directory" as const,
    path: "/",
    children: fileTree
  }), [fileTree]);

  return (
    <div className={cn(
      "w-full h-full bg-[#050505] relative transition-all duration-500 overflow-hidden",
      isMaximized ? "fixed inset-0 z-[2000]" : "relative"
    )}>
      {/* HUD Layer */}
      <div className="absolute top-0 left-0 w-full p-8 z-10 flex justify-between items-start pointer-events-none">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-vscode-blue rounded-full animate-pulse shadow-[0_0_10px_#007acc]" />
             <h2 className="text-white font-black tracking-tighter text-3xl uppercase leading-none">Nexus Palace</h2>
          </div>
          <p className="text-[10px] text-vscode-blue font-mono tracking-[0.2em] opacity-80 uppercase">Codebase Neural Architecture Visualization</p>
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={() => setShowControls(!showControls)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white/50 hover:text-white transition-all shadow-xl backdrop-blur-md"
            title="Toggle Controls"
          >
            <Info size={18} />
          </button>
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 bg-vscode-blue hover:bg-vscode-blue text-white rounded-full border border-vscode-blue/30 transition-all shadow-[0_0_20px_rgba(0,122,204,0.3)] backdrop-blur-md"
            title={isMaximized ? "Minimize" : "Maximize Full Screen"}
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {isMaximized && (
            <button 
              onClick={() => setIsMaximized(false)}
              className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full border border-red-500/30 transition-all shadow-xl backdrop-blur-md"
              title="Close Full Screen"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <Canvas shadows dpr={[1, 2]} camera={{ position: [20, 20, 20], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <fog attach="fog" args={['#050505', 10, 60]} />
        
        <Stars radius={100} depth={50} count={6000} factor={4} saturation={0.5} fade speed={1.5} />
        <ambientLight intensity={0.4} />
        <PerspectiveCamera makeDefault position={[20, 20, 20]} />
        
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#007acc" />
        <pointLight position={[-10, 5, -10]} intensity={1} color="#10b981" />
        
        <spotLight
          position={[0, 30, 0]}
          angle={0.3}
          penumbra={1}
          intensity={3}
          castShadow
          shadow-placeholder-bias={-0.0001}
        />
        
        <Environment preset="night" />
        
        <District node={rootNode} position={[0, 0, 0]} depth={0} onSelect={onFileSelect} />
        
        <gridHelper args={[200, 100, "#111", "#111"]} position={[0, -0.2, 0]} />
        <OrbitControls 
          makeDefault 
          minDistance={5} 
          maxDistance={80} 
          autoRotate={!isMaximized}
          autoRotateSpeed={0.5}
          enableDamping
        />

        <EffectComposer>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
          <Noise opacity={0.05} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
          <ChromaticAberration offset={new THREE.Vector2(0.001, 0.001)} radialModulation={false} modulationOffset={0} />
        </EffectComposer>
      </Canvas>

      {showControls && (
        <div className="absolute bottom-8 left-8 z-10 p-6 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl max-w-xs animate-in fade-in slide-in-from-left-4 duration-700">
           <h4 className="text-[10px] text-vscode-blue font-black uppercase tracking-[0.3em] mb-4">Neural Controls</h4>
           <div className="space-y-3 text-[10px] text-gray-400 font-medium">
             <div className="flex items-center justify-between group">
               <span className="flex items-center gap-2 underline decoration-vscode-blue/30 group-hover:decoration-vscode-blue transition-all">L-CLICK</span>
               <span className="text-white/60">ORBIT CAMERA</span>
             </div>
             <div className="flex items-center justify-between group">
               <span className="flex items-center gap-2 underline decoration-vscode-blue/30 group-hover:decoration-vscode-blue transition-all">R-CLICK</span>
               <span className="text-white/60">PAN VIEW</span>
             </div>
             <div className="flex items-center justify-between group">
               <span className="flex items-center gap-2 underline decoration-vscode-blue/30 group-hover:decoration-vscode-blue transition-all">SCROLL</span>
               <span className="text-white/60">ZOOM LEVEL</span>
             </div>
             <div className="flex items-center justify-between group">
               <span className="flex items-center gap-2 underline decoration-vscode-blue/30 group-hover:decoration-vscode-blue transition-all">CLICK NODE</span>
               <span className="text-white/60">DEEP INSPECT</span>
             </div>
           </div>
           <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">System Status</span>
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-[#10b981]">
                <div className="w-1 h-1 bg-[#10b981] rounded-full" />
                NOMINAL
              </div>
           </div>
        </div>
      )}

      {/* Floating Elements Background Decoration */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,rgba(0,122,204,0.05)_0%,transparent_70%)]" />
    </div>
  );
};
