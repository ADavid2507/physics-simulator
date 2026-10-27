import { useMemo, useState } from 'react'
import { circuitPreset, ohmsLaw, solveCircuit } from '../core/circuits/solver'
import type { CircuitComponent } from '../core/circuits/solver'
import { NumberControl } from '../shared/NumberControl'
type Position = { x: number; y: number }
const fmt = (n: number) => Number(n.toPrecision(6)).toString()
function CircuitEditor({ components }: { components: CircuitComponent[] }) {
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const placed = components.map((c, i) => ({ ...c, position: positions[c.id] ?? { x: 60 + (i % 3) * 260, y: 80 + Math.floor(i / 3) * 140 } }))
  const names = [...new Set(components.flatMap(c => [c.a, c.b]))]
  const height = Math.max(360, Math.ceil(components.length / 3) * 140 + 100)
  const junctions = names.map((name, index) => {
    return { name, x: (index + 1) * 800 / (names.length + 1), y: height - 40 - index * 22 }
  })
  return <svg className="circuit-editor" viewBox={`0 0 840 ${height}`} role="img" aria-label="Editor de circuito. Arrastra los componentes; las conexiones dependen de sus nombres de nodo." onPointerMove={event => {
    if (!dragging) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) * 840 / bounds.width - dragging.dx
    const y = (event.clientY - bounds.top) * height / bounds.height - dragging.dy
    setPositions(old => ({ ...old, [dragging.id]: { x: Math.max(10, Math.min(680, x)), y: Math.max(40, Math.min(height - 65, y)) } }))
  }} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
    {placed.flatMap(c => [c.a, c.b].map((name, i) => {
      const node = junctions.find(j => j.name === name)!
      const x = c.position.x + i * 140
      return <path key={`${c.id}/${i}`} d={`M${x},${c.position.y} V${node.y} H${node.x}`} fill="none" stroke="#557688" strokeWidth="2" />
    }))}
    {junctions.map(j => <g key={j.name}><circle cx={j.x} cy={j.y} r="4" fill="#6edace" /><text x={j.x + 7} y={j.y + 16} fill="#9ee9de" fontSize="13">{j.name === '0' ? '0 · tierra' : `Nodo ${j.name}`}</text></g>)}
    {placed.map(c => <g key={c.id} transform={`translate(${c.position.x},${c.position.y})`} className="draggable-component" onPointerDown={event => {
      const svg = event.currentTarget.ownerSVGElement!, bounds = svg.getBoundingClientRect()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging({ id: c.id, dx: (event.clientX - bounds.left) * 840 / bounds.width - c.position.x, dy: (event.clientY - bounds.top) * height / bounds.height - c.position.y })
    }}>
      <rect x="-6" y="-40" width="152" height="72" rx="8" fill="#142a39" stroke="#38566a" />
      <path d={c.kind === 'resistor' ? 'M0 0 H30 l8 -10 12 20 12 -20 12 20 12 -20 12 20 8 -10 H140' : 'M0 0 H45 M95 0 H140'} stroke={c.kind === 'resistor' ? '#ffdb8a' : '#88bbff'} strokeWidth="3" fill="none" />
      {c.kind === 'source' && <><circle cx="70" cy="0" r="25" fill="none" stroke="#88bbff" strokeWidth="2" /><text x="49" y="5" fill="#88bbff">+ −</text></>}
      <text x="70" y="-24" textAnchor="middle" fill="#e1eef5" fontSize="12">{c.id} · {c.value} {c.kind === 'resistor' ? 'Ω' : 'V'}</text>
      <circle r="4" fill="#69dbd0" /><circle cx="140" r="4" fill="#69dbd0" /><text x="0" y="25" fill="#a4bdca" fontSize="11">A: {c.a}</text><text x="105" y="25" fill="#a4bdca" fontSize="11">B: {c.b}</text>
    </g>)}
  </svg>
}
function OhmExplorer() {
  const [voltage, setVoltage] = useState(12), [resistance, setResistance] = useState(100), [mode, setMode] = useState('voltage')
  const result = ohmsLaw(voltage, resistance)!
  const maxX = mode === 'voltage' ? 24 : 1000
  const data = Array.from({ length: 101 }, (_, i) => { const x = mode === 'voltage' ? i * maxX / 100 : 10 + i * 9.9; return { x, y: ohmsLaw(mode === 'voltage' ? x : voltage, mode === 'voltage' ? resistance : x)!.current } })
  const maxY = Math.max(...data.map(p => p.y), 0.001)
  return <section className="panel model-notes"><h2>Ley de Ohm en tiempo real</h2><div className="ohm-layout"><div><NumberControl label="Voltaje (V)" value={voltage} min={0} max={24} onChange={setVoltage} /><NumberControl label="Resistencia (Ω)" value={resistance} min={1} max={10000} onChange={setResistance} /><p className="muted">I = V/R = {fmt(result.current)} A · P = VI = {fmt(result.power)} W</p><label className="number-label">Gráfica<select value={mode} onChange={e => setMode(e.target.value)}><option value="voltage">I(V), R fija</option><option value="resistance">I(R), V fijo</option></select></label></div><svg viewBox="0 0 500 240" role="img" aria-label="Relación de corriente con voltaje o resistencia"><path d="M60 20 V200 H480" stroke="#769aad" fill="none" /><polyline points={data.map(p => `${60 + p.x / maxX * 410},${200 - p.y / maxY * 170}`).join(' ')} fill="none" stroke="#69dbd0" strokeWidth="3" /><text x="5" y="20" fill="#bdd3df" fontSize="12">I (A)</text><text x="5" y="45" fill="#bdd3df" fontSize="11">{fmt(maxY)}</text><text x="60" y="220" fill="#bdd3df">0</text><text x="300" y="230" fill="#bdd3df">{mode === 'voltage' ? 'Voltaje 0–24 V' : 'Resistencia 10–1000 Ω'}</text></svg></div></section>
}
export function CircuitsModule() {
  const [components, setComponents] = useState(() => circuitPreset('series'))
  const solution = useMemo(() => solveCircuit(components), [components])
  const update = (id: string, patch: Partial<CircuitComponent>) => setComponents(old => old.map(c => c.id === id ? { ...c, ...patch } : c))
  return <main><header><div><span className="eyebrow">MÓDULO 3 · CORRIENTE CONTINUA</span><h1>Circuitos y Ley de Ohm</h1><p>Conecta terminales con el mismo nombre de nodo. El nodo 0 es tierra.</p></div><span className="badge">Análisis nodal modificado</span></header>
    <nav aria-label="Ejemplos de circuitos">{[['simple', 'Fuente y resistor'], ['series', 'Serie'], ['parallel', 'Paralelo'], ['mixed', 'Mixto']].map(([key, label]) => <button key={key} onClick={() => setComponents(circuitPreset(key))}>{label}</button>)}<button onClick={() => setComponents([])}>Circuito vacío</button><button onClick={() => setComponents(circuitPreset('series'))}>Restablecer</button></nav>
    <div className="circuit-layout"><section className="panel"><h2>Componentes y conexiones</h2><p className="muted">A → B define la corriente positiva. En fuentes, A es el terminal +. Edita los nodos para conectar o desconectar terminales.</p><div className="charge-list">{components.map(c => <article key={c.id}><div className="section-title"><h3>{c.id} · {c.kind === 'resistor' ? 'Resistor' : 'Fuente DC'}</h3><button className="delete" onClick={() => setComponents(old => old.filter(item => item.id !== c.id))}>Eliminar {c.id}</button></div><NumberControl label={`${c.id} (${c.kind === 'resistor' ? 'Ω' : 'V'})`} value={c.value} min={c.kind === 'resistor' ? 0.001 : -10000} max={c.kind === 'resistor' ? 1e9 : 10000} onChange={value => update(c.id, { value })} /><div className="coordinates">{(['a', 'b'] as const).map(terminal => <label className="number-label" key={terminal}>Nodo {terminal.toUpperCase()}<input type="text" maxLength={12} value={c[terminal]} onChange={e => update(c.id, { [terminal]: e.target.value.replace(/\s/g, '') })} /></label>)}</div></article>)}</div><div className="particle-actions">{(['resistor', 'source'] as const).map(kind => <button key={kind} disabled={components.length >= 24} onClick={() => setComponents(old => [...old, { id: `${kind === 'resistor' ? 'R' : 'V'}${crypto.randomUUID().slice(0, 4)}`, kind, a: '1', b: '0', value: kind === 'resistor' ? 100 : 12 }])}>+ {kind === 'resistor' ? 'Resistor' : 'Fuente'}</button>)}</div></section>
    <section className="panel"><h2>Editor de circuito</h2><p className="muted">Arrastra los bloques para ordenarlos. Su posición no cambia las conexiones. Cruces de cables sin punto no son conexiones.</p><CircuitEditor components={components} />{!solution.ok ? <p className="warning" role="status">{solution.message}</p> : <><div className="table-scroll"><table><caption>Resultados por componente · convención pasiva</caption><thead><tr><th>Componente</th><th>V A−B (V)</th><th>I A→B (A)</th><th>P (W)</th></tr></thead><tbody>{components.map(c => <tr key={c.id}><th>{c.id}</th><td>{fmt(solution.branches[c.id].voltage)}</td><td>{fmt(solution.branches[c.id].current)}</td><td>{fmt(solution.branches[c.id].power)}</td></tr>)}</tbody></table></div><p className="muted">Disipada: {fmt(solution.totalPower)} W · Entregada neta por fuentes: {fmt(solution.suppliedPower)} W{solution.equivalentResistance !== undefined && ` · R equivalente: ${fmt(solution.equivalentResistance)} Ω`}</p><p className="muted">Voltajes nodales: {Object.entries(solution.nodes).map(([n, v]) => `${n}: ${fmt(v)} V`).join(' · ')}</p><p className="muted">Potencia negativa: el componente entrega energía. Se resuelve automáticamente al editar.</p></>}</section></div><OhmExplorer /><footer>Resistores y fuentes ideales DC · Sin componentes reactivos ni AC · Máximo 24 componentes y 16 nodos</footer></main>
}
