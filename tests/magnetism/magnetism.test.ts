import { describe, expect, it } from 'vitest'
import { advanceMagnetic, createMagneticSource, cross, dot, lorentzForce, magneticPreset, MU_0, norm, traceMagneticLine } from '../../src/core/magnetism'
import { initialMotion } from '../../src/core/trajectory'
const zero = { x: 0, y: 0, z: 0 }
describe('Magnetismo y Lorentz', () => {
  it('producto cruz, punto y antisimetría', () => { const a = { x: 1, y: 0, z: 0 }, b = { x: 0, y: 1, z: 0 }; expect(cross(a, b)).toEqual({ x: 0, y: 0, z: 1 }); expect(cross(b, a).z).toBe(-1); expect(dot(a, b)).toBe(0) })
  it('campo uniforme independiente de posición', () => { const source = createMagneticSource({ type: 'uniform', field: { x: 0, y: 0, z: 0.001 } }); expect(source.fieldAt({ x: 2, y: -1, z: 4 })).toEqual({ x: 0, y: 0, z: 0.001 }) })
  it('conductor cumple magnitud y mano derecha para cualquier orientación', () => {
    const wire = createMagneticSource({ type: 'wire', current: 10, position: zero, direction: { x: 0, y: 0, z: 2 } })
    expect(wire.fieldAt({ x: 2, y: 0, z: 4 }).y / (MU_0 * 10 / (4 * Math.PI))).toBeCloseTo(1, 12)
    const tilted = createMagneticSource({ type: 'wire', current: 10, position: zero, direction: { x: 1, y: 0, z: 0 } }); expect(tilted.fieldAt({ x: 0, y: 1, z: 0 }).z).toBeGreaterThan(0)
    expect(() => wire.fieldAt(zero)).toThrow()
  })
  it('dipolo tiene campo axial y ecuatorial analíticos', () => {
    const dipole = createMagneticSource({ type: 'dipole', position: zero, moment: { x: 0, y: 0, z: 10 } })
    expect(dipole.fieldAt({ x: 0, y: 0, z: 1 }).z / 2e-6).toBeCloseTo(1, 12)
    expect(dipole.fieldAt({ x: 1, y: 0, z: 0 }).z / -1e-6).toBeCloseTo(1, 12)
    expect(() => dipole.fieldAt(zero)).toThrow()
  })
  it('Lorentz es nula con v paralela a B y cambia signo con q', () => {
    expect(norm(lorentzForce(2, { x: 0, y: 0, z: 3 }, zero, { x: 0, y: 0, z: 5 }))).toBe(0)
    const f = lorentzForce(2, { x: 3, y: 0, z: 0 }, zero, { x: 0, y: 0, z: 5 }); expect(f.y).toBe(-30)
    expect(lorentzForce(-2, { x: 3, y: 0, z: 0 }, zero, { x: 0, y: 0, z: 5 }).y).toBe(30)
  })
  it('suma simultáneamente E y v×B', () => expect(lorentzForce(2, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 3 })).toEqual({ x: 4, y: -6, z: 0 }))
  it('conserva rapidez y radio y retorna tras un período', () => {
    const config = magneticPreset('circle'), source = createMagneticSource(config.source)
    let state = initialMotion(config.particle), maxRadiusError = 0, maxSpeedError = 0
    const dt = 2 * Math.PI / 4000
    for (let i = 0; i < 4000; i++) {
      const next = advanceMagnetic(state, config.particle, source, zero, dt); expect(next.reason).toBeUndefined(); state = next.state
      maxRadiusError = Math.max(maxRadiusError, Math.abs(Math.hypot(state.position.x - 2, state.position.y) - 1))
      maxSpeedError = Math.max(maxSpeedError, Math.abs(norm(state.velocity) - 1))
    }
    expect(maxRadiusError).toBeLessThan(1e-7); expect(maxSpeedError).toBeLessThan(1e-7)
    expect(state.position.x).toBeCloseTo(1, 7); expect(state.position.y).toBeCloseTo(0, 7)
  })
  it('invierte curvatura con q y conserva velocidad paralela en hélice', () => {
    const a = magneticPreset('circle'), b = magneticPreset('negative'), source = createMagneticSource(a.source)
    expect(advanceMagnetic(initialMotion(a.particle), a.particle, source, zero).state.velocity.x).toBeGreaterThan(0)
    expect(advanceMagnetic(initialMotion(b.particle), b.particle, source, zero).state.velocity.x).toBeLessThan(0)
    const helix = magneticPreset('helix'); const r = advanceMagnetic(initialMotion(helix.particle), helix.particle, source, zero); expect(r.state.velocity.z).toBe(0.2)
  })
  it('detecta lazo cerrado alrededor del conductor', () => {
    const source = createMagneticSource(magneticPreset('wire').source)
    const line = traceMagneticLine({ x: 1, y: 0, z: 0 }, source)
    expect(line.reason).toBe('CLOSED_LOOP'); for (const p of line.points) expect(Math.abs(Math.hypot(p.x, p.y) - 1)).toBeLessThan(0.005)
  })
  it('controla singularidades, pasos excesivos y parámetros inválidos', () => {
    const scenario = magneticPreset('wire'), source = createMagneticSource(scenario.source), p = { ...scenario.particle, position: zero }
    expect(advanceMagnetic(initialMotion(p), p, source, zero).reason).toBe('NEAR_SINGULARITY')
    const strong = createMagneticSource({ type: 'uniform', field: { x: 0, y: 0, z: 1000 } })
    expect(advanceMagnetic(initialMotion(p), p, strong, zero).reason).toBe('STEP_TOO_LARGE')
    expect(() => createMagneticSource({ type: 'wire', direction: zero, position: zero, current: 10 })).toThrow()
    expect(advanceMagnetic(initialMotion(p), { ...p, massKg: 0 }, strong, zero).reason).toBe('INVALID_STATE')
  })
})
