import { memo, useMemo } from 'react'
import { Line } from '@react-three/drei'
import { Vector3 } from 'three'
import type { ContourSegment, FieldLine } from '../core/fieldGeometry'
function ContourSegments({ segments, color }: { segments: ContourSegment[]; color: string }) {
  const positions = useMemo(() => new Float32Array(segments.flatMap(s => [s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z])), [segments])
  if (!positions.length) return null
  return <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><lineBasicMaterial color={color} transparent opacity={0.85} /></lineSegments>
}
export const FieldLayers = memo(function FieldLayers({ lines, segments }: { lines: FieldLine[]; segments: ContourSegment[] }) {
  const groups = useMemo(() => ({ positive: segments.filter(s => s.level > 0), negative: segments.filter(s => s.level < 0), zero: segments.filter(s => s.level === 0) }), [segments])
  return <>
    {lines.map((line, index) => {
      const points = line.points.map(p => [p.x, p.y, p.z] as [number, number, number])
      const i = Math.floor(line.points.length / 2), a = line.points[i], b = line.points[i + 1]
      const direction = b ? new Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize() : null
      return <group key={index}><Line points={points} color="#69dbd0" lineWidth={1.2} />{direction && <arrowHelper args={[direction, new Vector3(a.x, a.y, a.z), 0.18, 0x69dbd0, 0.1, 0.065]} />}</group>
    })}
    <ContourSegments segments={groups.positive} color="#ffad79" />
    <ContourSegments segments={groups.negative} color="#7eb4ff" />
    <ContourSegments segments={groups.zero} color="#ffffff" />
  </>
})
