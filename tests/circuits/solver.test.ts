import { describe, expect, it } from 'vitest'
import { circuitPreset, ohmsLaw, solveCircuit } from '../../src/core/circuits/solver'
import type { CircuitComponent } from '../../src/core/circuits/solver'
function solve(c = circuitPreset('series')) { const r = solveCircuit(c); if (!r.ok) throw new Error(r.message); return r }
describe('Circuitos DC por MNA', () => {
  it('resuelve fuente de 12 V con resistor de 6 Ω', () => { const s = solve(circuitPreset('simple')); expect(s.branches.R1.current).toBeCloseTo(2, 12); expect(s.totalPower).toBeCloseTo(24, 12); expect(s.branches.V1.power).toBeCloseTo(-24, 12) })
  it('resuelve serie con divisiones de voltaje analíticas', () => { const s = solve(); expect(s.equivalentResistance).toBeCloseTo(300, 10); expect(s.branches.R1.current).toBeCloseTo(0.04, 12); expect(s.branches.R1.voltage).toBeCloseTo(4, 12); expect(s.branches.R2.voltage).toBeCloseTo(8, 12) })
  it('resuelve paralelo', () => { const s = solve(circuitPreset('parallel')); expect(s.branches.R1.current).toBeCloseTo(0.12, 12); expect(s.branches.R2.current).toBeCloseTo(0.06, 12); expect(s.branches.V1.current).toBeCloseTo(-0.18, 12) })
  it('resuelve circuito mixto y verifica KCL, KVL y potencia', () => {
    const c = circuitPreset('mixed'), s = solve(c)
    expect(s.equivalentResistance).toBeCloseTo(200, 10)
    expect(s.branches.R1.current).toBeCloseTo(0.06, 12)
    expect(s.branches.R2.current).toBeCloseTo(0.03, 12)
    for (const node of Object.keys(s.nodes)) {
      const net = c.reduce((sum, branch) => sum + (branch.a === node ? s.branches[branch.id].current : 0) - (branch.b === node ? s.branches[branch.id].current : 0), 0)
      expect(net).toBeCloseTo(0, 12)
    }
    expect(s.branches.R1.voltage + s.branches.R2.voltage).toBeCloseTo(12, 12)
    expect(s.totalPower).toBeCloseTo(s.suppliedPower, 12)
  })
  it('resuelve un puente arbitrario sin clasificar serie o paralelo', () => {
    const c = circuitPreset('series'); c[2].b = '3'
    c.push({ id: 'R3', kind: 'resistor', a: '1', b: '3', value: 200 }, { id: 'R4', kind: 'resistor', a: '2', b: '0', value: 100 }, { id: 'R5', kind: 'resistor', a: '3', b: '0', value: 200 })
    const s = solve(c); expect(s.nodes['2']).toBeCloseTo(6, 10); expect(s.nodes['3']).toBeCloseTo(6, 10); expect(s.branches.R2.current).toBeCloseTo(0, 12)
  })
  it('soporta múltiples fuentes y polaridad invertida', () => {
    const c: CircuitComponent[] = [{ id: 'V1', kind: 'source', a: '1', b: '0', value: 12 }, { id: 'V2', kind: 'source', a: '2', b: '0', value: 5 }, { id: 'R', kind: 'resistor', a: '1', b: '2', value: 7 }]
    expect(solve(c).branches.R.current).toBeCloseTo(1, 12)
    const inverted = circuitPreset('simple'); inverted[0].value = -12; expect(solve(inverted).branches.R1.current).toBeCloseTo(-2, 12)
  })
  it('rechaza fuentes en conflicto y cortocircuitos', () => {
    const c = circuitPreset('simple'); c.push({ id: 'V2', kind: 'source', a: '1', b: '0', value: 5 }); expect(solveCircuit(c).ok).toBe(false)
    c.pop(); c[0].b = '1'; expect(solveCircuit(c).ok).toBe(false)
  })
  it('rechaza circuito abierto, nodo flotante, R inválida y datos no finitos', () => {
    expect(solveCircuit([circuitPreset('simple')[0]]).ok).toBe(false)
    const c = circuitPreset('simple'); c.push({ id: 'R2', kind: 'resistor', a: 'x', b: 'y', value: 10 }); expect(solveCircuit(c).ok).toBe(false)
    for (const value of [0, -1, Infinity, NaN]) { const bad = circuitPreset('simple'); bad[1].value = value; expect(solveCircuit(bad).ok).toBe(false) }
  })
  it('preserva las entradas y calcula Ley de Ohm', () => {
    const c = circuitPreset('series'), copy = structuredClone(c); solve(c); expect(c).toEqual(copy)
    expect(ohmsLaw(12, 6)).toEqual({ current: 2, power: 24 }); expect(ohmsLaw(12, 0)).toBeNull()
  })
})
