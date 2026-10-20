import { describe, expect, it } from "vitest";
import {
  buildEquipotentials,
  buildFieldLines,
  FIELD_BOUND,
  marchingCell,
  traceFieldLine,
} from "../../src/core/fieldGeometry";
import { K, MIN_DISTANCE } from "../../src/core/electricity";
import type { Charge, Vec } from "../../src/core/electricity";
const charge = (q = 1e-6, x = 0): Charge => ({
  id: `${q}/${x}`,
  q,
  position: { x, y: 0, z: 0 },
});
const radius = (p: Vec) => Math.hypot(p.x, p.y, p.z);
const corners: [Vec, Vec, Vec, Vec] = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 1, y: 1, z: 0 },
  { x: 0, y: 1, z: 0 },
];
describe("Líneas de campo", () => {
  it("una carga positiva genera una línea radial hacia afuera", () => {
    const points = traceFieldLine({ x: 0.2, y: 0, z: 0 }, [charge()]);
    expect(points.length).toBeGreaterThan(50);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].x).toBeGreaterThan(points[i - 1].x);
      expect(points[i].y).toBe(0);
      expect(points[i].z).toBe(0);
    }
  });
  it("una carga negativa devuelve puntos orientados hacia la fuente", () => {
    const points = traceFieldLine({ x: 0.2, y: 0, z: 0 }, [charge(-1e-6)], -1);
    expect(points[0].x).toBeGreaterThan(points[points.length - 1].x);
  });
  it("conecta el eje de un dipolo desde positivo hacia negativo", () => {
    const points = traceFieldLine({ x: -0.82, y: 0, z: 0 }, [
      charge(1e-6, -1),
      charge(-1e-6, 1),
    ]);
    expect(points[points.length - 1].x).toBeGreaterThan(0.85);
    for (const p of points) expect(Math.abs(p.y) + Math.abs(p.z)).toBe(0);
  });
  it("respeta dominio, singularidades y máximo de pasos", () => {
    const points = traceFieldLine({ x: 0.2, y: 0, z: 0 }, [charge()], 1, 12);
    expect(points).toHaveLength(13);
    const lines = buildFieldLines([charge()]);
    expect(lines).toHaveLength(12);
    for (const line of lines)
      for (const point of line.points) {
        expect(radius(point)).toBeGreaterThanOrEqual(MIN_DISTANCE);
        expect(
          Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)),
        ).toBeLessThanOrEqual(FIELD_BOUND);
      }
  });
  it("no crea líneas para vacío, cargas nulas o campo cancelado", () => {
    expect(buildFieldLines([])).toEqual([]);
    expect(buildFieldLines([charge(0)])).toEqual([]);
    expect(buildFieldLines([charge(), charge(-1e-6)])).toEqual([]);
  });
  it("limita entradas y no modifica las fuentes", () => {
    const charges = [charge()],
      before = structuredClone(charges);
    expect(traceFieldLine({ x: NaN, y: 0, z: 0 }, charges)).toEqual([]);
    expect(traceFieldLine({ x: 1, y: 0, z: 0 }, charges, 1, Infinity)).toEqual(
      [],
    );
    expect(buildFieldLines(Array.from({ length: 11 }, () => charge()))).toEqual(
      [],
    );
    buildFieldLines(charges);
    expect(charges).toEqual(before);
  });
});
describe("Marching Squares y equipotenciales", () => {
  it("interpola un potencial lineal exactamente", () => {
    const segments = marchingCell(corners, [-1, 1, 1, -1], 0);
    expect(segments).toHaveLength(1);
    expect(segments[0].a.x).toBe(0.5);
    expect(segments[0].b.x).toBe(0.5);
  });
  it("resuelve los dos casos de silla de forma determinista", () => {
    const positive = marchingCell(corners, [2, -1, 2, -1], 0);
    const negative = marchingCell(corners, [1, -2, 1, -2], 0);
    expect(positive).toHaveLength(2);
    expect(negative).toHaveLength(2);
    expect(positive[0].a.y).toBe(0);
    expect(positive[0].b.x).toBe(1);
    expect(negative[0].a.y).toBe(0);
    expect(negative[0].b.x).toBe(0);
    expect(marchingCell(corners, [1, -1, 1, -1], 0)).toEqual(
      marchingCell(corners, [1, -1, 1, -1], 0),
    );
  });
  it("los 16 patrones producen segmentos finitos sin degeneraciones", () => {
    for (let mask = 0; mask < 16; mask++) {
      const values = [0, 1, 2, 3].map((i) => (mask & (1 << i) ? 1 : -1)) as [
        number,
        number,
        number,
        number,
      ];
      for (const s of marchingCell(corners, values, 0)) {
        expect([s.a.x, s.a.y, s.b.x, s.b.y].every(Number.isFinite)).toBe(true);
        expect(Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y)).toBeGreaterThan(0);
      }
    }
  });
  it("una carga produce un contorno aproximadamente circular con radio analítico", () => {
    const level = (K * 1e-6) / 2;
    const contours = buildEquipotentials([charge()], 0, level);
    const circle = contours.segments.filter((s) => s.level === level);
    expect(circle.length).toBeGreaterThan(40);
    for (const s of circle)
      for (const point of [s.a, s.b])
        expect(Math.abs(radius(point) - 2)).toBeLessThan(0.02);
    expect(contours.levels.every((n) => n > 0)).toBe(true);
  });
  it("el dipolo contiene V=0 en la bisectriz y niveles de ambos signos", () => {
    const contours = buildEquipotentials(
      [charge(1e-6, -1), charge(-1e-6, 1)],
      0,
      3000,
    );
    expect(contours.levels.some((n) => n > 0)).toBe(true);
    expect(contours.levels.some((n) => n < 0)).toBe(true);
    const zero = contours.segments.filter((s) => s.level === 0);
    expect(zero.length).toBeGreaterThan(10);
    for (const s of zero) {
      expect(Math.abs(s.a.x)).toBeLessThan(1e-12);
      expect(Math.abs(s.b.x)).toBeLessThan(1e-12);
    }
  });
  it("conserva el plano z seleccionado y excluye la singularidad", () => {
    const contours = buildEquipotentials([charge()], 0.5);
    expect(contours.segments.length).toBeGreaterThan(0);
    for (const s of contours.segments)
      for (const p of [s.a, s.b]) {
        expect(p.z).toBe(0.5);
        expect(radius(p)).toBeGreaterThan(MIN_DISTANCE);
      }
  });
  it("controla escenarios vacíos, inválidos y niveles degenerados", () => {
    expect(buildEquipotentials([], 0).segments).toEqual([]);
    expect(buildEquipotentials([charge(), charge(-1e-6)], 0).segments).toEqual(
      [],
    );
    expect(buildEquipotentials([charge()], NaN).segments).toEqual([]);
    expect(buildEquipotentials([charge()], 0, 0).segments).toEqual([]);
    expect(marchingCell(corners, [0, 0, 0, 0], 0)).toEqual([]);
    expect(marchingCell(corners, [NaN, 1, 2, 3], 0)).toEqual([]);
  });
});
