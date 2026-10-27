import { useEffect, useMemo, useState } from 'react'
import { advanceMagnetic, createMagneticSource, lorentzForce, magneticPreset, norm } from '../core/magnetism'
import type { MagneticStop } from '../core/magnetism'
import { initialMotion } from '../core/trajectory'
import type { MotionState } from '../core/trajectory'
import type { Vec } from '../core/electricity'
import { NumberControl } from '../shared/NumberControl'
import { MagneticScene } from '../visualization/MagneticScene'
const axes = ['x', 'y', 'z'] as const
const fmt = (n: number) => n === 0 ? '0' : n.toExponential(4)
function VectorFields({ label, value, onChange, unit, factor = 1, max = 10000 }: { label: string; value: Vec; onChange: (value: Vec) => void; unit: string; factor?: number; max?: number }) {
  return <fieldset className="vector-fields"><legend>{label} ({unit})</legend><div className="coordinates">{axes.map(axis => <NumberControl key={axis} label={`${label} ${axis}`} value={value[axis] / factor} min={-max} max={max} onChange={n => onChange({ ...value, [axis]: n * factor })} />)}</div></fieldset>
}
interface Run { status: 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED'; points: MotionState[]; reason?: MagneticStop }
const stopMessages: Record<MagneticStop, string> = { MAX_TIME: 'Tiempo máximo de 20 s alcanzado.', OUT_OF_BOUNDS: 'La partícula alcanzó el límite del cubo ±10 m.', NEAR_SINGULARITY: 'La partícula se aproximó a la fuente ideal: región excluida de 0.12 m.', INVALID_STATE: 'Configuración o estado numérico inválido.', STEP_TOO_LARGE: 'Parámetros demasiado exigentes para el paso fijo. Reduce q, B, E o velocidad, o aumenta la masa.' }
export function MagnetismModule({ active }: { active: boolean }) {
  const [scenario, setScenario] = useState(() => magneticPreset('circle'))
  const [run, setRun] = useState<Run>(() => ({ status: 'READY', points: [initialMotion(scenario.particle)] }))
  const [probe, setProbe] = useState<Vec>({ x: 1, y: 0, z: 0 }), [vectors, setVectors] = useState(true), [lines, setLines] = useState(true)
  const prepared = useMemo(() => { try { return { source: createMagneticSource(scenario.source) } } catch (error) { return { error: (error as Error).message } } }, [scenario.source])
  function reset() { setRun({ status: 'READY', points: [initialMotion(scenario.particle)] }) }
  function change(next: typeof scenario) { setScenario(next); setRun({ status: 'READY', points: [initialMotion(next.particle)] }) }
  useEffect(() => {
    if (!active || run.status !== 'RUNNING' || !prepared.source) return
    const source = prepared.source
    const timer = window.setInterval(() => setRun(previous => {
      if (previous.status !== 'RUNNING') return previous
      const points = [...previous.points]; let state = points[points.length - 1], reason: MagneticStop | undefined
      for (let i = 0; i < 10; i++) {
        const next = advanceMagnetic(state, scenario.particle, source, scenario.electric)
        if (next.state !== state) { state = next.state; points.push(state) }
        if (next.reason) { reason = next.reason; break }
        if (points.length >= 10001) { reason = 'MAX_TIME'; break }
      }
      return { points, reason, status: reason ? 'COMPLETED' : 'RUNNING' }
    }), 20)
    return () => window.clearInterval(timer)
  }, [active, run.status, prepared.source, scenario])
  const inspection = (() => { try { if (!prepared.source) return null; const b = prepared.source.fieldAt(probe); return { b, force: lorentzForce(scenario.particle.chargeC, run.points[run.points.length - 1].velocity, scenario.electric, prepared.source.fieldAt(run.points[run.points.length - 1].position)) } } catch (error) { return (error as Error).message } })()
  const current = run.points[run.points.length - 1]
  const statuses = { READY: 'Preparada', RUNNING: 'En ejecución', PAUSED: 'En pausa', COMPLETED: 'Finalizada' }
  return <main><header><div><span className="eyebrow">MÓDULO 4 · FUERZA Y CAMPO MAGNÉTICO</span><h1>Magnetismo y Lorentz</h1><p>Explora B y el movimiento bajo F = q(E + v × B).</p></div><span className="badge">RK4 · dt = 0.002 s</span></header><nav aria-label="Escenarios magnéticos">{[['circle', 'Órbita circular'], ['helix', 'Hélice'], ['negative', 'Carga negativa'], ['crossed', 'E y B cruzados'], ['wire', 'Conductor'], ['dipole', 'Dipolo']].map(([key, label]) => <button key={key} onClick={() => change(magneticPreset(key))}>{label}</button>)}</nav>
    <div className="workspace"><section className="panel"><h2>Fuente magnética</h2><label className="number-label">Tipo<select value={scenario.source.type} onChange={e => change(magneticPreset(e.target.value === 'uniform' ? 'circle' : e.target.value))}><option value="uniform">Campo uniforme</option><option value="wire">Conductor recto largo</option><option value="dipole">Dipolo ideal</option></select></label>
    {scenario.source.type === 'uniform' && <VectorFields label="B" unit="mT" factor={0.001} max={100} value={scenario.source.field} onChange={field => change({ ...scenario, source: { type: 'uniform', field } })} />}
    {scenario.source.type === 'wire' && <><NumberControl label="Corriente I (A)" value={scenario.source.current} onChange={current => { if (scenario.source.type === 'wire') change({ ...scenario, source: { ...scenario.source, current } }) }} /><VectorFields label="Dirección de I positiva" unit="vector" max={10} value={scenario.source.direction} onChange={direction => { if (scenario.source.type === 'wire') change({ ...scenario, source: { ...scenario.source, direction } }) }} /></>}
    {scenario.source.type === 'dipole' && <VectorFields label="Momento magnético" unit="A·m²" value={scenario.source.moment} onChange={moment => { if (scenario.source.type === 'dipole') change({ ...scenario, source: { ...scenario.source, moment } }) }} />}
    {scenario.source.type !== 'uniform' && <VectorFields label="Posición fuente" unit="m" max={4} value={scenario.source.position} onChange={position => { if (scenario.source.type !== 'uniform') change({ ...scenario, source: { ...scenario.source, position } }) }} />}
    <VectorFields label="E uniforme" unit="V/m" max={1} value={scenario.electric} onChange={electric => change({ ...scenario, electric })} /><p className="muted">Cambiar la fuente, E o la partícula reinicia la trayectoria.</p></section>
    <section className="scene-panel"><div className="scene-heading"><span>CAMPO B Y TRAYECTORIA</span><span>Unidades espaciales: m</span></div><div className="canvas">{prepared.source ? <MagneticScene source={prepared.source} config={scenario.source} probe={probe} points={run.points} vectors={vectors} lines={lines} /> : <p className="warning" role="alert">{prepared.error}</p>}</div><div className="scene-controls"><label><input type="checkbox" checked={vectors} onChange={e => setVectors(e.target.checked)} /> Vectores B</label><label><input type="checkbox" checked={lines} onChange={e => setLines(e.target.checked)} /> Líneas B</label></div><p className="scene-help">Arrastra para rotar · rueda para acercar · Azul: líneas B · Violeta: partícula y recorrido</p></section>
    <section className="panel inspector"><h2>Inspector magnético</h2><VectorFields label="Punto P" unit="m" max={10} value={probe} onChange={setProbe} />{typeof inspection === 'string' ? <p className="warning">{inspection}</p> : inspection && <><div className="metric"><span>|B| en P (T)</span><strong>{fmt(norm(inspection.b))}</strong></div><dl>{axes.map(axis => <div key={axis}><dt>B{axis} (T)</dt><dd>{fmt(inspection.b[axis])}</dd></div>)}</dl><div className="metric"><span>|F| en la partícula (N)</span><strong>{fmt(norm(inspection.force))}</strong></div></>}<p className="muted">Vectores con longitud gráfica acotada. Las líneas se trazan entre ±5 m y se detienen al cerrar un lazo, salir del dominio o aproximarse a una singularidad.</p></section></div>
    <section className="panel particle-panel"><h2>Partícula de prueba · {statuses[run.status]}</h2><div className="particle-fields"><div><NumberControl label="Carga (μC)" value={scenario.particle.chargeC * 1e6} min={-10} max={10} onChange={q => change({ ...scenario, particle: { ...scenario.particle, chargeC: q * 1e-6 } })} /><NumberControl label="Masa (μg)" value={scenario.particle.massKg * 1e9} min={0.001} max={10000} onChange={m => change({ ...scenario, particle: { ...scenario.particle, massKg: m * 1e-9 } })} /></div><VectorFields label="Posición inicial" unit="m" max={10} value={scenario.particle.position} onChange={position => change({ ...scenario, particle: { ...scenario.particle, position } })} /><VectorFields label="Velocidad inicial" unit="m/s" max={20} value={scenario.particle.velocity} onChange={velocity => change({ ...scenario, particle: { ...scenario.particle, velocity } })} /></div><div className="particle-actions"><button className="primary" disabled={!prepared.source || run.status === 'RUNNING' || run.status === 'COMPLETED'} onClick={() => setRun(old => ({ ...old, status: 'RUNNING' }))}>{run.status === 'PAUSED' ? 'Continuar' : 'Iniciar'}</button><button disabled={run.status !== 'RUNNING'} onClick={() => setRun(old => ({ ...old, status: 'PAUSED' }))}>Pausar</button><button onClick={reset}>Reiniciar trayectoria</button><span>t = {current.time.toFixed(3)} s · rapidez = {norm(current.velocity).toFixed(5)} m/s</span></div>{run.reason && <p className="warning" role="status">{stopMessages[run.reason]} Se conserva el último punto válido.</p>}<p className="muted">Sin retroacción sobre las fuentes. Máximo 20 s, 10000 pasos y dominio ±10 m. Al salir del módulo se suspende el avance. Campos extremos se rechazan para evitar una órbita sin resolución numérica.</p></section>
    <section className="panel model-notes"><h2>Modelos ideales</h2><p className="muted">Conductor infinito: B = μ₀I/(2πr), regla de la mano derecha. Dipolo puntual: aproximación exterior de un imán; la barra solo representa orientación, no el interior del material. Las líneas dipolares terminan cerca de la región singular; no se inventa un cierre a través del punto ideal. No se simulan radiación, relatividad ni materiales ferromagnéticos. Para el preset circular: radio teórico 1 m y período 2π s.</p></section>
  </main>
}
