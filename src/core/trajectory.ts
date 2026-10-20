import { fieldAt, MAX_CHARGES } from "./electricity";
import type { Charge, Vec } from "./electricity";
export interface ParticleConfig {
  chargeC: number;
  massKg: number;
  position: Vec;
  velocity: Vec;
}
export interface MotionState {
  time: number;
  position: Vec;
  velocity: Vec;
}
export type StopReason =
  | "MAX_TIME"
  | "OUT_OF_BOUNDS"
  | "NEAR_CHARGE"
  | "MAX_STEPS"
  | "INVALID_STATE";
export const DT = 0.002;
export const MAX_TIME = 20;
export const MAX_STEPS = 10000;
export const DOMAIN = 10;
const finite = (v: Vec) => [v.x, v.y, v.z].every(Number.isFinite);
const add = (a: Vec, b: Vec, scale: number): Vec => ({
  x: a.x + b.x * scale,
  y: a.y + b.y * scale,
  z: a.z + b.z * scale,
});
class Halt extends Error {
  reason: StopReason;
  constructor(reason: StopReason) {
    super(reason);
    this.reason = reason;
  }
}
export function validateParticle(config: ParticleConfig): string | null {
  if (!Number.isFinite(config.massKg) || config.massKg <= 0)
    return "La masa debe ser positiva y finita.";
  if (
    !Number.isFinite(config.chargeC) ||
    !finite(config.position) ||
    !finite(config.velocity)
  )
    return "La configuración debe contener números finitos.";
  return null;
}
export function initialMotion(config: ParticleConfig): MotionState {
  return {
    time: 0,
    position: { ...config.position },
    velocity: { ...config.velocity },
  };
}
/** Classical RK4 for the coupled position/velocity system. */
export function rk4Step(
  state: MotionState,
  dt: number,
  acceleration: (position: Vec) => Vec,
): MotionState {
  if (
    !Number.isFinite(dt) ||
    dt <= 0 ||
    !Number.isFinite(state.time) ||
    !finite(state.position) ||
    !finite(state.velocity)
  )
    throw new Halt("INVALID_STATE");
  const derivative = (position: Vec, velocity: Vec) => {
    if (!finite(position) || !finite(velocity)) throw new Halt("INVALID_STATE");
    const a = acceleration(position);
    if (!finite(a)) throw new Halt("INVALID_STATE");
    return { r: velocity, v: a };
  };
  const a = derivative(state.position, state.velocity);
  const b = derivative(
    add(state.position, a.r, dt / 2),
    add(state.velocity, a.v, dt / 2),
  );
  const c = derivative(
    add(state.position, b.r, dt / 2),
    add(state.velocity, b.v, dt / 2),
  );
  const d = derivative(
    add(state.position, c.r, dt),
    add(state.velocity, c.v, dt),
  );
  const weighted = (key: "r" | "v"): Vec => ({
    x: (a[key].x + 2 * b[key].x + 2 * c[key].x + d[key].x) / 6,
    y: (a[key].y + 2 * b[key].y + 2 * c[key].y + d[key].y) / 6,
    z: (a[key].z + 2 * b[key].z + 2 * c[key].z + d[key].z) / 6,
  });
  const next = {
    time: state.time + dt,
    position: add(state.position, weighted("r"), dt),
    velocity: add(state.velocity, weighted("v"), dt),
  };
  if (
    !finite(next.position) ||
    !finite(next.velocity) ||
    !Number.isFinite(next.time)
  )
    throw new Halt("INVALID_STATE");
  return next;
}
function nearCharge(point: Vec, charges: Charge[]) {
  return charges.some(
    (c) =>
      c.q !== 0 &&
      Math.hypot(
        point.x - c.position.x,
        point.y - c.position.y,
        point.z - c.position.z,
      ) <= 0.08,
  );
}
function outside(point: Vec) {
  return (
    Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) > DOMAIN
  );
}
function crossesCharge(from: Vec, to: Vec, charges: Charge[]) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  return charges.some((c) => {
    if (c.q === 0) return false;
    const t =
      length2 === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((c.position.x - from.x) * dx +
                (c.position.y - from.y) * dy +
                (c.position.z - from.z) * dz) /
                length2,
            ),
          );
    return (
      Math.hypot(
        from.x + t * dx - c.position.x,
        from.y + t * dy - c.position.y,
        from.z + t * dz - c.position.z,
      ) <= 0.08
    );
  });
}
export function advanceParticle(
  state: MotionState,
  config: ParticleConfig,
  charges: Charge[],
  steps: number,
  dt = DT,
): { state: MotionState; reason?: StopReason } {
  if (
    validateParticle(config) ||
    !Number.isFinite(state.time) ||
    state.time < 0 ||
    !finite(state.position) ||
    !finite(state.velocity) ||
    !Number.isFinite(dt) ||
    dt <= 0 ||
    !Number.isInteger(steps) ||
    steps < 0 ||
    charges.length > MAX_CHARGES ||
    charges.some((c) => !Number.isFinite(c.q) || !finite(c.position))
  )
    return { state, reason: "INVALID_STATE" };
  if (outside(state.position)) return { state, reason: "OUT_OF_BOUNDS" };
  if (nearCharge(state.position, charges))
    return { state, reason: "NEAR_CHARGE" };
  if (state.time >= MAX_TIME - 1e-10) return { state, reason: "MAX_TIME" };
  if (steps >= MAX_STEPS) return { state, reason: "MAX_STEPS" };
  try {
    const next = rk4Step(
      state,
      Math.min(dt, MAX_TIME - state.time),
      (position) => {
        if (nearCharge(position, charges)) throw new Halt("NEAR_CHARGE");
        if (config.chargeC === 0) return { x: 0, y: 0, z: 0 };
        const field = fieldAt(position, charges);
        if (!field.ok) throw new Halt("INVALID_STATE");
        const factor = config.chargeC / config.massKg;
        return {
          x: factor * field.field.x,
          y: factor * field.field.y,
          z: factor * field.field.z,
        };
      },
    );
    if (crossesCharge(state.position, next.position, charges))
      return { state, reason: "NEAR_CHARGE" };
    if (outside(next.position)) return { state, reason: "OUT_OF_BOUNDS" };
    return {
      state: next,
      reason:
        next.time >= MAX_TIME - 1e-10
          ? "MAX_TIME"
          : steps + 1 >= MAX_STEPS
            ? "MAX_STEPS"
            : undefined,
    };
  } catch (error) {
    return {
      state,
      reason: error instanceof Halt ? error.reason : "INVALID_STATE",
    };
  }
}
