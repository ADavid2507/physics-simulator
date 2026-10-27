import type { Vec } from './electricity'
import { initialMotion, rk4Step, validateParticle } from './trajectory'
import type { MotionState, ParticleConfig } from './trajectory'
export const MU_0 = 4 * Math.PI * 1e-7
export const MAGNETIC_MIN_DISTANCE = 0.12
export const MAGNETIC_DT = 0.002
export type MagneticConfig = { type: 'uniform'; field: Vec } | { type: 'wire'; current: number; position: Vec; direction: Vec } | { type: 'dipole'; position: Vec; moment: Vec }
export interface MagneticSource { fieldAt: (point: Vec) => Vec }
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z
export const cross = (a: Vec, b: Vec): Vec => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
export const norm = (v: Vec) => Math.hypot(v.x, v.y, v.z)
const scale = (v: Vec, n: number): Vec => ({ x: v.x * n, y: v.y * n, z: v.z * n })
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const subtract = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const finite = (v: Vec) => [v.x, v.y, v.z].every(Number.isFinite)
export class MagneticError extends Error {}
export function createMagneticSource(config: MagneticConfig): MagneticSource {
  if (config.type === 'uniform' && !finite(config.field)) throw new Error('Campo B inválido.')
  if (config.type !== 'uniform' && !finite(config.position)) throw new Error('Posición de fuente inválida.')
  if (config.type === 'wire' && (!Number.isFinite(config.current) || !finite(config.direction) || norm(config.direction) === 0)) throw new Error('La dirección del conductor debe ser un vector no nulo y la corriente finita.')
  if (config.type === 'dipole' && (!finite(config.moment) || norm(config.moment) === 0)) throw new Error('El momento dipolar debe ser un vector no nulo.')
  const raw = (point: Vec): Vec => {
    if (config.type === 'uniform') return { ...config.field }
    const displacement = subtract(point, config.position)
    if (config.type === 'wire') {
      const direction = scale(config.direction, 1 / norm(config.direction))
      const radial = subtract(displacement, scale(direction, dot(displacement, direction)))
      const r = norm(radial)
      if (r < MAGNETIC_MIN_DISTANCE) throw new MagneticError('Punto demasiado cerca del eje del conductor ideal.')
      return scale(cross(direction, radial), MU_0 * config.current / (2 * Math.PI * r * r))
    }
    const r = norm(displacement)
    if (r < MAGNETIC_MIN_DISTANCE) throw new MagneticError('Punto demasiado cerca del dipolo ideal.')
    const unit = scale(displacement, 1 / r)
    return scale(subtract(scale(unit, 3 * dot(config.moment, unit)), config.moment), MU_0 / (4 * Math.PI * r ** 3))
  }
  return { fieldAt: point => {
    if (!finite(point)) throw new Error('Coordenadas inválidas.')
    const result = raw(point)
    if (!finite(result)) throw new Error('Campo fuera del rango numérico.')
    return result
  } }
}
export function lorentzForce(charge: number, velocity: Vec, electric: Vec, magnetic: Vec): Vec {
  if (!Number.isFinite(charge) || ![velocity, electric, magnetic].every(finite)) throw new Error('Valores de Lorentz inválidos.')
  const force = scale(add(electric, cross(velocity, magnetic)), charge)
  if (!finite(force)) throw new Error('Fuerza fuera del rango numérico.')
  return force
}
export type MagneticStop = 'MAX_TIME' | 'OUT_OF_BOUNDS' | 'NEAR_SINGULARITY' | 'INVALID_STATE' | 'STEP_TOO_LARGE'
export function advanceMagnetic(state: MotionState, particle: ParticleConfig, source: MagneticSource, electric: Vec, dt = MAGNETIC_DT): { state: MotionState; reason?: MagneticStop } {
  try {
    if (validateParticle(particle) || !finite(electric) || !Number.isFinite(dt) || dt <= 0 || !finite(state.position) || !finite(state.velocity) || !Number.isFinite(state.time) || state.time < 0) throw new Error('Configuración inválida.')
    if (Math.max(Math.abs(state.position.x), Math.abs(state.position.y), Math.abs(state.position.z)) > 10) return { state, reason: 'OUT_OF_BOUNDS' }
    if (state.time >= 20 - 1e-10) return { state, reason: 'MAX_TIME' }
    const next = rk4Step(state, Math.min(dt, 20 - state.time), (position, velocity) => {
      const b = source.fieldAt(position)
      if (Math.abs(particle.chargeC) * norm(b) / particle.massKg * dt > 0.08) throw new RangeError('Paso demasiado grande para la frecuencia ciclotrón.')
      const acceleration = scale(lorentzForce(particle.chargeC, velocity, electric, b), 1 / particle.massKg)
      if (norm(velocity) * dt + norm(acceleration) * dt * dt > 0.08) throw new RangeError('Desplazamiento por paso demasiado grande.')
      return acceleration
    })
    source.fieldAt(next.position)
    // Inspect the segment as well as RK4 stages to avoid crossing an excluded source.
    for (const t of [0.25, 0.5, 0.75]) source.fieldAt(add(state.position, scale(subtract(next.position, state.position), t)))
    if (Math.max(Math.abs(next.position.x), Math.abs(next.position.y), Math.abs(next.position.z)) > 10) return { state, reason: 'OUT_OF_BOUNDS' }
    return { state: next, reason: next.time >= 20 - 1e-10 ? 'MAX_TIME' : undefined }
  } catch (error) { return { state, reason: error instanceof MagneticError ? 'NEAR_SINGULARITY' : error instanceof RangeError ? 'STEP_TOO_LARGE' : 'INVALID_STATE' } }
}
export interface MagneticLine { points: Vec[]; reason: 'CLOSED_LOOP' | 'OUT_OF_BOUNDS' | 'LOW_FIELD' | 'MAX_STEPS' | 'NEAR_SINGULARITY' }
export function traceMagneticLine(seed: Vec, source: MagneticSource, sign = 1): MagneticLine {
  const points: Vec[] = [{ ...seed }], step = 0.05
  const finish = (reason: MagneticLine['reason']): MagneticLine => ({ points: sign < 0 ? points.reverse() : points, reason })
  if (!finite(seed) || ![1, -1].includes(sign)) return finish('LOW_FIELD')
  try {
    for (let i = 0; i < 700; i++) {
      const p = points[points.length - 1], b = source.fieldAt(p), magnitude = norm(b)
      if (magnitude < 1e-16) return finish('LOW_FIELD')
      const midpoint = add(p, scale(b, sign * step / 2 / magnitude)), bm = source.fieldAt(midpoint), length = norm(bm)
      if (length < 1e-16) return finish('LOW_FIELD')
      const next = add(p, scale(bm, sign * step / length))
      if (Math.max(Math.abs(next.x), Math.abs(next.y), Math.abs(next.z)) > 5) return finish('OUT_OF_BOUNDS')
      source.fieldAt(next)
      points.push(next)
      if (i > 25 && norm(subtract(next, seed)) < step * 1.2) { points.push({ ...seed }); return finish('CLOSED_LOOP') }
    }
    return finish('MAX_STEPS')
  } catch { return finish('NEAR_SINGULARITY') }
}
export function magneticLines(config: MagneticConfig, source: MagneticSource): MagneticLine[] {
  const seeds: Vec[] = []
  if (config.type === 'wire') {
    const axis = scale(config.direction, 1 / norm(config.direction))
    const perpendicular = cross(axis, Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 })
    const unit = scale(perpendicular, 1 / norm(perpendicular))
    for (const radius of [0.6, 1.2, 2, 3]) for (const height of [-1, 0, 1]) seeds.push(add(config.position, add(scale(unit, radius), scale(axis, height))))
  } else if (config.type === 'dipole') {
    const axis = scale(config.moment, 1 / norm(config.moment)), p = cross(axis, Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 }), u = scale(p, 1 / norm(p)), v = cross(axis, u)
    for (const radius of [0.6, 1.2, 2]) for (let i = 0; i < 6; i++) seeds.push(add(config.position, add(scale(u, radius * Math.cos(i * Math.PI / 3)), scale(v, radius * Math.sin(i * Math.PI / 3)))))
  } else for (const x of [-2, 0, 2]) for (const y of [-2, 0, 2]) seeds.push({ x, y, z: 0 })
  return seeds.map(seed => {
    const forward = traceMagneticLine(seed, source)
    if (forward.reason === 'CLOSED_LOOP') return forward
    const backward = traceMagneticLine(seed, source, -1)
    return { ...forward, points: [...backward.points.slice(0, -1), ...forward.points] }
  }).filter(line => line.points.length > 2)
}
export function magneticPreset(name: string): { source: MagneticConfig; electric: Vec; particle: ParticleConfig } {
  const source: MagneticConfig = name === 'wire' ? { type: 'wire', current: 1000, position: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } } : name === 'dipole' ? { type: 'dipole', position: { x: 0, y: 0, z: 0 }, moment: { x: 0, y: 0, z: 10000 } } : { type: 'uniform', field: { x: 0, y: 0, z: 0.001 } }
  return { source, electric: name === 'crossed' ? { x: 0.001, y: 0, z: 0 } : { x: 0, y: 0, z: 0 }, particle: { chargeC: name === 'negative' ? -1e-6 : 1e-6, massKg: 1e-9, position: { x: 1, y: 0, z: 0 }, velocity: { x: 0, y: 1, z: name === 'helix' ? 0.2 : 0 } } }
}
export { initialMotion }
