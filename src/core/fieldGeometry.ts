import { fieldAt, MAX_CHARGES, MIN_DISTANCE } from "./electricity";
import type { Charge, Vec } from "./electricity";
export const FIELD_BOUND = 5;
export interface FieldLine {
  points: Vec[];
}
export interface ContourSegment {
  a: Vec;
  b: Vec;
  level: number;
}
export interface Contours {
  levels: number[];
  segments: ContourSegment[];
}
const finite = (p: Vec) => [p.x, p.y, p.z].every(Number.isFinite);
function validCharges(charges: Charge[]) {
  return (
    charges.length <= MAX_CHARGES &&
    charges.every((c) => Number.isFinite(c.q) && finite(c.position))
  );
}
const inside = (p: Vec) =>
  finite(p) &&
  Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) <= FIELD_BOUND;
function direction(p: Vec, charges: Charge[], sign: number): Vec | null {
  const r = fieldAt(p, charges);
  if (!r.ok || r.magnitude < 1e-12) return null;
  return {
    x: (sign * r.field.x) / r.magnitude,
    y: (sign * r.field.y) / r.magnitude,
    z: (sign * r.field.z) / r.magnitude,
  };
}
/** Midpoint integration of the normalized field; returned point order follows E. */
export function traceFieldLine(
  seed: Vec,
  charges: Charge[],
  sign = 1,
  maxSteps = 360,
): Vec[] {
  if (
    !validCharges(charges) ||
    !inside(seed) ||
    ![1, -1].includes(sign) ||
    !Number.isInteger(maxSteps) ||
    maxSteps < 1 ||
    maxSteps > 1000
  )
    return [];
  const points: Vec[] = [{ ...seed }];
  const step = 0.045;
  let point = seed;
  for (let i = 0; i < maxSteps; i++) {
    const first = direction(point, charges, sign);
    if (!first) break;
    const middle = {
      x: point.x + (first.x * step) / 2,
      y: point.y + (first.y * step) / 2,
      z: point.z + (first.z * step) / 2,
    };
    const second = direction(middle, charges, sign);
    if (!second) break;
    const next = {
      x: point.x + second.x * step,
      y: point.y + second.y * step,
      z: point.z + second.z * step,
    };
    if (
      !inside(next) ||
      charges.some(
        (c) =>
          c.q !== 0 &&
          Math.hypot(
            next.x - c.position.x,
            next.y - c.position.y,
            next.z - c.position.z,
          ) <=
            MIN_DISTANCE * 1.15,
      )
    )
      break;
    points.push(next);
    point = next;
  }
  return sign < 0 ? points.reverse() : points;
}
export function buildFieldLines(charges: Charge[]): FieldLine[] {
  if (!validCharges(charges)) return [];
  const lines: FieldLine[] = [];
  for (const charge of charges) {
    if (!charge.q) continue;
    for (let i = 0; i < 12; i++) {
      // Eight seeds in XY plus four off-plane seeds expose the spatial field.
      const angle = (2 * Math.PI * (i % 8)) / 8;
      const offset =
        i < 8
          ? { x: Math.cos(angle), y: Math.sin(angle), z: 0 }
          : {
              x: i % 2 ? -0.5 : 0.5,
              y: 0,
              z: i < 10 ? Math.sqrt(0.75) : -Math.sqrt(0.75),
            };
      const seed = {
        x: charge.position.x + 0.18 * offset.x,
        y: charge.position.y + 0.18 * offset.y,
        z: charge.position.z + 0.18 * offset.z,
      };
      const points = traceFieldLine(seed, charges, Math.sign(charge.q));
      if (points.length > 2) lines.push({ points });
    }
  }
  return lines;
}
/** Marching Squares on XY, with a bilinear asymptotic decider for saddle cells. */
export function marchingCell(
  corners: [Vec, Vec, Vec, Vec],
  values: [number, number, number, number],
  level: number,
): ContourSegment[] {
  if (
    !values.every(Number.isFinite) ||
    !Number.isFinite(level) ||
    !corners.every(finite)
  )
    return [];
  // Corners: bottom-left, bottom-right, top-right, top-left. Edges in CCW order.
  const crossings = new Map<number, Vec>();
  for (let edge = 0; edge < 4; edge++) {
    const next = (edge + 1) % 4;
    if (values[edge] > level === values[next] > level) continue;
    const t = (level - values[edge]) / (values[next] - values[edge]);
    const a = corners[edge],
      b = corners[next];
    crossings.set(edge, {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      z: a.z + t * (b.z - a.z),
    });
  }
  const connect = (a: number, b: number): ContourSegment[] => {
    const from = crossings.get(a),
      to = crossings.get(b);
    return from && to && Math.hypot(from.x - to.x, from.y - to.y) > 1e-12
      ? [{ a: from, b: to, level }]
      : [];
  };
  const edges = [...crossings.keys()];
  if (edges.length === 2) return connect(edges[0], edges[1]);
  if (edges.length === 4) {
    const f = values.map((v) => v - level);
    const determinant = f[0] * f[2] - f[1] * f[3];
    return determinant >= 0
      ? [...connect(0, 1), ...connect(2, 3)]
      : [...connect(0, 3), ...connect(1, 2)];
  }
  return [];
}
export function buildEquipotentials(
  charges: Charge[],
  z: number,
  spacing?: number,
  resolution = 64,
): Contours {
  if (
    !validCharges(charges) ||
    !Number.isFinite(z) ||
    Math.abs(z) > FIELD_BOUND ||
    !Number.isInteger(resolution) ||
    resolution < 8 ||
    resolution > 100 ||
    (spacing !== undefined && (!Number.isFinite(spacing) || spacing <= 0))
  )
    return { levels: [], segments: [] };
  if (!charges.some((c) => c.q !== 0)) return { levels: [], segments: [] };
  const delta = (2 * FIELD_BOUND) / resolution;
  const grid = Array.from({ length: resolution + 1 }, (_, y) =>
    Array.from({ length: resolution + 1 }, (_, x) => {
      const point = {
        x: -FIELD_BOUND + x * delta,
        y: -FIELD_BOUND + y * delta,
        z,
      };
      const r = fieldAt(point, charges);
      return { point, value: r.ok ? r.potential : null };
    }),
  );
  const magnitudes = grid
    .flat()
    .flatMap((p) => (p.value === null ? [] : [Math.abs(p.value)]))
    .sort((a, b) => a - b);
  const scale = magnitudes[Math.floor(magnitudes.length * 0.85)] ?? 0;
  if (scale === 0) return { levels: [], segments: [] };
  const step = spacing ?? scale / 3;
  const levels = [-3, -2, -1, 0, 1, 2, 3].map((n) => n * step);
  const segments: ContourSegment[] = [];
  for (let y = 0; y < resolution; y++)
    for (let x = 0; x < resolution; x++) {
      const cell = [
        grid[y][x],
        grid[y][x + 1],
        grid[y + 1][x + 1],
        grid[y + 1][x],
      ] as const;
      if (cell.some((p) => p.value === null)) continue;
      // Exclude an entire cell if its interior intersects a singularity sphere.
      const min = cell[0].point,
        max = cell[2].point;
      if (
        charges.some(
          (c) =>
            c.q !== 0 &&
            Math.hypot(
              c.position.x - Math.max(min.x, Math.min(max.x, c.position.x)),
              c.position.y - Math.max(min.y, Math.min(max.y, c.position.y)),
              c.position.z - z,
            ) <= MIN_DISTANCE,
        )
      )
        continue;
      const points = cell.map((p) => p.point) as [Vec, Vec, Vec, Vec];
      const values = cell.map((p) => p.value!) as [
        number,
        number,
        number,
        number,
      ];
      for (const level of levels)
        segments.push(...marchingCell(points, values, level));
    }
  // Hide levels that have no intersections within the visible plane.
  return {
    levels: levels.filter((level) => segments.some((s) => s.level === level)),
    segments,
  };
}
