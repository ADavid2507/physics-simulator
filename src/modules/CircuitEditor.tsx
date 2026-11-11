import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { CircuitComponent } from '../core/circuits/solver'
import '../circuit-editor.css'

type Point = { x: number; y: number }
type Drag = { key: string; offset: Point }
const WIDTH = 1000
const colors = ['#75ded0', '#f2c779', '#a6b9ff', '#e4a3cf', '#8ed1f4', '#b7d38b']

function initialLayout(components: CircuitComponent[]) {
  const all = [...new Set(components.flatMap(c => [c.a, c.b]))]
  const first = components.find(c => c.kind === 'source')?.a
  const names = all.filter(n => n !== '0' && n !== first)
  if (first && first !== '0') names.unshift(first)
  if (all.includes('0')) names.push('0')
  const nodes: Record<string, Point> = Object.create(null)
  names.forEach((name, i) => { nodes[name] = { x: names.length === 1 ? WIDTH / 2 : 90 + i * 820 / (names.length - 1), y: 250 } })
  const lanes: { min: number; max: number; row: number }[] = []
  const blocks: Record<string, Point> = Object.create(null)
  let bottom = 250
  for (const c of [...components.filter(c => c.kind === 'source'), ...components.filter(c => c.kind === 'resistor')]) {
    const a = nodes[c.a], b = nodes[c.b]
    const center = Math.max(110, Math.min(890, (a.x + b.x) / 2))
    const min = center - 90, max = center + 90
    let row = c.kind === 'source' ? 100 : 250
    while (lanes.some(lane => lane.row === row && lane.min < max + 30 && lane.max > min - 30)) row += 125
    lanes.push({ min, max, row })
    blocks[c.id] = { x: center, y: row }
    bottom = Math.max(bottom, row)
  }
  return { names, nodes, blocks, height: Math.max(480, bottom + 120) }
}

