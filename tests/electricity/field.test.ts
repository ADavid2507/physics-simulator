import { describe, expect, it } from "vitest";
import { addCharge, fieldAt, K } from "../../src/core/electricity";
import type { Charge } from "../../src/core/electricity";
const c = (q = 1e-6, x = 0): Charge => ({
  id: `${q}/${x}`,
  q,
  position: { x, y: 0, z: 0 },
});
function calc(x: number, charges: Charge[]) {
  const r = fieldAt({ x, y: 0, z: 0 }, charges);
  if (!r.ok) throw new Error(r.message);
  return r;
}
describe("Núcleo electrostático", () => {
  it("calcula campo y potencial en SI a un metro", () => {
    const r = calc(1, [c()]);
    expect(r.field.x).toBeCloseTo(K * 1e-6, 8);
    expect(r.field.y).toBe(0);
    expect(r.field.z).toBe(0);
    expect(r.potential).toBeCloseTo(K * 1e-6, 8);
  });
  it("apunta hacia una carga negativa", () =>
    expect(calc(1, [c(-1e-6)]).field.x).toBeLessThan(0));
  it("cancela campo para cargas iguales simétricas", () => {
    const r = calc(0, [c(1e-6, -1), c(1e-6, 1)]);
    expect(r.magnitude).toBe(0);
    expect(r.potential).toBeCloseTo(2 * K * 1e-6, 8);
  });
  it("cancela potencial en el centro de un dipolo", () => {
    const r = calc(0, [c(1e-6, -1), c(-1e-6, 1)]);
    expect(r.potential).toBe(0);
    expect(r.field.x).toBeCloseTo(2 * K * 1e-6, 8);
  });
  it("cumple superposición", () => {
    const a = c(2e-6, -1),
      b = c(-3e-6, 1);
    expect(calc(3, [a, b]).field.x).toBeCloseTo(
      calc(3, [a]).field.x + calc(3, [b]).field.x,
      8,
    );
  });
  it("produce cero sin cargas", () => {
    expect(calc(0, []).magnitude).toBe(0);
    expect(calc(0, []).potential).toBe(0);
  });
  it("controla singularidad y proximidad", () => {
    expect(fieldAt({ x: 0, y: 0, z: 0 }, [c()]).ok).toBe(false);
    expect(fieldAt({ x: 0.01, y: 0, z: 0 }, [c()]).ok).toBe(false);
  });
  it("rechaza la carga once sin mutar el escenario", () => {
    const charges = Array.from({ length: 10 }, () => c());
    expect(() => addCharge(charges, c())).toThrow("10");
    expect(charges).toHaveLength(10);
  });
  it("rechaza valores no finitos y desbordamiento", () => {
    expect(fieldAt({ x: NaN, y: 0, z: 0 }, []).ok).toBe(false);
    expect(fieldAt({ x: 1, y: 0, z: 0 }, [c(Infinity)]).ok).toBe(false);
    expect(fieldAt({ x: 1, y: 0, z: 0 }, [c(Number.MAX_VALUE)]).ok).toBe(false);
  });
});
