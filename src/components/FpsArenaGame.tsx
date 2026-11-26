import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Crosshair, RotateCw, Shield, Target } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  playFpsHitSfx,
  playFpsKillSfx,
  playFpsReloadSfx,
  playFpsShotSfx,
} from '../lib/sfx';
import type { FpsCombatantState, GameRoomState, PlayerColor } from '../types';

interface FpsArenaGameProps {
  game: GameRoomState;
  compact?: boolean;
  onRequestJoin?: () => void;
  isSeated: boolean;
  isPending: boolean;
}

const TEAM_HEX: Record<PlayerColor, number> = {
  red: 0xd90429,
  green: 0xa3e635,
  yellow: 0xe8c86a,
  blue: 0x38bdf8,
};

// Pre-allocated math helpers outside render loop (zero per-frame GC)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _hitFallback = new THREE.Vector3();
const _centerNdc = new THREE.Vector2(0, 0);

interface CoverBox {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

const ARENA_COVERS: CoverBox[] = [
  { x: 0, z: 0, w: 3.4, h: 2.2, d: 3.4 },
  { x: -10, z: -8, w: 4.2, h: 2.6, d: 1.8 },
  { x: 10, z: 8, w: 4.2, h: 2.6, d: 1.8 },
  { x: 10, z: -9, w: 2.2, h: 2.4, d: 4.2 },
  { x: -10, z: 9, w: 2.2, h: 2.4, d: 4.2 },
  { x: 0, z: -13.5, w: 5.0, h: 1.8, d: 1.6 },
  { x: 0, z: 13.5, w: 5.0, h: 1.8, d: 1.6 },
  { x: -16, z: 0, w: 1.8, h: 2.8, d: 5.2 },
  { x: 16, z: 0, w: 1.8, h: 2.8, d: 5.2 },
];

function createDeckTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141722';
  ctx.fillRect(0, 0, 512, 512);

  // Brushed architectural tile seams
  ctx.strokeStyle = '#23283a';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Subtle accent micro-crosses at intersections
  ctx.fillStyle = '#38415c';
  for (let x = 0; x <= 512; x += 128) {
    for (let y = 0; y <= 512; y += 128) {
      ctx.fillRect(x - 6, y - 1, 12, 2);
      ctx.fillRect(x - 1, y - 6, 2, 12);
    }
  }

  // Fine surface grain
  for (let i = 0; i < 1600; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(gx, gy, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCrateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e2230';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#31384f';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 240, 240);

  // Tactical caution stripe
  ctx.fillStyle = '#d90429';
  ctx.fillRect(24, 210, 208, 12);
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(24, 34, 64, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createNameplateSprite(name: string, hp: number, maxHp: number, colorHex: number, tag?: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(13, 13, 16, 0.86)';
  ctx.beginPath();
  ctx.roundRect(8, 6, 240, 60, 12);
  ctx.fill();

  ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#f4f4f6';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const label = tag ? `${name} · ${tag}` : name;
  ctx.fillText(label.slice(0, 20), 128, 32);

  // HP bar background
  ctx.fillStyle = '#2c2c36';
  ctx.fillRect(26, 44, 204, 10);
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  ctx.fillStyle = ratio > 0.45 ? '#a3e635' : '#d90429';
  ctx.fillRect(26, 44, 204 * ratio, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.3, 0.65, 1);
  sprite.position.set(0, 2.55, 0);
  sprite.userData.canvas = canvas;
  sprite.userData.lastHp = hp;
  sprite.userData.lastLabel = label;
  return sprite;
}

function updateNameplateSprite(sprite: THREE.Sprite, name: string, hp: number, maxHp: number, colorHex: number, tag?: string) {
  const label = tag ? `${name} · ${tag}` : name;
  if (sprite.userData.lastHp === hp && sprite.userData.lastLabel === label) return;
  const canvas = sprite.userData.canvas as HTMLCanvasElement | undefined;
  const mat = sprite.material as THREE.SpriteMaterial;
  if (!canvas || !mat.map) return;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 72);
  ctx.fillStyle = 'rgba(13, 13, 16, 0.86)';
  ctx.beginPath();
  ctx.roundRect(8, 6, 240, 60, 12);
  ctx.fill();

  ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#f4f4f6';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label.slice(0, 20), 128, 32);

  ctx.fillStyle = '#2c2c36';
  ctx.fillRect(26, 44, 204, 10);
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  ctx.fillStyle = ratio > 0.45 ? '#a3e635' : '#d90429';
  ctx.fillRect(26, 44, 204 * ratio, 10);

  mat.map.needsUpdate = true;
  sprite.userData.lastHp = hp;
  sprite.userData.lastLabel = label;
}

// Composite 8-part First-Person Pulse Rifle Viewmodel (attached to camera)
function buildPulseRifleViewmodel(): {
  group: THREE.Group;
  muzzleAnchor: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  muzzleLight: THREE.PointLight;
} {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x191b24,
    roughness: 0.42,
    metalness: 0.72,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x2c3040,
    roughness: 0.22,
    metalness: 0.88,
  });
  const crimsonGlow = new THREE.MeshStandardMaterial({
    color: 0xd90429,
    emissive: 0xd90429,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.3,
  });
  const limeOptic = new THREE.MeshStandardMaterial({
    color: 0xa3e635,
    emissive: 0xa3e635,
    emissiveIntensity: 1.8,
    roughness: 0.15,
    metalness: 0.2,
  });

