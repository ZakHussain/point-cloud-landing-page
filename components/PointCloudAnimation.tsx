// components/PointCloudAnimation.tsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';

interface Vertex {
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  initialPosition: THREE.Vector3;
  connections: number[];
  glowing: boolean;
  glowIntensity: number;
}

interface Edge {
  from: number;
  to: number;
  glowing: boolean;
  glowIntensity: number;
}

const PointCloudAnimation: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const linesRef = useRef<THREE.LineSegments | null>(null);
  const verticesRef = useRef<Vertex[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const stageRef = useRef<'initializing' | 'forming' | 'stable'>('initializing');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Configuration
  const numVertices = 50;
  const numConnections = 3;  // Average connections per vertex
  const cloudRadius = 5;     // Initial random distribution radius
  const circleRadius = 4;    // Final circle radius
  const formingDuration = 15; // Seconds to form the circle
  const mattColor = new THREE.Color(0x8a9ba8);
  const glowColor = new THREE.Color(0xffd700);
  
  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene, camera, renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x050505);
    
    const camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    cameraRef.current = camera;
    camera.position.z = 10;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);
    
    // Initialize data structures
    initializePointCloud();
    
    // Handle window resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Start animation
    animate();
    
    // Start forming circle after a short delay
    setTimeout(() => {
      stageRef.current = 'forming';
      setCircleTargets();
    }, 2000);
    
    // Schedule occasional glowing sections
    scheduleGlowingSection();
    
    return () => {
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      
      window.removeEventListener('resize', handleResize);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  const initializePointCloud = () => {
    if (!sceneRef.current) return;
    
    // Create vertices
    const vertices: Vertex[] = [];
    for (let i = 0; i < numVertices; i++) {
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * cloudRadius,
        (Math.random() - 0.5) * cloudRadius,
        (Math.random() - 0.5) * cloudRadius * 0.5  // Flatter on z-axis
      );
      
      vertices.push({
        position: position.clone(),
        initialPosition: position.clone(),
        targetPosition: position.clone(),
        connections: [],
        glowing: false,
        glowIntensity: 0
      });
    }
    
    // Create edges (connections between vertices)
    const edges: Edge[] = [];
    
    for (let i = 0; i < vertices.length; i++) {
      const connectionsNeeded = Math.floor(Math.random() * 2) + numConnections; // 3-4 connections per vertex
      
      for (let c = 0; c < connectionsNeeded; c++) {
        // Find nearest unconnected vertex
        let nearestIdx = -1;
        let nearestDist = Infinity;
        
        for (let j = 0; j < vertices.length; j++) {
          if (i === j || vertices[i].connections.includes(j)) continue;
          
          const dist = vertices[i].position.distanceTo(vertices[j].position);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = j;
          }
        }
        
        if (nearestIdx >= 0) {
          vertices[i].connections.push(nearestIdx);
          vertices[nearestIdx].connections.push(i);
          
          // Add edge (avoiding duplicates)
          const edgeExists = edges.some(
            edge => (edge.from === i && edge.to === nearestIdx) || 
                   (edge.from === nearestIdx && edge.to === i)
          );
          
          if (!edgeExists) {
            edges.push({
              from: i,
              to: nearestIdx,
              glowing: false,
              glowIntensity: 0
            });
          }
        }
      }
    }
    
    verticesRef.current = vertices;
    edgesRef.current = edges;
    
    // Create THREE.js objects
    const geometry = new THREE.BufferGeometry();
    updatePointGeometry(geometry);
    
    const pointsMaterial = new THREE.PointsMaterial({
      color: mattColor,
      size: 0.1,
      vertexColors: true
    });
    
    const points = new THREE.Points(geometry, pointsMaterial);
    pointsRef.current = points;
    sceneRef.current.add(points);
    
    // Create lines
    const linesGeometry = new THREE.BufferGeometry();
    updateLineGeometry(linesGeometry);
    
    const linesMaterial = new THREE.LineBasicMaterial({
      color: mattColor,
      vertexColors: true,
      transparent: true,
      opacity: 0.7
    });
    
    const lines = new THREE.LineSegments(linesGeometry, linesMaterial);
    linesRef.current = lines;
    sceneRef.current.add(lines);
  };
  
  const updatePointGeometry = (geometry: THREE.BufferGeometry) => {
    const vertices = verticesRef.current;
    const positions = new Float32Array(vertices.length * 3);
    const colors = new Float32Array(vertices.length * 3);
    
    vertices.forEach((vertex, i) => {
      positions[i * 3] = vertex.position.x;
      positions[i * 3 + 1] = vertex.position.y;
      positions[i * 3 + 2] = vertex.position.z;
      
      const color = mattColor.clone().lerp(glowColor, vertex.glowIntensity);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  };
  
  const updateLineGeometry = (geometry: THREE.BufferGeometry) => {
    const vertices = verticesRef.current;
    const edges = edgesRef.current;
    
    const positions = new Float32Array(edges.length * 6);
    const colors = new Float32Array(edges.length * 6);
    
    edges.forEach((edge, i) => {
      const vertexFrom = vertices[edge.from];
      const vertexTo = vertices[edge.to];
      
      positions[i * 6] = vertexFrom.position.x;
      positions[i * 6 + 1] = vertexFrom.position.y;
      positions[i * 6 + 2] = vertexFrom.position.z;
      
      positions[i * 6 + 3] = vertexTo.position.x;
      positions[i * 6 + 4] = vertexTo.position.y;
      positions[i * 6 + 5] = vertexTo.position.z;
      
      const edgeColor = mattColor.clone().lerp(glowColor, edge.glowIntensity);
      const fromColor = mattColor.clone().lerp(glowColor, Math.max(vertexFrom.glowIntensity, edge.glowIntensity));
      const toColor = mattColor.clone().lerp(glowColor, Math.max(vertexTo.glowIntensity, edge.glowIntensity));
      
      colors[i * 6] = fromColor.r;
      colors[i * 6 + 1] = fromColor.g;
      colors[i * 6 + 2] = fromColor.b;
      
      colors[i * 6 + 3] = toColor.r;
      colors[i * 6 + 4] = toColor.g;
      colors[i * 6 + 5] = toColor.b;
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  };
  
  const setCircleTargets = () => {
    const vertices = verticesRef.current;
    
    vertices.forEach((vertex, i) => {
      // Position in circle
      const angle = (i / vertices.length) * Math.PI * 2;
      const x = Math.cos(angle) * circleRadius;
      const y = Math.sin(angle) * circleRadius;
      const z = (Math.random() - 0.5) * 0.5; // Small random z-axis variation
      
      vertex.targetPosition = new THREE.Vector3(x, y, z);
    });
    
    // Start transition animation using GSAP
    vertices.forEach((vertex, i) => {
      gsap.to(vertex.position, {
        x: vertex.targetPosition.x,
        y: vertex.targetPosition.y,
        z: vertex.targetPosition.z,
        duration: formingDuration,
        ease: "power2.inOut",
        onComplete: () => {
          if (i === vertices.length - 1) {
            stageRef.current = 'stable';
          }
        }
      });
    });
  };
  
  const scheduleGlowingSection = () => {
    const randomDelay = Math.random() * 3000 + 2000; // 2-5 seconds
    
    timeoutRef.current = setTimeout(() => {
      startGlowingSection();
      scheduleGlowingSection(); // Schedule next glow
    }, randomDelay);
  };
  
  const startGlowingSection = () => {
    const vertices = verticesRef.current;
    const edges = edgesRef.current;
    
    // Reset any existing glows
    vertices.forEach(v => {
      v.glowing = false;
      v.glowIntensity = 0;
    });
    
    edges.forEach(e => {
      e.glowing = false;
      e.glowIntensity = 0;
    });
    
    // Pick a random starting vertex
    const startIndex = Math.floor(Math.random() * vertices.length);
    const nodesToGlow = [startIndex];
    const edgesToGlow: number[] = [];
    
    // Add connected vertices (up to a limit)
    const maxGlowNodes = Math.floor(Math.random() * 10) + 5; // 5-15 nodes
    
    const addConnectedVertices = (index: number, depth: number) => {
      if (depth > 2 || nodesToGlow.length >= maxGlowNodes) return;
      
      const vertex = vertices[index];
      
      for (const connectedIdx of vertex.connections) {
        if (nodesToGlow.includes(connectedIdx)) {
          // Find edge between these vertices
          const edgeIndex = edges.findIndex(
            edge => (edge.from === index && edge.to === connectedIdx) || 
                   (edge.from === connectedIdx && edge.to === index)
          );
          
          if (edgeIndex >= 0 && !edgesToGlow.includes(edgeIndex)) {
            edgesToGlow.push(edgeIndex);
          }
          
          continue;
        }
        
        // Random chance to include this connection
        if (Math.random() > 0.7) {
          nodesToGlow.push(connectedIdx);
          
          // Find edge between these vertices
          const edgeIndex = edges.findIndex(
            edge => (edge.from === index && edge.to === connectedIdx) || 
                   (edge.from === connectedIdx && edge.to === index)
          );
          
          if (edgeIndex >= 0) {
            edgesToGlow.push(edgeIndex);
          }
          
          if (nodesToGlow.length < maxGlowNodes) {
            addConnectedVertices(connectedIdx, depth + 1);
          }
        }
      }
    };
    
    addConnectedVertices(startIndex, 0);
    
    // Animate glow effect
    const glowDuration = 2.5;
    
    nodesToGlow.forEach(index => {
      const vertex = vertices[index];
      vertex.glowing = true;
      
      gsap.to(vertex, {
        glowIntensity: 1,
        duration: glowDuration / 2,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(vertex, {
            glowIntensity: 0,
            duration: glowDuration / 2,
            ease: "power2.in",
            onComplete: () => {
              vertex.glowing = false;
            }
          });
        }
      });
    });
    
    edgesToGlow.forEach(index => {
      const edge = edges[index];
      edge.glowing = true;
      
      gsap.to(edge, {
        glowIntensity: 1,
        duration: glowDuration / 2,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(edge, {
            glowIntensity: 0,
            duration: glowDuration / 2,
            ease: "power2.in",
            onComplete: () => {
              edge.glowing = false;
            }
          });
        }
      });
    });
  };
  
  const animate = () => {
    requestAnimationFrame(animate);
    
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
    
    const vertices = verticesRef.current;
    
    // Add subtle movement in stable state
    if (stageRef.current === 'stable') {
      vertices.forEach(vertex => {
        vertex.position.x += (Math.random() - 0.5) * 0.005;
        vertex.position.y += (Math.random() - 0.5) * 0.005;
        vertex.position.z += (Math.random() - 0.5) * 0.002;
        
        // Gently pull back to target position
        vertex.position.lerp(vertex.targetPosition, 0.03);
      });
    } else if (stageRef.current === 'initializing') {
      // Add dynamic cloud-like movement
      vertices.forEach(vertex => {
        vertex.position.x += (Math.random() - 0.5) * 0.03;
        vertex.position.y += (Math.random() - 0.5) * 0.03;
        vertex.position.z += (Math.random() - 0.5) * 0.01;
        
        // Keep within bounds
        vertex.position.lerp(vertex.initialPosition, 0.02);
      });
    }
    
    // Update geometries
    if (pointsRef.current && linesRef.current) {
      updatePointGeometry(pointsRef.current.geometry);
      updateLineGeometry(linesRef.current.geometry);
    }
    
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  };
  
  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default PointCloudAnimation;