export function CircuitEditor({ components, nodeVoltages }: { components: CircuitComponent[]; nodeVoltages?: Record<string, number> }) {
  const layout = useMemo(() => initialLayout(components), [components])
  const [positions, setPositions] = useState<Record<string, Point>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const drag = useRef<Drag | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const point = (key: string, fallback: Point) => positions[key] ?? fallback
  const nodePoint = (name: string) => point(`node:${name}`, layout.nodes[name])
  const nodeColor = (name: string) => name === '0' ? '#b3c5d5' : colors[layout.names.indexOf(name) % colors.length]
  const cursor = (event: PointerEvent<SVGElement>): Point => {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const result = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: result.x, y: result.y }
  }
  const constrain = (key: string, p: Point) => ({ x: Math.max(key.startsWith('node:') ? 35 : 110, Math.min(key.startsWith('node:') ? 965 : 890, p.x)), y: Math.max(55, Math.min(layout.height - 65, p.y)) })
  function begin(event: PointerEvent<SVGGElement>, key: string, p: Point) {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const local = cursor(event)
    drag.current = { key, offset: { x: local.x - p.x, y: local.y - p.y } }
    if (key.startsWith('node:')) setSelected(key.slice(5))
  }
  function moveWithKeyboard(event: KeyboardEvent<SVGGElement>, key: string, p: Point) {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!delta) return
    event.preventDefault()
    const step = event.shiftKey ? 25 : 10
    setPositions(old => ({ ...old, [key]: constrain(key, { x: p.x + delta[0] * step, y: p.y + delta[1] * step }) }))
  }
  const connectionCount = selected === null ? 0 : components.reduce((n, c) => n + Number(c.a === selected) + Number(c.b === selected), 0)
  return <div className="readable-circuit">
    <div className="circuit-toolbar"><div><strong>Mapa de conexiones</strong><p>Un color identifica cada nodo y todos sus cables.</p></div><button onClick={() => { setPositions({}); setSelected(null) }}>Ordenar diagrama</button></div>
    <div className="node-legend" aria-label="Resaltar conexiones por nodo">{layout.names.map(name => <button key={name} aria-pressed={selected === name} onClick={() => setSelected(old => old === name ? null : name)} style={{ borderColor: nodeColor(name) }}><span style={{ background: nodeColor(name) }} />{name === '0' ? '0 · Tierra' : `Nodo ${name}`}</button>)}</div>
    <p className="circuit-selection" aria-live="polite">{selected !== null ? `${selected === '0' ? 'Tierra' : `Nodo ${selected}`}: ${connectionCount} terminales conectados. Pulsa su etiqueta otra vez para mostrar toda la red.` : 'Arrastra bloques y nodos. Selecciona un nodo para seguir sus conexiones.'}</p>
    <svg ref={svg} className="circuit-editor readable-canvas" viewBox={`0 0 ${WIDTH} ${layout.height}`} role="group" aria-label="Diagrama interactivo de circuito" onPointerMove={event => {
      if (!drag.current) return
      const p = cursor(event), current = drag.current
      setPositions(old => ({ ...old, [current.key]: constrain(current.key, { x: p.x - current.offset.x, y: p.y - current.offset.y }) }))
    }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
      <defs><pattern id="circuit-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#55758b" opacity=".23" /></pattern></defs>
      <rect width={WIDTH} height={layout.height} fill="url(#circuit-dots)" />
      {components.flatMap(c => (['a', 'b'] as const).map((terminal, index) => {
        const block = point(`block:${c.id}`, layout.blocks[c.id]), node = nodePoint(c[terminal])
        const x = block.x + (index === 0 ? -75 : 75)
        // Route terminals to their shared node rail, keeping the preset branches legible.

        const d = `M ${x} ${block.y} H ${node.x} V ${node.y}`
        return <g key={`${c.id}/${terminal}`} opacity={selected === null || selected === c[terminal] ? 1 : 0.13} className="circuit-wire"><path d={d} stroke="#0b1823" strokeWidth="8" fill="none" /><path d={d} stroke={nodeColor(c[terminal])} strokeWidth="2.5" strokeLinejoin="round" fill="none" /></g>
      }))}
      {components.map(c => {
        const p = point(`block:${c.id}`, layout.blocks[c.id])
        return <g key={c.id} transform={`translate(${p.x},${p.y})`} tabIndex={0} role="button" aria-label={`Mover ${c.id}. Usa las flechas del teclado.`} className="circuit-block" onPointerDown={e => begin(e, `block:${c.id}`, p)} onKeyDown={e => moveWithKeyboard(e, `block:${c.id}`, p)}>
          <rect x="-82" y="-44" width="164" height="88" rx="12" fill="#142b3b" stroke="#52748b" strokeWidth="1.5" />
          <text y="-25" textAnchor="middle" className="circuit-block-title">{c.id} · {c.value} {c.kind === 'resistor' ? 'Ω' : 'V'}</text>
          <path d={c.kind === 'resistor' ? 'M-75 0 H-46 l8 -10 12 20 12 -20 12 20 12 -20 12 20 8 -10 H75' : 'M-75 0 H-21 M21 0 H75'} fill="none" stroke={c.kind === 'resistor' ? '#ffdb8a' : '#88bbff'} strokeWidth="3" />
          {c.kind === 'source' && <><circle r="21" fill="#10232f" stroke="#88bbff" strokeWidth="2" /><text x="-13" y="5" fill="#b8d5ff" fontSize="15">+ −</text></>}
          <circle cx="-75" r="5" fill={nodeColor(c.a)} stroke="#0b1823" strokeWidth="2" /><circle cx="75" r="5" fill={nodeColor(c.b)} stroke="#0b1823" strokeWidth="2" />
          <text x="-70" y="31" fontSize="11" fill={nodeColor(c.a)}>A · {c.a}</text><text x="70" y="31" textAnchor="end" fontSize="11" fill={nodeColor(c.b)}>B · {c.b}</text>
        </g>
      })}
      {layout.names.map(name => {
        const p = nodePoint(name), voltage = nodeVoltages?.[name]
        return <g key={name} transform={`translate(${p.x},${p.y})`} tabIndex={0} role="button" aria-label={`Mover nodo ${name}. Usa las flechas del teclado.`} aria-pressed={selected === name} className="movable-node" onPointerDown={event => begin(event, `node:${name}`, p)} onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(old => old === name ? null : name) }
          else moveWithKeyboard(event, `node:${name}`, p)
        }}>
          <circle r="20" fill="#0d1c29" stroke={nodeColor(name)} strokeWidth={selected === name ? 3 : 1.5} /><circle r="7" fill={nodeColor(name)} />
          <rect x="-54" y="24" width="108" height={voltage === undefined ? 25 : 42} rx="8" fill="#0c1c28" stroke={nodeColor(name)} strokeOpacity=".6" />
          <text y="40" textAnchor="middle" fill={nodeColor(name)} fontSize="12">{name === '0' ? '⏚ Tierra · 0' : `Nodo ${name}`}</text>
          {voltage !== undefined && <text y="56" textAnchor="middle" fill="#e4eff6" fontSize="11">{Number(voltage.toPrecision(5))} V</text>}
        </g>
      })}
      {!components.length && <text x="500" y="220" textAnchor="middle" fill="#a6bdcb" fontSize="17">Agrega una fuente y un resistor o elige un ejemplo.</text>}
    </svg>
    <p className="muted">Círculo grande = nodo compartido. Punto en un bloque = terminal. Moverlos solo cambia el dibujo; las conexiones se editan en el panel izquierdo. También puedes usar Tab y las flechas.</p>
  </div>
}