  // 1. Primary Receiver Hull
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.52), bodyMat);
  group.add(receiver);

  // 2. Fluted Outer Barrel Shroud
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.085, 0.36), trimMat);
  shroud.position.set(0, 0.02, -0.34);
  group.add(shroud);

  // 3. Precision Inner Barrel Cylinder
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.44, 14), trimMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.44);
  group.add(barrel);

  // 4. Holographic Sight Frame
  const opticBase = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.04, 0.14), trimMat);
  opticBase.position.set(0, 0.085, -0.02);
  group.add(opticBase);

  // 5. Glowing Sight Dot Core
  const opticLens = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.022, 0.015), limeOptic);
  opticLens.position.set(0, 0.108, -0.02);
  group.add(opticLens);

  // 6. Side Energy Rail Strips (Nova Crimson)
  const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.34), crimsonGlow);
  sideRailL.position.set(-0.058, 0.015, -0.14);
  group.add(sideRailL);

  const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.34), crimsonGlow);
  sideRailR.position.set(0.058, 0.015, -0.14);
  group.add(sideRailR);

  // 7. Angled Magazine
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.17, 0.08), bodyMat);
  mag.position.set(0, -0.11, -0.05);
  mag.rotation.x = 0.22;
  group.add(mag);

  // Muzzle anchor & dynamic flash
  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0.02, -0.68);
  group.add(muzzleAnchor);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), flashMat);
  muzzleFlash.position.copy(muzzleAnchor.position);
  group.add(muzzleFlash);

  const muzzleLight = new THREE.PointLight(0xff9f1c, 0, 7);
  muzzleLight.position.copy(muzzleAnchor.position);
  group.add(muzzleLight);

  group.position.set(0.24, -0.22, -0.46);
  return { group, muzzleAnchor, muzzleFlash, muzzleLight };
}

