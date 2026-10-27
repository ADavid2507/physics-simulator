import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { Quaternion, Vector3 } from 'three'
import { SceneBoundary } from '../shared/SceneBoundary'
import { SceneRefresh } from './SceneRefresh'
import { magneticLines, norm } from '../core/magnetism'
import type { MagneticConfig, MagneticSource } from '../core/magnetism'
import type { MotionState } from '../core/trajectory'
import type { Vec } from '../core/electricity'
export function MagneticScene({ source, config, probe, points, vectors, lines }: { source: MagneticSource; config: MagneticConfig; probe: Vec; points: MotionState[]; vectors: boolean; lines: boolean }) {
  const arrows = useMemo(() => {
    if (!vectors) return []
    const result = []
    for (let x = -4; x <= 4; x += 2) for (let y = -4; y <= 4; y += 2) for (let z = -2; z <= 2; z += 2) {
      try {
        const b = source.fieldAt({ x, y, z }), magnitude = norm(b)
        if (magnitude < 1e-16) continue
        result.push({ point: new Vector3(x, y, z), direction: new Vector3(b.x, b.y, b.z).normalize(), length: Math.min(0.7, 0.15 + Math.log10(1 + magnitude * 1e6) * 0.14) })
      } catch { /* Excluded source region. */ }
    }
    return result
  }, [source, vectors])
  const curves = useMemo(() => lines ? magneticLines(config, source) : [], [config, source, lines])
  const trail = useMemo(() => points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map(p => [p.position.x, p.position.y, p.position.z] as [number, number, number]), [points])
  const current = points[points.length - 1].position
  const orientation = config.type === 'uniform' ? new Quaternion() : new Quaternion().setFromUnitVectors(config.type === 'wire' ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1), new Vector3((config.type === 'wire' ? config.direction : config.moment).x, (config.type === 'wire' ? config.direction : config.moment).y, (config.type === 'wire' ? config.direction : config.moment).z).normalize())
  return <SceneBoundary><Canvas frameloop="demand" camera={{ position: [7, 5, 9], fov: 48 }} fallback={<p className="warning">WebGL no disponible.</p>}><SceneRefresh /><color attach="background" args={['#101e2b']} /><ambientLight intensity={1.5} /><directionalLight position={[5, 6, 4]} intensity={2} /><axesHelper args={[5]} /><gridHelper args={[10, 10, '#456075', '#263d50']} rotation={[Math.PI / 2, 0, 0]} />
    {arrows.map((a, i) => <arrowHelper key={i} args={[a.direction, a.point, a.length, 0x69dbd0, a.length * 0.3, a.length * 0.15]} />)}
    {curves.map((curve, i) => {
      const middle = Math.floor(curve.points.length / 2), a = curve.points[middle], b = curve.points[middle + 1]
      return <group key={i}><Line points={curve.points.map(p => [p.x, p.y, p.z] as [number, number, number])} color="#74b9ff" lineWidth={1.5} />{b && <arrowHelper args={[new Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize(), new Vector3(a.x, a.y, a.z), 0.22, 0x74b9ff, 0.12, 0.08]} />}</group>
    })}
    {config.type !== 'uniform' && <group position={[config.position.x, config.position.y, config.position.z]} quaternion={orientation}>{config.type === 'wire' ? <mesh><cylinderGeometry args={[0.07, 0.07, 10, 16]} /><meshStandardMaterial color="#dfab6c" /></mesh> : <>{[-1, 1].map(sign => <mesh key={sign} position={[0, 0, sign * 0.25]}><boxGeometry args={[0.22, 0.22, 0.5]} /><meshStandardMaterial color={sign > 0 ? '#ff786b' : '#68a7ff'} /></mesh>)}</>}</group>}
    {trail.length > 1 && <Line points={trail} color="#c59cff" lineWidth={2} />}<mesh position={[current.x, current.y, current.z]}><sphereGeometry args={[0.11]} /><meshStandardMaterial color="#c59cff" /></mesh><mesh position={[probe.x, probe.y, probe.z]}><octahedronGeometry args={[0.13]} /><meshStandardMaterial color="#ffda70" /></mesh><OrbitControls makeDefault minDistance={0.5} maxDistance={100} /></Canvas></SceneBoundary>
}

