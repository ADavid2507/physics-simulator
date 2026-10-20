import { SceneRefresh } from "./SceneRefresh";
import { FieldLayers } from "./FieldLayers";
import type { FieldLine, ContourSegment } from "../core/fieldGeometry";
import type { MotionState } from "../core/trajectory";
import { useMemo } from 'react'
import { SceneBoundary } from '../shared/SceneBoundary'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import { Vector3 } from 'three'
import { fieldAt } from '../core/electricity'
import type { Charge, Vec } from '../core/electricity'
function Arrows({charges, volume}: {charges: Charge[]; volume: boolean}) {
  const samples = useMemo(() => {
    const items = []
    for (const z of volume ? [-2,0,2] : [0]) for (let x=-4;x<=4;x++) for (let y=-4;y<=4;y++) {
      const r = fieldAt({x,y,z}, charges)
      if (!r.ok || r.magnitude < 1e-10) continue
      const length = Math.min(.7,.15+Math.log10(1+r.magnitude)*.08)
      items.push({key:`${x}/${y}/${z}`, direction:new Vector3(r.field.x,r.field.y,r.field.z).normalize(), origin:new Vector3(x,y,z), length})
    }
    return items
  }, [charges,volume])
  return <>{samples.map(s=><arrowHelper key={s.key} args={[s.direction,s.origin,s.length,0x60cbd4,s.length*.28,s.length*.14]}/>)}</>
}
export function ElectricScene({charges,probe,vectors,grid,volume,trajectory,fieldLines,contours}: {charges:Charge[];probe:Vec;vectors:boolean;grid:boolean;volume:boolean;trajectory:MotionState[];fieldLines:FieldLine[];contours:ContourSegment[]}) {
  const trail = useMemo(() => trajectory.filter((_, i) => i % 5 === 0 || i === trajectory.length - 1).map(p => [p.position.x, p.position.y, p.position.z] as [number, number, number]), [trajectory])
  const particle = trajectory[trajectory.length - 1]
  return <SceneBoundary><Canvas frameloop="demand" camera={{position:[7,5,9],fov:48}} fallback={<p>WebGL no disponible.</p>}>
    <SceneRefresh /><color attach="background" args={['#101e2b']}/><ambientLight intensity={1.5}/><directionalLight position={[4,6,8]} intensity={2.5}/>
    {grid && <><gridHelper args={[10,10,'#456075','#263d50']} rotation={[Math.PI/2,0,0]}/><axesHelper args={[5]}/></>}
    <FieldLayers lines={fieldLines} segments={contours} />
    {vectors && <Arrows charges={charges} volume={volume}/>}
    {charges.map(c=><mesh key={c.id} position={[c.position.x,c.position.y,c.position.z]}><sphereGeometry args={[.14,24,24]}/><meshStandardMaterial color={c.q===0?'#999999':c.q>0?'#ff786b':'#68a7ff'}/></mesh>)}
    <mesh position={[probe.x,probe.y,probe.z]}><octahedronGeometry args={[.16]}/><meshStandardMaterial color="#ffda70"/></mesh>
    {trail.length > 1 && <Line points={trail} color="#c59cff" lineWidth={2} />}
    {particle && <mesh position={[particle.position.x,particle.position.y,particle.position.z]}><sphereGeometry args={[.11,20,20]} /><meshStandardMaterial color="#c59cff" emissive="#8c42d1" emissiveIntensity={0.5} /></mesh>}
    <OrbitControls makeDefault minDistance={.5} maxDistance={100}/>
  </Canvas></SceneBoundary>
}