// Composite 8-Part Tactical Combatant / Drone Model grounded at bottom-center (y = 0)
function buildCombatantModel(combatant: FpsCombatantState): THREE.Group {
  const root = new THREE.Group();
  const teamColor = TEAM_HEX[combatant.color] || 0xd90429;

  const armorMat = new THREE.MeshStandardMaterial({
    color: combatant.isBot ? 0x232736 : 0x1a1e2a,
    roughness: 0.45,
    metalness: 0.65,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.2,
    metalness: 0.85,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    emissive: teamColor,
    emissiveIntensity: 1.6,
    roughness: 0.15,
    metalness: 0.2,
  });

  // Ground contact shadow disc (prevents floating appearance)
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 20),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // 1. Grounded Legs / Hover Base
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.82, 10), armorMat);
  leftLeg.position.set(-0.22, 0.41, 0);
  leftLeg.userData = { targetUid: combatant.uid, isHead: false };
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.82, 10), armorMat);
  rightLeg.position.set(0.22, 0.41, 0);
  rightLeg.userData = { targetUid: combatant.uid, isHead: false };
  root.add(rightLeg);

  // 2. Armored Chest Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.82, 0.44), armorMat);
  torso.position.set(0, 1.24, 0);
  torso.castShadow = true;
  torso.userData = { targetUid: combatant.uid, isHead: false };
  root.add(torso);

  // 3. Emissive Chest Core Plate
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.48), visorMat);
  core.position.set(0, 1.32, 0);
  core.userData = { targetUid: combatant.uid, isHead: false };
  root.add(core);

  // 4 & 5. Angled Shoulder Pauldrons
  const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.46), accentMat);
  pauldronL.position.set(-0.5, 1.52, 0);
  pauldronL.userData = { targetUid: combatant.uid, isHead: false };
  root.add(pauldronL);

  const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.46), accentMat);
  pauldronR.position.set(0.5, 1.52, 0);
  pauldronR.userData = { targetUid: combatant.uid, isHead: false };
  root.add(pauldronR);

  // 6. Tactical Helmet (Headshot Hitbox!)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.44), armorMat);
  head.position.set(0, 1.9, 0);
  head.castShadow = true;
  head.userData = { targetUid: combatant.uid, isHead: true };
  root.add(head);

  // 7. Glowing Visor Strip
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.13, 0.47), visorMat);
  visor.position.set(0, 1.93, 0.02);
  visor.userData = { targetUid: combatant.uid, isHead: true };
  root.add(visor);

  // 8. Side Rifle Pod
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10), accentMat);
  pod.rotation.x = Math.PI / 2;
  pod.position.set(0.46, 1.24, 0.34);
  pod.userData = { targetUid: combatant.uid, isHead: false };
  root.add(pod);

  // Overhead Nameplate + HP Sprite
  const tag = combatant.isHost ? 'HOST' : combatant.isBot ? 'BOT' : combatant.isFollower ? 'FOLLOWER' : undefined;
  const nameplate = createNameplateSprite(combatant.displayName, combatant.hp, combatant.maxHp, teamColor, tag);
  nameplate.name = 'nameplate';
  root.add(nameplate);

  root.position.set(combatant.x, 0, combatant.z);
  root.rotation.y = combatant.yaw;
  return root;
}

