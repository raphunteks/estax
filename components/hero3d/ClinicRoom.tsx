"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export type Palette = { bg: string; wall: string; floor: string; porcelain: string; accent: string; upholstery: string; fg: string; plant: string; wood: string; dark: boolean };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 across [a, b] of the scroll progress, eased so motion starts and settles softly. */
const span = (p: number, a: number, b: number) => {
  const t = clamp01((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Text or simple drawings painted once into a texture (sign, queue screen, odontogram monitor). */
function makeTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Block({ args, position, rotation, color, radius = 0.04, rough = 0.85 }: { args: [number, number, number]; position: [number, number, number]; rotation?: [number, number, number]; color: string; radius?: number; rough?: number }) {
  return (
    <RoundedBox args={args} radius={radius} smoothness={3} position={position} rotation={rotation}>
      <meshStandardMaterial color={color} roughness={rough} />
    </RoundedBox>
  );
}

function Plane({ args, position, rotation, color, map, emissive = 0 }: { args: [number, number]; position: [number, number, number]; rotation?: [number, number, number]; color?: string; map?: THREE.Texture; emissive?: number }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={args} />
      {map ? <meshBasicMaterial map={map} toneMapped={false} /> : <meshStandardMaterial color={color} roughness={0.95} emissive={color} emissiveIntensity={emissive} />}
    </mesh>
  );
}

/** A waiting-room seat: seat, back and two legs. */
function Seat({ z, pal }: { z: number; pal: Palette }) {
  return (
    <group position={[-2.35, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      <Block args={[0.7, 0.12, 0.62]} position={[0, 0.46, 0]} color={pal.upholstery} radius={0.05} />
      <Block args={[0.7, 0.62, 0.1]} position={[0, 0.8, -0.28]} color={pal.upholstery} radius={0.05} />
      <Block args={[0.06, 0.42, 0.5]} position={[-0.3, 0.2, 0]} color={pal.wood} radius={0.02} />
      <Block args={[0.06, 0.42, 0.5]} position={[0.3, 0.2, 0]} color={pal.wood} radius={0.02} />
    </group>
  );
}

function Plant({ position, pal }: { position: [number, number, number]; pal: Palette }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.22, 0.17, 0.5, 24]} />
        <meshStandardMaterial color={pal.porcelain} roughness={0.7} />
      </mesh>
      {[[0, 0.78, 0, 0.32], [0.14, 1.02, 0.06, 0.24], [-0.12, 1.1, -0.04, 0.22], [0.02, 1.3, 0, 0.18]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 20, 16]} />
          <meshStandardMaterial color={pal.plant} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The whole clinic, built from rounded primitives in a soft "clay" look:
 * facade with sliding glass doors (z = 0), lobby with reception and waiting seats, then the treatment room
 * with the dental chair, the operating lamp that switches on, and a monitor showing an odontogram.
 * Every colour comes from the active site theme.
 */
export default function ClinicRoom({ pal, progress }: { pal: Palette; progress: RefObject<number> }) {
  const doors = useRef<THREE.Group>(null);
  const leak = useRef<THREE.PointLight>(null);
  const lamp = useRef<THREE.SpotLight>(null);
  const lampGlow = useRef<THREE.MeshStandardMaterial>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.7, -10);
    return o;
  }, []);

  useFrame(() => {
    const p = progress.current ?? 0;
    const d = span(p, 0.02, 0.2);
    const [l0, r0] = doors.current?.children ?? [];
    if (l0) l0.position.x = -0.62 - d * 1.25;
    if (r0) r0.position.x = 0.62 + d * 1.25;
    if (leak.current) leak.current.intensity = 1.2 + d * 2.5;
    const l = span(p, 0.52, 0.82);
    if (lamp.current) lamp.current.intensity = l * 28;
    if (lampGlow.current) lampGlow.current.emissiveIntensity = 0.2 + l * 3;
  });

  const sign = useMemo(() => makeTexture(1024, 256, (g) => {
    g.fillStyle = pal.porcelain;
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = pal.accent;
    g.textAlign = "center";
    g.font = "600 112px Georgia, 'Times New Roman', serif";
    g.fillText("Estaka", 512, 128);
    g.font = "500 38px system-ui, sans-serif";
    g.fillStyle = pal.fg;
    g.globalAlpha = 0.7;
    g.fillText("D E N T A L   C L I N I C", 512, 196);
  }), [pal.porcelain, pal.accent, pal.fg]);

  const queue = useMemo(() => makeTexture(512, 300, (g) => {
    g.fillStyle = pal.dark ? "#0b1020" : "#13204f";
    g.fillRect(0, 0, 512, 300);
    g.fillStyle = "#ffffff";
    g.globalAlpha = 0.7;
    g.textAlign = "center";
    g.font = "500 30px system-ui, sans-serif";
    g.fillText("NOMOR ANTREAN", 256, 78);
    g.globalAlpha = 1;
    g.fillStyle = pal.accent;
    g.font = "700 120px system-ui, sans-serif";
    g.fillText("A-012", 256, 210);
    g.fillStyle = "#ffffff";
    g.globalAlpha = 0.6;
    g.font = "400 26px system-ui, sans-serif";
    g.fillText("Ruang Periksa 1", 256, 262);
  }), [pal.accent, pal.dark]);

  const odonto = useMemo(() => makeTexture(640, 384, (g) => {
    g.fillStyle = pal.dark ? "#0b1020" : "#f7f8fc";
    g.fillRect(0, 0, 640, 384);
    g.fillStyle = pal.dark ? "#ffffff" : "#13204f";
    g.globalAlpha = 0.75;
    g.font = "600 24px system-ui, sans-serif";
    g.fillText("Odontogram", 28, 44);
    g.globalAlpha = 1;
    const tooth = (x: number, y: number, mark: boolean) => {
      g.fillStyle = mark ? pal.accent : pal.dark ? "#2a3150" : "#dfe3f0";
      g.beginPath();
      g.roundRect(x, y, 30, 40, 9);
      g.fill();
    };
    for (let i = 0; i < 16; i++) {
      const x = 44 + i * 35;
      const arc = Math.pow((i - 7.5) / 7.5, 2) * 34;
      tooth(x, 96 + arc, i === 3 || i === 12);
      tooth(x, 290 - arc - 40, i === 5 || i === 9);
    }
  }), [pal.accent, pal.dark]);

  return (
    <group>
      {/* Lights: soft ambience, one key light, a warm leak behind the doors, and the lamp spot. */}
      <ambientLight intensity={pal.dark ? 0.55 : 0.45} />
      <hemisphereLight args={[pal.dark ? "#dfe4ff" : "#ffffff", pal.floor, pal.dark ? 2.1 : 1.9]} />
      <directionalLight position={[3, 6, 5]} intensity={pal.dark ? 1.1 : 1.3} />
      <pointLight position={[0, 2.9, -3.4]} color="#fff4e6" intensity={pal.dark ? 3 : 2} distance={8} decay={1.2} />
      <pointLight ref={leak} position={[0, 2.3, -1.8]} color="#ffd9a8" intensity={1.2} distance={9} decay={1.2} />
      <pointLight position={[0, 2.9, -9]} color="#ffffff" intensity={pal.dark ? 4 : 2.6} distance={9} decay={1.2} />
      <spotLight ref={lamp} position={[0.2, 2.15, -9.85]} target={target} angle={0.55} penumbra={0.8} intensity={0} distance={6} decay={1.2} color="#fff7ea" />
      <primitive object={target} />

      {/* Shell: floor, ceiling, side walls, back wall with a bright window. */}
      <Plane args={[12, 22]} position={[0, 0, -4]} rotation={[-Math.PI / 2, 0, 0]} color={pal.floor} />
      <Plane args={[6, 13.2]} position={[0, 3.2, -6.6]} rotation={[Math.PI / 2, 0, 0]} color={pal.wall} />
      <Plane args={[13.2, 3.2]} position={[-3, 1.6, -6.6]} rotation={[0, Math.PI / 2, 0]} color={pal.wall} />
      <Plane args={[13.2, 3.2]} position={[3, 1.6, -6.6]} rotation={[0, -Math.PI / 2, 0]} color={pal.wall} />
      <Plane args={[6, 3.2]} position={[0, 1.6, -13.2]} color={pal.wall} />
      <Plane args={[2.8, 1.1]} position={[0, 1.95, -13.18]} color={pal.dark ? "#3b4a8c" : "#dbe8ff"} emissive={pal.dark ? 0.9 : 0.6} />

      {/* Facade with the sign and sliding glass doors. */}
      <Block args={[1.8, 3.2, 0.2]} position={[-2.1, 1.6, 0]} color={pal.porcelain} radius={0.02} />
      <Block args={[1.8, 3.2, 0.2]} position={[2.1, 1.6, 0]} color={pal.porcelain} radius={0.02} />
      <Block args={[2.4, 0.6, 0.2]} position={[0, 2.9, 0]} color={pal.porcelain} radius={0.02} />
      <Plane args={[1.9, 0.48]} position={[0, 2.9, 0.11]} map={sign} />
      <Block args={[6.2, 0.06, 0.4]} position={[0, 0.03, 0.1]} color={pal.accent} radius={0.02} />
      <group ref={doors}>
      {[0, 1].map((i) => (
        <group key={i} position={[i ? 0.62 : -0.62, 1.3, 0.02]}>
          <mesh>
            <boxGeometry args={[1.22, 2.6, 0.04]} />
            <meshStandardMaterial color={pal.dark ? "#9fb0ff" : "#cfe0ff"} transparent opacity={0.42} roughness={0.15} metalness={0.1} />
          </mesh>
          <Block args={[0.04, 0.9, 0.08]} position={[i ? -0.52 : 0.52, 0, 0.05]} color={pal.accent} radius={0.015} />
        </group>
      ))}
      </group>

      {/* Lobby: reception desk, waiting seats, plant, queue screen. */}
      <Block args={[0.9, 1.05, 2.2]} position={[1.85, 0.525, -3.3]} color={pal.porcelain} radius={0.08} />
      <Block args={[1.0, 0.07, 2.32]} position={[1.85, 1.08, -3.3]} color={pal.wood} radius={0.03} />
      <Block args={[0.02, 0.12, 2.0]} position={[1.39, 0.72, -3.3]} color={pal.accent} radius={0.01} />
      <Seat z={-2.4} pal={pal} />
      <Seat z={-3.3} pal={pal} />
      <Seat z={-4.2} pal={pal} />
      <Plant position={[-2.4, 0, -1.2]} pal={pal} />
      <Plant position={[2.45, 0, -5.6]} pal={pal} />
      <Plane args={[1.3, 0.76]} position={[-2.97, 1.85, -3.3]} rotation={[0, Math.PI / 2, 0]} map={queue} />

      {/* Partition between lobby and treatment room, with a wide opening. */}
      <Block args={[1.8, 3.2, 0.16]} position={[-2.1, 1.6, -6.6]} color={pal.porcelain} radius={0.02} />
      <Block args={[1.8, 3.2, 0.16]} position={[2.1, 1.6, -6.6]} color={pal.porcelain} radius={0.02} />
      <Block args={[2.4, 0.5, 0.16]} position={[0, 2.95, -6.6]} color={pal.porcelain} radius={0.02} />

      {/* Treatment room: dental chair facing the camera, lamp on an arm, monitor, cabinet. */}
      <group position={[0, 0, -10]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.24, 0.32, 0.5, 28]} />
          <meshStandardMaterial color={pal.porcelain} roughness={0.5} />
        </mesh>
        <Block args={[1.1, 0.06, 1.3]} position={[0, 0.03, 0]} color={pal.porcelain} radius={0.03} />
        <Block args={[0.72, 0.18, 1.0]} position={[0, 0.6, 0.05]} color={pal.upholstery} radius={0.08} rough={0.6} />
        <Block args={[0.7, 0.16, 0.85]} position={[0, 0.5, 0.86]} rotation={[0.38, 0, 0]} color={pal.upholstery} radius={0.08} rough={0.6} />
        <Block args={[0.72, 0.16, 0.95]} position={[0, 1.02, -0.72]} rotation={[-1.05, 0, 0]} color={pal.upholstery} radius={0.08} rough={0.6} />
        <Block args={[0.36, 0.12, 0.3]} position={[0, 1.45, -1.05]} rotation={[-0.6, 0, 0]} color={pal.upholstery} radius={0.05} rough={0.6} />
        <Block args={[0.1, 0.08, 0.7]} position={[0.44, 0.78, -0.05]} color={pal.porcelain} radius={0.03} />
        <Block args={[0.1, 0.08, 0.7]} position={[-0.44, 0.78, -0.05]} color={pal.porcelain} radius={0.03} />
        {/* Lamp: ceiling post, arm and glowing head. */}
        <mesh position={[0.9, 2.8, -0.3]}>
          <cylinderGeometry args={[0.035, 0.035, 0.8, 12]} />
          <meshStandardMaterial color={pal.porcelain} />
        </mesh>
        <mesh position={[0.55, 2.4, -0.1]} rotation={[0, 0, 1.2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.8, 12]} />
          <meshStandardMaterial color={pal.porcelain} />
        </mesh>
        <mesh position={[0.2, 2.18, 0.15]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.26, 0.2, 0.1, 32]} />
          <meshStandardMaterial ref={lampGlow} color="#fffaf0" emissive="#fff3dc" emissiveIntensity={0.2} roughness={0.3} />
        </mesh>
        {/* Monitor with the odontogram. */}
        <mesh position={[1.25, 1.1, -0.55]}>
          <cylinderGeometry args={[0.025, 0.025, 0.7, 10]} />
          <meshStandardMaterial color={pal.porcelain} />
        </mesh>
        <group position={[1.25, 1.55, -0.55]} rotation={[0, -0.45, 0]}>
          <Block args={[0.92, 0.58, 0.05]} position={[0, 0, -0.03]} color={pal.dark ? "#1b2140" : "#2a2f45"} radius={0.02} />
          <Plane args={[0.84, 0.5]} position={[0, 0, 0.001]} map={odonto} />
        </group>
      </group>
      <Block args={[2.6, 0.9, 0.6]} position={[-1.5, 0.45, -12.85]} color={pal.porcelain} radius={0.05} />
      <Block args={[2.64, 0.05, 0.64]} position={[-1.5, 0.92, -12.85]} color={pal.wood} radius={0.02} />
      <Plant position={[2.4, 0, -12.6]} pal={pal} />

      {/* Rendered once: soft contact shadows ground every object without per-frame cost. */}
      <ContactShadows position={[0, 0.006, -6]} scale={[6, 14]} resolution={512} frames={1} blur={2.4} opacity={pal.dark ? 0.55 : 0.32} far={2.2} />
    </group>
  );
}
