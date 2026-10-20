import { SceneRefresh } from "./SceneRefresh";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { SceneBoundary } from "../shared/SceneBoundary";
import type { CapacitorConfig } from "../core/capacitors";
export function CapacitorScene({ config }: { config: CapacitorConfig }) {
  // Independent visual scales: dimensions preserve trends within the UI range.
  const side = Math.sqrt(config.areaM2 * 1e4) * 0.18;
  const gap = config.distanceM * 1000 * 0.16;
  const direction = new Vector3(0, config.voltageV >= 0 ? -1 : 1, 0);
  const origins = [-0.3, 0, 0.3];
  return (
    <SceneBoundary>
      <Canvas
        frameloop="demand"
        camera={{ position: [6, 5, 7], fov: 45 }}
        fallback={<p className="warning">WebGL no está disponible.</p>}
      >
        <SceneRefresh />
        <color attach="background" args={["#101e2b"]} />
        <ambientLight intensity={1.7} />
        <directionalLight position={[4, 7, 5]} intensity={2.5} />
        {[-1, 1].map((sign) => (
          <mesh key={sign} position={[0, sign * (gap / 2 + 0.06), 0]}>
            <boxGeometry args={[side, 0.12, side]} />
            <meshStandardMaterial
              color={
                config.voltageV === 0
                  ? "#8297a5"
                  : sign * config.voltageV > 0
                    ? "#ff786b"
                    : "#68a7ff"
              }
              metalness={0.35}
              roughness={0.4}
            />
          </mesh>
        ))}
        {config.relativePermittivity > 1 && (
          <mesh>
            <boxGeometry args={[side * 0.99, gap, side * 0.99]} />
            <meshStandardMaterial
              color="#68d6c0"
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </mesh>
        )}
        {config.voltageV !== 0 &&
          origins.flatMap((x) =>
            origins.map((z) => (
              <arrowHelper
                key={`${x}/${z}`}
                args={[
                  direction,
                  new Vector3(
                    x * side,
                    (config.voltageV >= 0 ? 1 : -1) * gap * 0.4,
                    z * side,
                  ),
                  gap * 0.8,
                  0xffda70,
                  Math.min(0.18, gap * 0.2),
                  Math.min(0.1, gap * 0.12),
                ]}
              />
            )),
          )}
        <OrbitControls makeDefault minDistance={1} maxDistance={35} />
      </Canvas>
    </SceneBoundary>
  );
}