export const FpsArenaGame: React.FC<FpsArenaGameProps> = ({
  game,
  compact = false,
  onRequestJoin,
  isSeated,
  isPending,
}) => {
  const { session, sendWsEvent, subscribeWs } = useApp();
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Latest mutable refs so WebGL never tears down on React updates
  const combatantsRef = useRef<Record<string, FpsCombatantState>>(game.fps?.combatants || {});
  const isSeatedRef = useRef(isSeated);
  const sessionUidRef = useRef(session?.uid || '');
  const roomIdRef = useRef(game.roomId);
  const sendWsRef = useRef(sendWsEvent);

  const [ammo, setAmmo] = useState(24);
  const [reloading, setReloading] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [hitMarker, setHitMarker] = useState<'none' | 'body' | 'head'>('none');
  const [hudCollapsed, setHudCollapsed] = useState(false);

  const ammoRef = useRef(24);
  const reloadingRef = useRef(false);
  const fireFnRef = useRef<(() => void) | null>(null);
  const reloadFnRef = useRef<(() => void) | null>(null);
  const touchMoveRef = useRef({ x: 0, y: 0 });
  const touchLookRef = useRef<{ id: number | null; lastX: number; lastY: number }>({
    id: null,
    lastX: 0,
    lastY: 0,
  });
  const lookDeltaQueueRef = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    isSeatedRef.current = isSeated;
  }, [isSeated]);

  useEffect(() => {
    sessionUidRef.current = session?.uid || '';
  }, [session?.uid]);

  useEffect(() => {
    roomIdRef.current = game.roomId;
    if (game.fps?.combatants) {
      combatantsRef.current = game.fps.combatants;
    }
  }, [game.roomId, game.fps?.combatants]);

  useEffect(() => {
    sendWsRef.current = sendWsEvent;
  }, [sendWsEvent]);

  // Subscribe directly to lightweight high-frequency FPS pose/bot ticks
  useEffect(() => {
    return subscribeWs((event, payload) => {
      if (event === 'game:fps_sync' && payload) {
        const data = payload as { roomId: string; combatants: Record<string, FpsCombatantState> };
        if (data.roomId === roomIdRef.current && data.combatants) {
          combatantsRef.current = data.combatants;
        }
      }
    });
  }, [subscribeWs]);

  // Initialize Three.js Scene ONCE inside dedicated mountRef
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection (strictly for rendering cost, never scene content)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f1a);
    scene.fog = new THREE.FogExp2(0x0c0f1a, 0.018);

    // 2. Studio Environment Map via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // 3. Warm Key + Cool Hemisphere Fill + Subtle Rim
    const hemi = new THREE.HemisphereLight(0x6da7ff, 0x16141f, 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffe8c8, 1.75);
    keyLight.position.set(22, 34, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -28;
    keyLight.shadow.camera.right = 28;
    keyLight.shadow.camera.top = 28;
    keyLight.shadow.camera.bottom = -28;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd90429, 0.65);
    rimLight.position.set(-24, 16, -20);
    scene.add(rimLight);

    // 4. First-Person PerspectiveCamera + Rifle Viewmodel
    const camera = new THREE.PerspectiveCamera(72, width / height, 0.08, 180);
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    const rifle = buildPulseRifleViewmodel();
    camera.add(rifle.group);

    // 5. Extended Horizon Ground Deck + Tactical Perimeter & Covers
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const deckTex = createDeckTexture(maxAniso);
    const crateTex = createCrateTexture(maxAniso);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({
        map: deckTex,
        roughness: 0.72,
        metalness: 0.25,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Arena center tactical ring (offset on Y to prevent Z-fighting)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd90429,
      emissive: 0xd90429,
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const centerRing = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.95, 48), ringMat);
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.y = 0.025;
    scene.add(centerRing);

    // Tactical Cover Monoliths
    const coverMat = new THREE.MeshStandardMaterial({
      map: crateTex,
      roughness: 0.55,
      metalness: 0.4,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x2e3448,
      roughness: 0.28,
      metalness: 0.78,
    });
    for (const box of ARENA_COVERS) {
      const grp = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d), coverMat);
      base.position.y = box.h / 2;
      base.castShadow = !isSoftwareGl;
      base.receiveShadow = true;
      grp.add(base);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(box.w + 0.14, 0.16, box.d + 0.14), capMat);
      cap.position.y = box.h + 0.08;
      grp.add(cap);

      grp.position.set(box.x, 0, box.z);
      scene.add(grp);
    }

    // Perimeter Energy Boundary Pylons (open sky + horizon fog beyond)
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x262b3d, roughness: 0.3, metalness: 0.82 });
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xa3e635,
      emissive: 0xa3e635,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const arenaRadius = 25;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const pylon = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 5.4, 8), pylonMat);
      shaft.position.y = 2.7;
      pylon.add(shaft);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 8), beaconMat);
      beacon.position.y = 5.6;
      pylon.add(beacon);
      pylon.position.set(Math.cos(a) * arenaRadius, 0, Math.sin(a) * arenaRadius);
      scene.add(pylon);
    }

    // Dynamic Tracer Lines pool
    const tracers: Array<{ line: THREE.Line; life: number }> = [];
    const spawnTracer = (from: THREE.Vector3, to: THREE.Vector3, hit: boolean) => {
      const geom = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
      const mat = new THREE.LineBasicMaterial({
        color: hit ? 0xa3e635 : 0xffd166,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(geom, mat);
      scene.add(line);
      tracers.push({ line, life: 0.11 });
    };

    // Dynamic Combatant Meshes Map
    const combatantMeshes = new Map<string, THREE.Group>();
    const raycaster = new THREE.Raycaster();
    raycaster.far = 95;

    // Local Player Kinematic State
    const playerPos = new THREE.Vector3(0, 1.65, 18);
    let yaw = 0;
    let pitch = 0;
    let recoilOffset = 0;
    let flashTimer = 0;
    let bobPhase = 0;
    let lastPoseSent = 0;
    let isDraggingLook = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Seed initial position from server combatant if available
    const mineInit = combatantsRef.current[sessionUidRef.current];
    if (mineInit) {
      playerPos.set(mineInit.x, 1.65, mineInit.z);
      yaw = mineInit.yaw;
    }

    const keys: Record<string, boolean> = {};

    const triggerReload = () => {
      if (reloadingRef.current || ammoRef.current === 24) return;
      reloadingRef.current = true;
      setReloading(true);
      playFpsReloadSfx();
      window.setTimeout(() => {
        ammoRef.current = 24;
        setAmmo(24);
        reloadingRef.current = false;
        setReloading(false);
      }, 900);
    };

    const triggerFire = () => {
      if (!isSeatedRef.current || reloadingRef.current) return;
      if (ammoRef.current <= 0) {
        triggerReload();
        return;
      }

      ammoRef.current -= 1;
      setAmmo(ammoRef.current);
      recoilOffset = 0.095;
      flashTimer = 0.055;
      playFpsShotSfx();

      // Raycast from center crosshair
      raycaster.setFromCamera(_centerNdc, camera);
      const targets: THREE.Object3D[] = [];
      combatantMeshes.forEach((grp) => targets.push(grp));
      const hits = raycaster.intersectObjects(targets, true);

      rifle.muzzleAnchor.getWorldPosition(_muzzleWorld);
      let didHit = false;

      for (const hit of hits) {
        const targetUid = hit.object.userData?.targetUid as string | undefined;
        if (targetUid && targetUid !== sessionUidRef.current) {
          const isHead = Boolean(hit.object.userData?.isHead);
          didHit = true;
          spawnTracer(_muzzleWorld, hit.point, true);
          playFpsHitSfx(isHead);

          // Optimistic hitmarker + authoritative server hit submission
          const targetObj = combatantsRef.current[targetUid];
          if (targetObj && targetObj.hp - (isHead ? 68 : 34) <= 0) {
            playFpsKillSfx();
          }
          setHitMarker(isHead ? 'head' : 'body');
          window.setTimeout(() => setHitMarker('none'), 160);

          sendWsRef.current('game:fps_hit', {
            roomId: roomIdRef.current,
            targetUid,
            headshot: isHead,
          });
          break;
        }
      }

      if (!didHit) {
        camera.getWorldDirection(_rayOrigin);
        _hitFallback.copy(camera.position).addScaledVector(_rayOrigin, 42);
        spawnTracer(_muzzleWorld, _hitFallback, false);
      }

      if (ammoRef.current === 0) {
        triggerReload();
      }
    };

    fireFnRef.current = triggerFire;
    reloadFnRef.current = triggerReload;

    // Input Listeners (Keyboard + Pointer Lock + Graceful Drag Fallback)
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      keys[e.code] = true;
      if (e.code === 'KeyR') triggerReload();
      if (e.code === 'Space' && isSeatedRef.current) {
        e.preventDefault();
        triggerFire();
      }
      if (e.code === 'KeyH') {
        setHudCollapsed((v) => !v);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const canvas = renderer.domElement;
    const onPointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === canvas);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!isSeatedRef.current) return;
      if (e.button === 0) {
        if (document.pointerLockElement === canvas) {
          triggerFire();
        } else {
          // Try pointer lock, and also support immediate click-to-shoot + drag aim
          canvas.requestPointerLock?.();
          isDraggingLook = true;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          triggerFire();
        }
      }
    };

    const onMouseUp = () => {
      isDraggingLook = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isSeatedRef.current) return;
      if (document.pointerLockElement === canvas) {
        yaw -= e.movementX * 0.0024;
        pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0022, -0.78, 0.78);
      } else if (isDraggingLook) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        yaw -= dx * 0.0045;
        pitch = THREE.MathUtils.clamp(pitch - dy * 0.004, -0.78, 0.78);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(240, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Main Render Loop (with software-WebGL afterDraw pacing per Three.js skill)
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const collidesWithCover = (x: number, z: number): boolean => {
      if (Math.hypot(x, z) > 23.2) return true;
      for (const box of ARENA_COVERS) {
        const hw = box.w / 2 + 0.58;
        const hd = box.d / 2 + 0.58;
        if (Math.abs(x - box.x) < hw && Math.abs(z - box.z) < hd) {
          return true;
        }
      }
      return false;
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      // Apply touch look deltas
      if (lookDeltaQueueRef.current.dx !== 0 || lookDeltaQueueRef.current.dy !== 0) {
        yaw -= lookDeltaQueueRef.current.dx * 0.0055;
        pitch = THREE.MathUtils.clamp(pitch - lookDeltaQueueRef.current.dy * 0.0045, -0.78, 0.78);
        lookDeltaQueueRef.current.dx = 0;
        lookDeltaQueueRef.current.dy = 0;
      }

      if (isSeatedRef.current) {
        rifle.group.visible = true;
        const forwardInput =
          (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
          (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) -
          touchMoveRef.current.y;
        const strafeInput =
          (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
          (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) +
          touchMoveRef.current.x;

        const speed = keys['ShiftLeft'] || keys['ShiftRight'] ? 10.5 : 7.2;
        _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        _moveDir
          .set(0, 0, 0)
          .addScaledVector(_forward, forwardInput)
          .addScaledVector(_right, strafeInput);

        if (_moveDir.lengthSq() > 0.001) {
          _moveDir.normalize().multiplyScalar(speed * dt);
          const nextX = playerPos.x + _moveDir.x;
          const nextZ = playerPos.z + _moveDir.z;
          if (!collidesWithCover(nextX, playerPos.z)) playerPos.x = nextX;
          if (!collidesWithCover(playerPos.x, nextZ)) playerPos.z = nextZ;
          bobPhase += dt * 11;
        }

        camera.position.set(playerPos.x, 1.65 + Math.sin(bobPhase) * 0.032, playerPos.z);
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;

        // Smooth weapon recoil & reload damping
        recoilOffset = THREE.MathUtils.damp(recoilOffset, 0, 14, dt);
        const reloadDip = reloadingRef.current ? -0.14 : 0;
        rifle.group.position.z = -0.46 + recoilOffset;
        rifle.group.position.y = THREE.MathUtils.damp(
          rifle.group.position.y,
          -0.22 + reloadDip + Math.abs(Math.cos(bobPhase)) * 0.012,
          12,
          dt
        );
        rifle.group.rotation.x = recoilOffset * 1.6;

        // Muzzle flash fade
        if (flashTimer > 0) {
          flashTimer = Math.max(0, flashTimer - dt);
          const fRatio = flashTimer / 0.055;
          (rifle.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = fRatio;
          rifle.muzzleFlash.rotation.z += dt * 40;
          rifle.muzzleLight.intensity = fRatio * 4.5;
        } else {
          (rifle.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0;
          rifle.muzzleLight.intensity = 0;
        }

        // Broadcast throttled player pose (~8 Hz) over WebSockets
        const nowMs = performance.now();
        if (nowMs - lastPoseSent > 125 && sessionUidRef.current) {
          lastPoseSent = nowMs;
          sendWsRef.current('game:fps_pose', {
            roomId: roomIdRef.current,
            x: Number(playerPos.x.toFixed(2)),
            z: Number(playerPos.z.toFixed(2)),
            yaw: Number(yaw.toFixed(2)),
          });
        }
      } else {
        // Free Spectator Drone Camera orbiting the live arena
        rifle.group.visible = false;
        const orbitAngle = elapsed * 0.24;
        camera.position.set(Math.cos(orbitAngle) * 20, 8.5, Math.sin(orbitAngle) * 20);
        camera.lookAt(0, 1.4, 0);
      }

      // Sync remote players & Arena Drones with smooth exponential damping
      const activeCombatants = combatantsRef.current;
      const validIds = new Set<string>();

      for (const c of Object.values(activeCombatants)) {
        if (isSeatedRef.current && c.uid === sessionUidRef.current) continue;
        validIds.add(c.uid);
        let meshGrp = combatantMeshes.get(c.uid);
        if (!meshGrp) {
          meshGrp = buildCombatantModel(c);
          scene.add(meshGrp);
          combatantMeshes.set(c.uid, meshGrp);
        }
        meshGrp.position.x = THREE.MathUtils.damp(meshGrp.position.x, c.x, 8, dt);
        meshGrp.position.z = THREE.MathUtils.damp(meshGrp.position.z, c.z, 8, dt);
        meshGrp.rotation.y = THREE.MathUtils.damp(meshGrp.rotation.y, c.yaw, 8, dt);
        const plate = meshGrp.getObjectByName('nameplate') as THREE.Sprite | undefined;
        if (plate) {
          const tag = c.isHost ? 'HOST' : c.isBot ? 'BOT' : c.isFollower ? 'FOLLOWER' : undefined;
          updateNameplateSprite(plate, c.displayName, c.hp, c.maxHp, TEAM_HEX[c.color] || 0xd90429, tag);
        }
      }

      for (const [uid, grp] of combatantMeshes.entries()) {
        if (!validIds.has(uid)) {
          scene.remove(grp);
          combatantMeshes.delete(uid);
        }
      }

      // Update tracer decay
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.life -= dt;
        if (t.life <= 0) {
          scene.remove(t.line);
          t.line.geometry.dispose();
          (t.line.material as THREE.Material).dispose();
          tracers.splice(i, 1);
        } else {
          (t.line.material as THREE.LineBasicMaterial).opacity = t.life / 0.11;
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
      deckTex.dispose();
      crateTex.dispose();
      envTex.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material?.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  const myCombatant = session?.uid ? game.fps?.combatants?.[session.uid] : undefined;
  const leaderboard = Object.values(game.fps?.combatants || {})
    .sort((a, b) => b.kills - a.kills || b.score - a.score)
    .slice(0, 4);
  const killFeed = (game.fps?.killFeed || []).slice(0, 3);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[#0c0f1a] select-none ${
        compact ? 'h-[380px] sm:h-[440px]' : 'h-[440px] sm:h-[540px]'
      }`}
    >
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="h-full w-full cursor-crosshair" />

      {/* Top Minimal Spec Badge + Live Kill Feed (Solid RGBA, no backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="rounded-xl border border-white/10 bg-[#0d0d10]/85 px-3 py-1.5 text-white">
          <div className="flex items-center gap-2 text-xs font-bold tracking-tight">
            <Target className="h-3.5 w-3.5 text-[#D90429]" />
            <span>NOVA STRIKE 3D FPS</span>
            <span className="font-mono-nums text-[#A3E635]">
              First to {game.fps?.targetKills || 15}
            </span>
          </div>
          {leaderboard.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono-nums text-white/80">
              {leaderboard.map((c, idx) => (
                <span key={c.uid} className={c.uid === session?.uid ? 'text-[#A3E635] font-bold' : ''}>
                  #{idx + 1} {c.displayName.split(' ')[0]} {c.kills}K
                </span>
              ))}
            </div>
          )}
        </div>

        {killFeed.length > 0 && (
          <div className="hidden sm:flex flex-col items-end gap-1">
            {killFeed.map((kf) => (
              <div
                key={kf.id}
                className="rounded-lg border border-white/10 bg-[#0d0d10]/85 px-2.5 py-1 text-[11px] text-white font-mono-nums"
              >
                <span className="text-[#A3E635] font-semibold">{kf.killerName}</span>
                <span className="mx-1.5 text-[#D90429]">{kf.headshot ? 'HS' : '→'}</span>
                <span className="text-white/80">{kf.victimName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center Tactical Reticle (Active Player) */}
      {isSeated && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute h-2.5 w-0.5 -top-1 bg-[#A3E635]" />
            <span className="absolute h-2.5 w-0.5 -bottom-1 bg-[#A3E635]" />
            <span className="absolute w-2.5 h-0.5 -left-1 bg-[#A3E635]" />
            <span className="absolute w-2.5 h-0.5 -right-1 bg-[#A3E635]" />
            <span className="h-1 w-1 rounded-full bg-white" />
            {hitMarker !== 'none' && (
              <Crosshair
                className={`absolute h-7 w-7 ${
                  hitMarker === 'head' ? 'text-[#D90429]' : 'text-[#E8C86A]'
                }`}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile / Touch Dual-Thumb Controls (visible on touch devices when seated) */}
      {isSeated && (
        <>
          {/* Left Touch Move Pad */}
          <div
            onTouchStart={(e) => {
              const t = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              touchMoveRef.current = {
                x: Math.max(-1, Math.min(1, (t.clientX - cx) / (rect.width / 2))),
                y: Math.max(-1, Math.min(1, (t.clientY - cy) / (rect.height / 2))),
              };
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              touchMoveRef.current = {
                x: Math.max(-1, Math.min(1, (t.clientX - cx) / (rect.width / 2))),
                y: Math.max(-1, Math.min(1, (t.clientY - cy) / (rect.height / 2))),
              };
            }}
            onTouchEnd={() => {
              touchMoveRef.current = { x: 0, y: 0 };
            }}
            className="sm:hidden absolute left-3 bottom-16 h-24 w-24 rounded-full border border-white/25 bg-[#0d0d10]/70 flex items-center justify-center text-[10px] font-semibold text-white/75 touch-none"
          >
            MOVE
          </div>

          {/* Right Touch Aim Surface + Fire Button */}
          <div
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              touchLookRef.current = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
            }}
            onTouchMove={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === touchLookRef.current.id) {
                  lookDeltaQueueRef.current.dx += t.clientX - touchLookRef.current.lastX;
                  lookDeltaQueueRef.current.dy += t.clientY - touchLookRef.current.lastY;
                  touchLookRef.current.lastX = t.clientX;
                  touchLookRef.current.lastY = t.clientY;
                }
              }
            }}
            onTouchEnd={() => {
              touchLookRef.current.id = null;
            }}
            className="sm:hidden absolute right-3 bottom-16 flex flex-col items-end gap-2 touch-none"
          >
            <button
              type="button"
              onClick={() => reloadFnRef.current?.()}
              className="h-11 px-3 rounded-xl border border-white/25 bg-[#0d0d10]/85 text-xs font-semibold text-white"
            >
              RELOAD
            </button>
            <button
              type="button"
              onClick={() => fireFnRef.current?.()}
              className="h-14 w-14 rounded-full bg-[#D90429] text-xs font-bold text-white shadow-lg"
            >
              FIRE
            </button>
          </div>
        </>
      )}

      {/* Collapsible Bottom Control Dock (Zero Center Occlusion) */}
      <div className="absolute inset-x-0 bottom-3 flex flex-col items-center pointer-events-none px-3">
        <button
          type="button"
          onClick={() => setHudCollapsed((v) => !v)}
          className="pointer-events-auto mb-1 inline-flex items-center gap-1 rounded-t-lg border border-b-0 border-white/15 bg-[#0d0d10]/90 px-2.5 py-0.5 text-[10px] font-semibold text-white/80 hover:text-white cursor-pointer"
        >
          {hudCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>{hudCollapsed ? 'Show HUD (H)' : 'Hide HUD'}</span>
        </button>

        {!hudCollapsed && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/15 bg-[#0d0d10]/92 px-4 py-2 text-xs text-white max-w-[96%]">
            {isSeated ? (
              <>
                <span className="inline-flex items-center gap-1.5 font-mono-nums">
                  <Shield className="h-3.5 w-3.5 text-[#A3E635]" />
                  <span>HP {myCombatant?.hp ?? 100}</span>
                </span>
                <span className="font-mono-nums text-[#E8C86A] font-semibold">
                  {reloading ? 'RELOADING...' : `AMMO ${ammo}/24`}
                </span>
                <span className="font-mono-nums text-white/80">
                  K/D {myCombatant?.kills ?? 0}/{myCombatant?.deaths ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => fireFnRef.current?.()}
                  className="h-8 rounded-lg bg-[#D90429] px-3 text-xs font-bold text-white hover:bg-[#ef233c] cursor-pointer"
                >
                  Fire
                </button>
                <button
                  type="button"
                  onClick={() => reloadFnRef.current?.()}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/20 px-2.5 text-xs font-medium text-white hover:border-[#A3E635] cursor-pointer"
                >
                  <RotateCw className="h-3 w-3" />
                  <span>Reload (R)</span>
                </button>
                <span className="hidden md:inline text-[11px] text-white/65">
                  {pointerLocked
                    ? 'Pointer Locked · WASD Move · Click Shoot · ESC Unlock'
                    : 'Click arena to Lock Aim (or Drag + Click) · WASD Move · Space Shoot'}
                </span>
              </>
            ) : (
              <>
                <span className="text-white/85">
                  Spectator Drone Cam — Watching {game.hostName}&apos;s live 3D FPS squad
                </span>
                {!isPending && onRequestJoin && (
                  <button
                    type="button"
                    onClick={onRequestJoin}
                    className="h-8 rounded-lg bg-[#D90429] px-3 text-xs font-bold text-white hover:bg-[#ef233c] cursor-pointer"
                  >
                    Request to Drop In
                  </button>
                )}
                {isPending && (
                  <span className="font-semibold text-[#E8C86A]">
                    Waiting for Host approval...
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
