'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Button } from './ui/button';
import {
  Layers,
  Radio,
  Shield,
  Box,
  Compass,
  Hammer,
  Plus,
  Trash2,
  Copy,
  Save,
  Sliders,
  X,
  Check,
  Building2,
  Package,
  Wrench,
  Armchair,
  Grid,
  ListTree
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export interface Custom3DObject {
  id: string;
  type: 'WALL' | 'PILLAR' | 'PALLET_RACK' | 'CONTAINER_BOX' | 'WORK_DESK' | 'SAFETY_RAIL' | 'MACHINE' | 'SILO_TANK';
  name: string;
  x: number;
  z: number;
  y?: number;
  width: number;  // X / Length
  height: number; // Y / Height
  depth: number;  // Z / Depth
  rotation: number; // Y-axis in degrees
  color: string;
  opacity?: number;
}

interface GeofenceData {
  id: string;
  name: string;
  color?: string;
  points?: string;
  type?: string;
}

interface Anchor3D {
  id: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  status?: string;
}

interface Asset3D {
  id: string;
  name: string;
  type?: string | null;
  planX?: number | null;
  planY?: number | null;
  planZ?: number | null;
  status?: string | null;
  tag?: any;
  description?: string | null;
  [key: string]: any;
}

interface ThreeFloorPlanViewProps {
  zone: {
    id: string;
    name: string;
    width: number;
    height: number;
    floorPlanUrl?: string | null;
    geofences?: GeofenceData[];
  };
  anchors: Anchor3D[];
  assets: Asset3D[];
  onAnchorMove?: (anchorId: string, newX: number, newY: number) => void;
  isAdmin?: boolean;
  getBackendUrl?: () => string;
  getApiUrl?: () => string;
  apiHeaders?: () => Record<string, string>;
}

// Preset components for the 3D Builder palette
const PALETTE_TEMPLATES: {
  type: Custom3DObject['type'];
  name: string;
  category: 'Structure' | 'Warehouse' | 'Facility' | 'Machinery';
  icon: any;
  defaultWidth: number;
  defaultHeight: number;
  defaultDepth: number;
  defaultColor: string;
}[] = [
  // Structure
  { type: 'WALL', name: 'Tembok / Dinding', category: 'Structure', icon: Building2, defaultWidth: 4.0, defaultHeight: 3.5, defaultDepth: 0.25, defaultColor: '#38bdf8' },
  { type: 'PILLAR', name: 'Tiang / Pilar', category: 'Structure', icon: Building2, defaultWidth: 0.6, defaultHeight: 3.5, defaultDepth: 0.6, defaultColor: '#64748b' },
  // Warehouse
  { type: 'PALLET_RACK', name: 'Rak Palet Gudang (3-Tk)', category: 'Warehouse', icon: Package, defaultWidth: 4.0, defaultHeight: 3.8, defaultDepth: 1.2, defaultColor: '#f59e0b' },
  { type: 'CONTAINER_BOX', name: 'Box Kontainer', category: 'Warehouse', icon: Package, defaultWidth: 1.8, defaultHeight: 1.5, defaultDepth: 1.2, defaultColor: '#0284c7' },
  { type: 'SAFETY_RAIL', name: 'Pagar Pengaman (Rail)', category: 'Warehouse', icon: Shield, defaultWidth: 2.5, defaultHeight: 0.9, defaultDepth: 0.15, defaultColor: '#eab308' },
  // Facility
  { type: 'WORK_DESK', name: 'Meja Kerja (Desk)', category: 'Facility', icon: Armchair, defaultWidth: 1.8, defaultHeight: 0.8, defaultDepth: 1.0, defaultColor: '#10b981' },
  // Machinery
  { type: 'MACHINE', name: 'Mesin Industri (CNC)', category: 'Machinery', icon: Wrench, defaultWidth: 2.5, defaultHeight: 2.0, defaultDepth: 1.8, defaultColor: '#8b5cf6' },
  { type: 'SILO_TANK', name: 'Tangki Silo / Silinder', category: 'Machinery', icon: Wrench, defaultWidth: 2.0, defaultHeight: 3.8, defaultDepth: 2.0, defaultColor: '#06b6d4' },
];

export default function ThreeFloorPlanView({
  zone,
  anchors,
  assets,
  isAdmin = false,
  getBackendUrl = () => '',
  getApiUrl = () => 'http://localhost:4000/api',
  apiHeaders = () => ({})
}: ThreeFloorPlanViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Three.js core references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Object group references
  const floorGroupRef = useRef<THREE.Group>(new THREE.Group());
  const customObjectsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const geofencesGroupRef = useRef<THREE.Group>(new THREE.Group());
  const anchorsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const assetsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const domesGroupRef = useRef<THREE.Group>(new THREE.Group());

  // 3D Builder State
  const [isBuilderMode, setIsBuilderMode] = useState<boolean>(false);
  const [builderTab, setBuilderTab] = useState<'palette' | 'objects'>('palette');
  const [customObjects, setCustomObjects] = useState<Custom3DObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'Structure' | 'Warehouse' | 'Facility' | 'Machinery'>('Structure');
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [snapGrid, setSnapGrid] = useState<number>(0.5);
  const [showClearObjectsConfirm, setShowClearObjectsConfirm] = useState<boolean>(false);

  // Display toggles
  const [wallHeight, setWallHeight] = useState<number>(3.5);
  const [showSignalDomes, setShowSignalDomes] = useState<boolean>(false);
  const [showGeofences, setShowGeofences] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'top' | 'front'>('iso');
  const [isLoading3D, setIsLoading3D] = useState<boolean>(false);

  const zoneW = zone.width || 100;
  const zoneH = zone.height || 100;

  // Real-time Lerp interpolation targets
  const assetTargetsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());
  const assetMeshesRef = useRef<Map<string, THREE.Group>>(new Map());

  const isGlbModel = !!(zone.floorPlanUrl && (zone.floorPlanUrl.toLowerCase().endsWith('.glb') || zone.floorPlanUrl.toLowerCase().endsWith('.gltf')));

  // Selected object
  const selectedObject = customObjects.find((obj) => obj.id === selectedObjectId);

  // ─── 0. FETCH SAVED 3D LAYOUT FROM SERVER ─────────────────────────────────
  const fetch3DLayout = useCallback(async () => {
    if (!zone.id) return;
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/zones/${zone.id}/layout3d`, {
        headers: apiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCustomObjects(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch 3D layout:', e);
    }
  }, [zone.id, getApiUrl, apiHeaders]);

  useEffect(() => {
    fetch3DLayout();
  }, [fetch3DLayout]);

  // ─── SAVE 3D LAYOUT TO SERVER ─────────────────────────────────────────────
  const handleSaveLayout = async () => {
    if (!zone.id) return;
    setIsSavingLayout(true);
    try {
      const res = await fetch(`${getApiUrl()}/floorplan/zones/${zone.id}/layout3d`, {
        method: 'PUT',
        headers: {
          ...apiHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customObjects),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save 3D layout:', e);
    } finally {
      setIsSavingLayout(false);
    }
  };

  // ─── 1. INITIALIZE THREE.JS SCENE ──────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1.1 Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.004);
    sceneRef.current = scene;

    // Add groups (Clean: No auto-generated perimeter walls)
    scene.add(floorGroupRef.current);
    scene.add(customObjectsGroupRef.current);
    scene.add(geofencesGroupRef.current);
    scene.add(anchorsGroupRef.current);
    scene.add(assetsGroupRef.current);
    scene.add(domesGroupRef.current);

    // 1.2 Camera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2500);
    camera.position.set(zoneW * 0.85, Math.max(zoneW, zoneH) * 0.95, zoneH * 0.85);
    cameraRef.current = camera;

    // 1.3 Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 1.4 Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 2;
    controls.maxDistance = Math.max(zoneW, zoneH) * 4;
    controls.target.set(zoneW / 2, 0, zoneH / 2);
    controlsRef.current = controls;

    // 1.5 Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    dirLight.position.set(zoneW * 0.5, Math.max(zoneW, zoneH) * 1.5, zoneH * 0.5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8b5cf6, 0.6);
    fillLight.position.set(-zoneW * 0.5, Math.max(zoneW, zoneH), -zoneH * 0.5);
    scene.add(fillLight);

    // 1.6 Raycaster Click for 3D Object Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(customObjectsGroupRef.current.children, true);

      if (intersects.length > 0) {
        let rootGroup: THREE.Object3D | null = intersects[0].object;
        while (rootGroup && rootGroup.parent && rootGroup.parent !== customObjectsGroupRef.current) {
          rootGroup = rootGroup.parent;
        }
        if (rootGroup && rootGroup.name.startsWith('custom_')) {
          const objId = rootGroup.name.replace('custom_', '');
          setSelectedObjectId(objId);
          setBuilderTab('objects');
        }
      }
    };

    renderer.domElement.addEventListener('click', handlePointerDown);

    // 1.7 Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 1.8 Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth Lerp for Asset Positions
      assetMeshesRef.current.forEach((meshGroup, assetId) => {
        const target = assetTargetsRef.current.get(assetId);
        if (target) {
          meshGroup.position.x += (target.x - meshGroup.position.x) * 0.12;
          meshGroup.position.z += (target.z - meshGroup.position.z) * 0.12;
          meshGroup.position.y += (target.y - meshGroup.position.y) * 0.12;
        }

        // Pulse Halo Ring
        const ring = meshGroup.getObjectByName('pulseRing');
        if (ring) {
          const s = 1 + Math.sin(elapsedTime * 4) * 0.18;
          ring.scale.set(s, s, s);
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.domElement.removeEventListener('click', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
    };
  }, [zoneW, zoneH]);

  // ─── 2. BUILD CLEAN FLOOR / BACKGROUND IMAGE / GLTF (NO AUTO PERIMETER BOX) ─
  useEffect(() => {
    const floorGroup = floorGroupRef.current;
    floorGroup.clear();

    if (isGlbModel && zone.floorPlanUrl) {
      setIsLoading3D(true);
      const loader = new GLTFLoader();
      const modelUrl = zone.floorPlanUrl.startsWith('http') ? zone.floorPlanUrl : `${getBackendUrl()}${zone.floorPlanUrl}`;

      loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);

          const scaleX = zoneW / (size.x || 1);
          const scaleZ = zoneH / (size.z || 1);
          const uniformScale = Math.min(scaleX, scaleZ);
          model.scale.set(uniformScale, uniformScale, uniformScale);
          model.position.set(zoneW / 2, 0, zoneH / 2);
          floorGroup.add(model);
          setIsLoading3D(false);
        },
        undefined,
        (err) => {
          console.error('Failed to load 3D GLTF:', err);
          setIsLoading3D(false);
        }
      );
    } else {
      // 2.5D Floor Plane with Image Texture Blueprint (Flat & Clean)
      const floorGeo = new THREE.PlaneGeometry(zoneW, zoneH);
      floorGeo.rotateX(-Math.PI / 2);

      let floorMat: THREE.Material;
      if (zone.floorPlanUrl) {
        const fullImgUrl = zone.floorPlanUrl.startsWith('http') ? zone.floorPlanUrl : `${getBackendUrl()}${zone.floorPlanUrl}`;
        const texture = new THREE.TextureLoader().load(fullImgUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        floorMat = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.45,
          metalness: 0.1,
        });
      } else {
        floorMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.6,
          metalness: 0.2,
        });
      }

      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.set(zoneW / 2, -0.02, zoneH / 2);
      floorMesh.receiveShadow = true;
      floorGroup.add(floorMesh);

      // High-Tech Grid Helper
      if (showGrid) {
        const grid = new THREE.GridHelper(Math.max(zoneW, zoneH), Math.max(zoneW, zoneH) / 2, 0x0284c7, 0x1e293b);
        grid.position.set(zoneW / 2, 0.01, zoneH / 2);
        floorGroup.add(grid);
      }
    }
  }, [zone.floorPlanUrl, zoneW, zoneH, showGrid, isGlbModel, getBackendUrl]);

  // ─── 3. RENDER USER-BUILT 3D CUSTOM OBJECTS ───────────────────────────────
  useEffect(() => {
    const group = customObjectsGroupRef.current;
    group.clear();

    customObjects.forEach((obj) => {
      const objGroup = new THREE.Group();
      objGroup.position.set(obj.x, (obj.y ?? 0) + obj.height / 2, obj.z);
      objGroup.rotation.y = (obj.rotation * Math.PI) / 180;
      objGroup.name = `custom_${obj.id}`;

      const colorHex = parseInt(obj.color.replace('#', '0x'), 16) || 0x38bdf8;
      const isSelected = obj.id === selectedObjectId;

      // ─── A. WALL ───
      if (obj.type === 'WALL') {
        const geo = new THREE.BoxGeometry(obj.width, obj.height, obj.depth);
        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: 0.3,
          metalness: 0.2,
          transparent: (obj.opacity ?? 0.85) < 1,
          opacity: obj.opacity ?? 0.85,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        objGroup.add(mesh);

        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: isSelected ? 0xffffff : colorHex }));
        objGroup.add(line);
      }

      // ─── B. PILLAR ───
      else if (obj.type === 'PILLAR') {
        const geo = new THREE.BoxGeometry(obj.width, obj.height, obj.depth);
        const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7, metalness: 0.1 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        objGroup.add(mesh);

        const edges = new THREE.EdgesGeometry(geo);
        objGroup.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x94a3b8 })));
      }

      // ─── C. PALLET RACK (Realistic 3-Level Warehouse Rack) ───
      else if (obj.type === 'PALLET_RACK') {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.7, roughness: 0.3 });
        const beamMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.6, roughness: 0.4 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });

        const postW = 0.08;
        const postGeo = new THREE.BoxGeometry(postW, obj.height, postW);

        // 4 Vertical Posts
        [-obj.width / 2, obj.width / 2].forEach((px) => {
          [-obj.depth / 2, obj.depth / 2].forEach((pz) => {
            const post = new THREE.Mesh(postGeo, frameMat);
            post.position.set(px, 0, pz);
            post.castShadow = true;
            objGroup.add(post);
          });
        });

        // 3 Shelf Levels
        const levels = 3;
        for (let i = 1; i <= levels; i++) {
          const levelY = -obj.height / 2 + (obj.height / (levels + 0.5)) * i;

          const beamGeo = new THREE.BoxGeometry(obj.width, 0.1, 0.05);
          const frontBeam = new THREE.Mesh(beamGeo, beamMat);
          frontBeam.position.set(0, levelY, obj.depth / 2);
          const backBeam = new THREE.Mesh(beamGeo, beamMat);
          backBeam.position.set(0, levelY, -obj.depth / 2);
          objGroup.add(frontBeam);
          objGroup.add(backBeam);

          // Wooden Pallets
          const palletGeo = new THREE.BoxGeometry(obj.width * 0.42, 0.12, obj.depth * 0.85);
          [-obj.width * 0.24, obj.width * 0.24].forEach((palX) => {
            const pal = new THREE.Mesh(palletGeo, woodMat);
            pal.position.set(palX, levelY + 0.09, 0);
            pal.castShadow = true;
            objGroup.add(pal);
          });
        }
      }

      // ─── D. WORK DESK ───
      else if (obj.type === 'WORK_DESK') {
        const topMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
        const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });

        const topGeo = new THREE.BoxGeometry(obj.width, 0.06, obj.depth);
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = obj.height / 2 - 0.03;
        top.castShadow = true;
        objGroup.add(top);

        const legGeo = new THREE.CylinderGeometry(0.03, 0.03, obj.height - 0.06, 8);
        [-obj.width / 2 + 0.1, obj.width / 2 - 0.1].forEach((lx) => {
          [-obj.depth / 2 + 0.1, obj.depth / 2 - 0.1].forEach((lz) => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(lx, -0.03, lz);
            leg.castShadow = true;
            objGroup.add(leg);
          });
        });
      }

      // ─── E. SAFETY GUARDRAIL ───
      else if (obj.type === 'SAFETY_RAIL') {
        const railMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.5, roughness: 0.3 });
        const postMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });

        const postGeo = new THREE.CylinderGeometry(0.05, 0.05, obj.height, 12);
        [-obj.width / 2, obj.width / 2].forEach((px) => {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(px, 0, 0);
          p.castShadow = true;
          objGroup.add(p);
        });

        const barGeo = new THREE.CylinderGeometry(0.035, 0.035, obj.width, 12);
        barGeo.rotateZ(Math.PI / 2);
        const topBar = new THREE.Mesh(barGeo, railMat);
        topBar.position.y = obj.height / 2 - 0.06;
        const midBar = new THREE.Mesh(barGeo, railMat);
        midBar.position.y = 0;
        objGroup.add(topBar);
        objGroup.add(midBar);
      }

      // ─── F. CNC / INDUSTRIAL MACHINE ───
      else if (obj.type === 'MACHINE') {
        const bodyGeo = new THREE.BoxGeometry(obj.width, obj.height, obj.depth);
        const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.6, roughness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        objGroup.add(body);

        const panelGeo = new THREE.PlaneGeometry(obj.width * 0.4, obj.height * 0.3);
        const panelMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(0, obj.height * 0.15, obj.depth / 2 + 0.02);
        objGroup.add(panel);
      }

      // ─── G. SILO TANK ───
      else if (obj.type === 'SILO_TANK') {
        const radius = Math.min(obj.width, obj.depth) / 2;
        const cylGeo = new THREE.CylinderGeometry(radius, radius, obj.height * 0.85, 24);
        const domeGeo = new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const tankMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.85, roughness: 0.25 });

        const cyl = new THREE.Mesh(cylGeo, tankMat);
        cyl.position.y = -obj.height * 0.075;
        cyl.castShadow = true;
        objGroup.add(cyl);

        const dome = new THREE.Mesh(domeGeo, tankMat);
        dome.position.y = obj.height * 0.35;
        dome.castShadow = true;
        objGroup.add(dome);
      }

      // ─── H. CONTAINER BOX ───
      else {
        const geo = new THREE.BoxGeometry(obj.width, obj.height, obj.depth);
        const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        objGroup.add(mesh);
      }

      // Selection Highlight Box
      if (isSelected) {
        const selGeo = new THREE.BoxGeometry(obj.width + 0.15, obj.height + 0.15, obj.depth + 0.15);
        const selEdges = new THREE.EdgesGeometry(selGeo);
        const selLine = new THREE.LineSegments(selEdges, new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 }));
        objGroup.add(selLine);
      }

      group.add(objGroup);
    });
  }, [customObjects, selectedObjectId]);

  // ─── 4. RENDER GEOFENCES ──────────────────────────────────────────────────
  useEffect(() => {
    const geoGroup = geofencesGroupRef.current;
    geoGroup.clear();
    if (!showGeofences || !zone.geofences) return;

    zone.geofences.forEach((gf) => {
      if (!gf.points) return;
      try {
        const pts: { x: number; y: number }[] = JSON.parse(gf.points);
        if (pts.length < 3) return;

        const shape = new THREE.Shape();
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        shape.closePath();

        const geom = new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false });
        geom.rotateX(Math.PI / 2);
        geom.scale(1, 1, -1);

        const colorHex = gf.color ? parseInt(gf.color.replace('#', '0x'), 16) : 0x06b6d4;
        const mat = new THREE.MeshStandardMaterial({ color: colorHex, transparent: true, opacity: 0.35, roughness: 0.2 });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(0, 0.05, 0);
        geoGroup.add(mesh);

        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: colorHex }));
        line.position.copy(mesh.position);
        geoGroup.add(line);
      } catch (e) {}
    });
  }, [zone.geofences, showGeofences]);

  // ─── 5. RENDER 3D ANCHORS ─────────────────────────────────────────────────
  useEffect(() => {
    const anchorsGroup = anchorsGroupRef.current;
    const domesGroup = domesGroupRef.current;
    anchorsGroup.clear();
    domesGroup.clear();

    anchors.forEach((an) => {
      const zHeight = an.z ?? wallHeight;
      const anGroup = new THREE.Group();
      anGroup.position.set(an.x, zHeight, an.y);

      const cylGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.45, 16);
      const cylMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.8, roughness: 0.2, emissive: 0x0284c7, emissiveIntensity: 0.4 });
      const cyl = new THREE.Mesh(cylGeo, cylMat);
      cyl.castShadow = true;
      anGroup.add(cyl);

      const sphereGeo = new THREE.SphereGeometry(0.15, 16, 16);
      const sphere = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      sphere.position.y = 0.25;
      anGroup.add(sphere);

      const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, Math.max(0.3, wallHeight - zHeight + 0.3), 8);
      const pole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x475569 }));
      pole.position.y = (wallHeight - zHeight) / 2 + 0.2;
      anGroup.add(pole);

      anchorsGroup.add(anGroup);

      // Signal Dome (only if explicitly enabled)
      if (showSignalDomes) {
        const radius = Math.min(4, Math.max(2, Math.min(zoneW, zoneH) * 0.35));
        const domeGeo = new THREE.SphereGeometry(radius, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const domeMat = new THREE.MeshBasicMaterial({
          color: 0x06b6d4,
          wireframe: true,
          transparent: true,
          opacity: 0.12,
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.set(an.x, zHeight, an.y);
        dome.rotation.x = Math.PI;
        domesGroup.add(dome);
      }
    });
  }, [anchors, wallHeight, showSignalDomes, zoneW, zoneH]);

  // ─── 6. RENDER 3D REAL-TIME ASSETS ────────────────────────────────────────
  useEffect(() => {
    const assetsGroup = assetsGroupRef.current;
    const currentAssetIds = new Set(assets.map((a) => a.id));

    assetMeshesRef.current.forEach((mesh, id) => {
      if (!currentAssetIds.has(id)) {
        assetsGroup.remove(mesh);
        assetMeshesRef.current.delete(id);
        assetTargetsRef.current.delete(id);
      }
    });

    assets.forEach((asset) => {
      const posX = asset.planX !== null && asset.planX !== undefined ? Number(asset.planX) : zoneW / 2;
      const posZ = asset.planY !== null && asset.planY !== undefined ? Number(asset.planY) : zoneH / 2;
      const posY = asset.planZ !== null && asset.planZ !== undefined ? Number(asset.planZ) : 0.4;

      assetTargetsRef.current.set(asset.id, { x: posX, y: posY, z: posZ });

      if (!assetMeshesRef.current.has(asset.id)) {
        const group = new THREE.Group();
        group.position.set(posX, posY, posZ);

        const puckGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.3, 20);
        const isOnline = asset.status !== 'offline';
        const puckColor = isOnline ? 0x22c55e : 0x64748b;

        const puckMat = new THREE.MeshStandardMaterial({ color: puckColor, metalness: 0.5, roughness: 0.3, emissive: puckColor, emissiveIntensity: 0.3 });
        const puck = new THREE.Mesh(puckGeo, puckMat);
        puck.castShadow = true;
        group.add(puck);

        const ringGeo = new THREE.RingGeometry(0.55, 0.75, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: puckColor, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
        ring.name = 'pulseRing';
        ring.position.y = -0.25;
        group.add(ring);

        assetsGroup.add(group);
        assetMeshesRef.current.set(asset.id, group);
      }
    });
  }, [assets, zoneW, zoneH]);

  // ─── 7. 3D BUILDER ACTIONS ─────────────────────────────────────────────────
  const handleAddObject = (tmpl: (typeof PALETTE_TEMPLATES)[0]) => {
    const newId = `obj_${Date.now()}`;
    const newObj: Custom3DObject = {
      id: newId,
      type: tmpl.type,
      name: `${tmpl.name} #${customObjects.filter((o) => o.type === tmpl.type).length + 1}`,
      x: Math.round((zoneW / 2) / snapGrid) * snapGrid,
      z: Math.round((zoneH / 2) / snapGrid) * snapGrid,
      y: 0,
      width: tmpl.defaultWidth,
      height: tmpl.defaultHeight,
      depth: tmpl.defaultDepth,
      rotation: 0,
      color: tmpl.defaultColor,
      opacity: 0.9,
    };
    setCustomObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setBuilderTab('objects');
  };

  const handleUpdateSelected = (updates: Partial<Custom3DObject>) => {
    if (!selectedObjectId) return;
    setCustomObjects((prev) =>
      prev.map((obj) => (obj.id === selectedObjectId ? { ...obj, ...updates } : obj))
    );
  };

  const handleDuplicateObject = (objId: string) => {
    const targetObj = customObjects.find((o) => o.id === objId);
    if (!targetObj) return;
    const newId = `obj_${Date.now()}`;
    const dupObj: Custom3DObject = {
      ...targetObj,
      id: newId,
      name: `${targetObj.name} (Copy)`,
      x: Math.min(zoneW - 1, targetObj.x + 1),
      z: Math.min(zoneH - 1, targetObj.z + 1),
    };
    setCustomObjects((prev) => [...prev, dupObj]);
    setSelectedObjectId(newId);
  };

  const handleDeleteObject = (objId: string) => {
    setCustomObjects((prev) => prev.filter((obj) => obj.id !== objId));
    if (selectedObjectId === objId) {
      setSelectedObjectId(null);
    }
  };

  const handleClearAllObjects = () => {
    setShowClearObjectsConfirm(true);
  };

  const confirmClearAllObjects = () => {
    setCustomObjects([]);
    setSelectedObjectId(null);
    setShowClearObjectsConfirm(false);
  };

  // ─── 8. CAMERA PRESETS ─────────────────────────────────────────────────────
  const setPreset = (preset: 'iso' | 'top' | 'front') => {
    setCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    controls.target.set(zoneW / 2, 0, zoneH / 2);

    if (preset === 'top') {
      camera.position.set(zoneW / 2, Math.max(zoneW, zoneH) * 1.5, zoneH / 2 + 0.001);
    } else if (preset === 'front') {
      camera.position.set(zoneW / 2, wallHeight * 2, zoneH * 1.8);
    } else {
      camera.position.set(zoneW * 0.85, Math.max(zoneW, zoneH) * 0.95, zoneH * 0.85);
    }
    controls.update();
  };

  return (
    <div className="relative w-full h-full min-h-[550px] bg-[#0a0f1d] rounded-2xl overflow-hidden border border-border select-none flex flex-col">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full flex-1 cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {isLoading3D && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-30">
          <div className="bg-card border border-border p-4 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold text-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            <span>Memuat Model 3D Digital Twin (.GLB)...</span>
          </div>
        </div>
      )}

      {/* TOP FLOATING CONTROLS TOOLBAR */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-xl pointer-events-auto">
          <span className="text-[10px] uppercase font-bold text-cyan-400 px-2 flex items-center gap-1.5">
            <Box className="h-3.5 w-3.5" />
            <span>3D Digital Twin</span>
          </span>

          <div className="h-4 w-px bg-slate-700" />

          {/* Builder Mode Toggle */}
          {isAdmin && (
            <Button
              size="sm"
              variant={isBuilderMode ? 'default' : 'outline'}
              className={`h-7 text-[10px] px-2.5 font-bold gap-1.5 cursor-pointer ${
                isBuilderMode ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-md' : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
              }`}
              onClick={() => {
                setIsBuilderMode(!isBuilderMode);
                if (isBuilderMode) setSelectedObjectId(null);
              }}
            >
              <Hammer className="h-3.5 w-3.5" />
              {isBuilderMode ? 'Keluar Mode Builder' : '🛠️ 3D Builder Mode'}
            </Button>
          )}

          {isBuilderMode && (
            <Button
              size="sm"
              onClick={handleSaveLayout}
              disabled={isSavingLayout}
              className="h-7 text-[10px] px-2.5 font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md"
            >
              {saveSuccess ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saveSuccess ? 'Tersimpan!' : isSavingLayout ? 'Menyimpan...' : 'Simpan 3D'}
            </Button>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* Camera Presets */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={cameraPreset === 'iso' ? 'default' : 'ghost'}
              className="h-7 text-[10px] px-2 font-bold cursor-pointer"
              onClick={() => setPreset('iso')}
            >
              Isometric
            </Button>
            <Button
              size="sm"
              variant={cameraPreset === 'top' ? 'default' : 'ghost'}
              className="h-7 text-[10px] px-2 font-bold cursor-pointer"
              onClick={() => setPreset('top')}
            >
              Top (2D)
            </Button>
            <Button
              size="sm"
              variant={cameraPreset === 'front' ? 'default' : 'ghost'}
              className="h-7 text-[10px] px-2 font-bold cursor-pointer"
              onClick={() => setPreset('front')}
            >
              Front
            </Button>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Layer Toggles */}
          <Button
            size="sm"
            variant={showSignalDomes ? 'default' : 'outline'}
            className={`h-7 text-[10px] px-2 font-bold gap-1 cursor-pointer ${
              showSignalDomes ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'text-slate-400'
            }`}
            onClick={() => setShowSignalDomes(!showSignalDomes)}
            title="Tampilkan / Sembunyikan Kubah Sinyal Anchor"
          >
            <Radio className="h-3 w-3" /> Sinyal
          </Button>
          <Button
            size="sm"
            variant={showGeofences ? 'default' : 'outline'}
            className="h-7 text-[10px] px-2 font-bold gap-1 cursor-pointer"
            onClick={() => setShowGeofences(!showGeofences)}
            title="Zona Geofence"
          >
            <Shield className="h-3 w-3" /> Zona
          </Button>
        </div>

        {/* 3D Component Count Badge */}
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-xl pointer-events-auto flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <span className="text-amber-400 font-bold">{customObjects.length} Objek 3D</span>
          <span>•</span>
          <span className="text-cyan-400 font-bold">{anchors.length} Anchors</span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">{assets.length} Tags</span>
        </div>
      </div>

      {/* ─── LEFT SIDEBAR: 3D BUILDER WITH TABS (PALETTE & OBJECT LIST) ─────── */}
      {isBuilderMode && (
        <div className="absolute top-20 left-4 z-20 w-72 max-h-[75%] bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/30 shadow-2xl p-3.5 flex flex-col gap-3 overflow-hidden">
          {/* Tabs: [ + Tambah Komponen ] vs [ 📋 Daftar Objek ] */}
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setBuilderTab('palette')}
              className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                builderTab === 'palette' ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </button>
            <button
              type="button"
              onClick={() => setBuilderTab('objects')}
              className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                builderTab === 'objects' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
              Kelola ({customObjects.length})
            </button>
          </div>

          {/* TAB 1: PALETTE COMPONENT LIST */}
          {builderTab === 'palette' && (
            <>
              {/* Category Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-[10px]">
                {(['Structure', 'Warehouse', 'Facility', 'Machinery'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`py-1 px-2 rounded-lg font-bold transition-all cursor-pointer truncate ${
                      activeCategory === cat ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat === 'Structure' ? '🧱 Struktur' : cat === 'Warehouse' ? '📦 Gudang' : cat === 'Facility' ? '🪑 Fasilitas' : '⚙️ Mesin'}
                  </button>
                ))}
              </div>

              {/* Component List */}
              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
                {PALETTE_TEMPLATES.filter((t) => t.category === activeCategory).map((tmpl) => {
                  const Icon = tmpl.icon;
                  return (
                    <button
                      key={tmpl.type}
                      type="button"
                      onClick={() => handleAddObject(tmpl)}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-800/60 hover:bg-amber-500/15 border border-slate-700/60 hover:border-amber-500/40 transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400 group-hover:scale-110 transition-transform">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-[11px] font-bold text-white group-hover:text-amber-300 truncate">{tmpl.name}</div>
                          <div className="text-[9px] text-slate-400 font-mono">
                            {tmpl.defaultWidth}×{tmpl.defaultHeight}×{tmpl.defaultDepth}m
                          </div>
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-slate-500 group-hover:text-amber-400 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* TAB 2: PLACED OBJECTS LIST & QUICK DELETION */}
          {builderTab === 'objects' && (
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-slate-800">
                <span>Daftar Objek di Denah:</span>
                {customObjects.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllObjects}
                    className="text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-1 font-bold"
                  >
                    <Trash2 className="h-3 w-3" /> Hapus Semua
                  </button>
                )}
              </div>

              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
                {customObjects.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs italic">
                    Belum ada objek 3D yang ditempatkan.
                  </div>
                ) : (
                  customObjects.map((obj) => {
                    const isSelected = obj.id === selectedObjectId;
                    return (
                      <div
                        key={obj.id}
                        onClick={() => setSelectedObjectId(obj.id)}
                        className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/60 shadow-md text-cyan-300'
                            : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate mr-1.5">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                            style={{ backgroundColor: obj.color }}
                          />
                          <div className="truncate">
                            <div className="text-[11px] font-bold truncate">{obj.name}</div>
                            <div className="text-[9px] text-slate-400 font-mono">
                              Pos: ({obj.x}m, {obj.z}m) · {obj.width}×{obj.height}m
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateObject(obj.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
                            title="Duplikasi Objek"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteObject(obj.id);
                            }}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 cursor-pointer"
                            title="Hapus Objek Ini"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Snap Grid Setting */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold flex items-center gap-1">
              <Grid className="h-3 w-3 text-cyan-400" /> Snap Grid:
            </span>
            <div className="flex items-center gap-1">
              {[0.25, 0.5, 1.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSnapGrid(val)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer ${
                    snapGrid === val ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {val}m
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── RIGHT INSPECTOR PANEL (SELECTED 3D OBJECT) ─────────────────── */}
      {isBuilderMode && selectedObject && (
        <div className="absolute top-20 right-4 z-20 w-72 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-cyan-500/40 shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 truncate">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-cyan-300 truncate">{selectedObject.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedObjectId(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Name Field */}
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400">Nama Objek</label>
            <input
              type="text"
              value={selectedObject.name}
              onChange={(e) => handleUpdateSelected({ name: e.target.value })}
              className="w-full mt-0.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
            />
          </div>

          {/* Coordinates X & Z */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
                <span>Posisi X</span>
                <span className="text-cyan-400 font-mono">{selectedObject.x}m</span>
              </div>
              <input
                type="range"
                min={0}
                max={zoneW}
                step={snapGrid}
                value={selectedObject.x}
                onChange={(e) => handleUpdateSelected({ x: parseFloat(e.target.value) })}
                className="w-full mt-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
            <div>
              <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
                <span>Posisi Z</span>
                <span className="text-cyan-400 font-mono">{selectedObject.z}m</span>
              </div>
              <input
                type="range"
                min={0}
                max={zoneH}
                step={snapGrid}
                value={selectedObject.z}
                onChange={(e) => handleUpdateSelected({ z: parseFloat(e.target.value) })}
                className="w-full mt-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          {/* Dimensions: Length, Height, Depth */}
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400">Panjang (L)</label>
              <input
                type="number"
                step="0.5"
                min="0.2"
                value={selectedObject.width}
                onChange={(e) => handleUpdateSelected({ width: Math.max(0.2, parseFloat(e.target.value) || 0.2) })}
                className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400">Tinggi (H)</label>
              <input
                type="number"
                step="0.5"
                min="0.2"
                value={selectedObject.height}
                onChange={(e) => handleUpdateSelected({ height: Math.max(0.2, parseFloat(e.target.value) || 0.2) })}
                className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400">Tebal (D)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={selectedObject.depth}
                onChange={(e) => handleUpdateSelected({ depth: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Rotation Preset Buttons */}
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Rotasi Sudut</span>
              <span className="text-cyan-400 font-mono">{selectedObject.rotation}°</span>
            </label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {[0, 45, 90, 180].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => handleUpdateSelected({ rotation: deg })}
                  className={`py-1 rounded text-[10px] font-mono font-bold cursor-pointer ${
                    selectedObject.rotation === deg ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400">Warna Material</label>
            <div className="flex items-center gap-1.5 mt-1">
              {['#38bdf8', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b'].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => handleUpdateSelected({ color: col })}
                  className={`w-5 h-5 rounded-full border cursor-pointer ${
                    selectedObject.color === col ? 'scale-110 border-white ring-2 ring-cyan-400' : 'border-transparent opacity-80'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
              <input
                type="color"
                value={selectedObject.color}
                onChange={(e) => handleUpdateSelected({ color: e.target.value })}
                className="w-6 h-6 p-0 rounded-full border-0 cursor-pointer bg-transparent"
                title="Custom Color"
              />
            </div>
          </div>

          {/* Actions: Duplicate & Delete */}
          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDuplicateObject(selectedObject.id)}
              className="flex-1 h-8 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer font-bold"
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Duplikasi
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDeleteObject(selectedObject.id)}
              className="h-8 text-xs px-3 cursor-pointer font-bold gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Hapus
            </Button>
          </div>
        </div>
      )}

      {/* BOTTOM FLOATING STATS */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60 shadow-xl pointer-events-auto flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Compass className="h-4 w-4 text-cyan-400" />
            <span>{zone.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">({zoneW}×{zoneH}m)</span>
          </div>

          <div className="h-3 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Tinggi Plafon:</span>
            <input
              type="range"
              min={1.5}
              max={10}
              step={0.5}
              value={wallHeight}
              onChange={(e) => setWallHeight(parseFloat(e.target.value))}
              className="w-20 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <span className="font-mono text-[10px] font-bold text-cyan-300">{wallHeight}m</span>
          </div>
        </div>

        {/* Live Tracking / Status Indicator */}
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60 shadow-xl pointer-events-auto flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {assets.length} Live Tags
          </span>
          <span>•</span>
          <span className="text-cyan-400 font-bold">{anchors.length} Anchors</span>
        </div>
      </div>

      {/* Confirm Modal for Clear All 3D Objects */}
      <ConfirmModal
        isOpen={showClearObjectsConfirm}
        title="Hapus Semua Objek 3D"
        message="Apakah Anda yakin ingin menghapus SEMUA objek 3D pada denah ini?"
        confirmText="Hapus Semua"
        cancelText="Batal"
        variant="danger"
        onConfirm={confirmClearAllObjects}
        onCancel={() => setShowClearObjectsConfirm(false)}
      />
    </div>
  );
}
