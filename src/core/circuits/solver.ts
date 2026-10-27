export interface CircuitComponent { id: string; kind: 'resistor' | 'source'; a: string; b: string; value: number }
export interface BranchResult { voltage: number; current: number; power: number }
export type CircuitResult = { ok: false; message: string } | { ok: true; nodes: Record<string, number>; branches: Record<string, BranchResult>; totalPower: number; suppliedPower: number; equivalentResistance?: number }
export function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length
  const rows = matrix.map((r, i) => {
    const scale = Math.max(...r.map(Math.abs))
    if (!scale || !Number.isFinite(scale)) throw new Error('Sistema singular: revisa nodos flotantes y fuentes ideales en conflicto.')
    return [...r.map(v => v / scale), rhs[i] / scale]
  })
  for (let k = 0; k < n; k++) {
    let pivot = k
    for (let i = k + 1; i < n; i++) if (Math.abs(rows[i][k]) > Math.abs(rows[pivot][k])) pivot = i
    if (Math.abs(rows[pivot][k]) < 1e-12) throw new Error('Sistema singular: fuentes redundantes, en conflicto o nodos sin referencia.')
    ;[rows[k], rows[pivot]] = [rows[pivot], rows[k]]
    for (let i = k + 1; i < n; i++) {
      const factor = rows[i][k] / rows[k][k]
      for (let j = k; j <= n; j++) rows[i][j] -= factor * rows[k][j]
    }
  }
  const result = Array(n).fill(0) as number[]
  for (let i = n - 1; i >= 0; i--) {
    result[i] = (rows[i][n] - rows[i].slice(i + 1, n).reduce((sum, value, j) => sum + value * result[i + 1 + j], 0)) / rows[i][i]
  }
  if (!result.every(Number.isFinite)) throw new Error('Resultado fuera del rango numérico.')
  for (let i = 0; i < n; i++) {
    const terms = matrix[i].map((value, j) => value * result[j])
    if (Math.abs(terms.reduce((a, b) => a + b, 0) - rhs[i]) > 1e-8 * Math.max(1, Math.abs(rhs[i]), ...terms.map(Math.abs))) throw new Error('Sistema mal condicionado: revisa los valores.')
  }
  return result
}
export function solveCircuit(components: CircuitComponent[]): CircuitResult {
  try {
    if (!components.length) throw new Error('Agrega una fuente y resistores para construir el circuito.')
    if (components.length > 24) throw new Error('Máximo 24 componentes.')
    if (new Set(components.map(c => c.id)).size !== components.length) throw new Error('Identificadores de componentes repetidos.')
    for (const c of components) {
      if (!['resistor', 'source'].includes(c.kind) || !c.a.trim() || !c.b.trim() || !Number.isFinite(c.value) || (c.kind === 'resistor' && c.value <= 0)) throw new Error('Revisa terminales, voltajes finitos y resistencias positivas.')
      if (c.a === c.b) throw new Error(`${c.id}: terminales unidos al mismo nodo; cortocircuito o componente puenteado.`)
    }
    const names = [...new Set(components.flatMap(c => [c.a, c.b]))]
    if (!names.includes('0')) throw new Error('Conecta al menos un terminal al nodo 0 (tierra).')
    if (names.length > 16) throw new Error('Máximo 16 nodos eléctricos.')
    const sources = components.filter(c => c.kind === 'source')
    if (!sources.length) throw new Error('Agrega una fuente DC.')
    const connected = new Set(['0'])
    for (let i = 0; i < names.length; i++) for (const c of components) {
      if (connected.has(c.a)) connected.add(c.b)
      if (connected.has(c.b)) connected.add(c.a)
    }
    if (names.some(n => !connected.has(n))) throw new Error('Hay nodos flotantes: conecta todos los componentes a la red de referencia.')
    if (names.some(n => components.filter(c => c.a === n || c.b === n).length < 2)) throw new Error('Circuito abierto: hay un terminal sin camino de retorno.')
    const nodes = names.filter(n => n !== '0'), size = nodes.length + sources.length
    const A = Array.from({ length: size }, () => Array(size).fill(0) as number[]), z = Array(size).fill(0) as number[]
    const index = (node: string) => nodes.indexOf(node)
    const stamp = (i: number, j: number, value: number) => { if (i >= 0 && j >= 0) A[i][j] += value }
    for (const c of components.filter(c => c.kind === 'resistor')) {
      const a = index(c.a), b = index(c.b), g = 1 / c.value
      stamp(a, a, g); stamp(b, b, g); stamp(a, b, -g); stamp(b, a, -g)
    }
    sources.forEach((c, i) => {
      const row = nodes.length + i, a = index(c.a), b = index(c.b)
      stamp(a, row, 1); stamp(row, a, 1); stamp(b, row, -1); stamp(row, b, -1); z[row] = c.value
    })
    const x = solveLinear(A, z), voltages: Record<string, number> = Object.create(null), branches: Record<string, BranchResult> = Object.create(null)
    voltages['0'] = 0; nodes.forEach((n, i) => { voltages[n] = x[i] })
    for (const c of components) {
      const voltage = voltages[c.a] - voltages[c.b]
      const current = c.kind === 'resistor' ? voltage / c.value : x[nodes.length + sources.indexOf(c)]
      const power = voltage * current
      if (![voltage, current, power].every(Number.isFinite)) throw new Error('Resultado fuera del rango numérico.')
      branches[c.id] = { voltage, current, power }
    }
    const totalPower = components.filter(c => c.kind === 'resistor').reduce((s, c) => s + branches[c.id].power, 0)
    const suppliedPower = -sources.reduce((s, c) => s + branches[c.id].power, 0)
    const equivalentResistance = sources.length === 1 && Math.abs(branches[sources[0].id].current) > 1e-14 ? Math.abs(sources[0].value / branches[sources[0].id].current) : undefined
    return { ok: true, nodes: voltages, branches, totalPower, suppliedPower, equivalentResistance }
  } catch (error) { return { ok: false, message: (error as Error).message } }
}
export function ohmsLaw(voltage: number, resistance: number) {
  if (!Number.isFinite(voltage) || !Number.isFinite(resistance) || resistance <= 0) return null
  const current = voltage / resistance, power = voltage * current
  return [current, power].every(Number.isFinite) ? { current, power } : null
}
export function circuitPreset(name: string): CircuitComponent[] {
  const r = (id: string, a: string, b: string, value: number): CircuitComponent => ({ id, kind: 'resistor', a, b, value })
  const source: CircuitComponent = { id: 'V1', kind: 'source', a: '1', b: '0', value: 12 }
  if (name === 'simple') return [source, r('R1', '1', '0', 6)]
  if (name === 'parallel') return [source, r('R1', '1', '0', 100), r('R2', '1', '0', 200)]
  if (name === 'mixed') return [source, r('R1', '1', '2', 100), r('R2', '2', '0', 200), r('R3', '2', '0', 200)]
  return [source, r('R1', '1', '2', 100), r('R2', '2', '0', 200)]
}
