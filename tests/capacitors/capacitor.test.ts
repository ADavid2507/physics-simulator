import { describe, expect, it } from "vitest";
import { calculateCapacitor, EPSILON_0 } from "../../src/core/capacitors";
const base = {
  areaM2: 0.01,
  distanceM: 0.002,
  relativePermittivity: 1,
  voltageV: 100,
};
function calc(patch = {}) {
  const result = calculateCapacitor({ ...base, ...patch });
  if (!result.ok) throw new Error(result.message);
  return result;
}
// Ratios prevent small SI quantities from passing loose absolute tolerances.
const ratio = (actual: number, expected: number) =>
  expect(actual / expected).toBeCloseTo(1, 12);
describe("Capacitor ideal de placas paralelas", () => {
  it("calcula valores SI para un caso de referencia", () => {
    const r = calc();
    ratio(r.capacitanceF, EPSILON_0 * 5);
    ratio(r.storedChargeC, EPSILON_0 * 500);
    ratio(r.storedEnergyJ, EPSILON_0 * 25000);
    expect(r.electricFieldVm).toBe(50000);
  });
  it("duplica C al duplicar área", () =>
    ratio(calc({ areaM2: 0.02 }).capacitanceF, 2 * calc().capacitanceF));
  it("divide C y E por dos al duplicar distancia", () => {
    ratio(calc({ distanceM: 0.004 }).capacitanceF, calc().capacitanceF / 2);
    ratio(
      calc({ distanceM: 0.004 }).electricFieldVm,
      calc().electricFieldVm / 2,
    );
  });
  it("multiplica C por κ y mantiene E con voltaje fijo", () => {
    ratio(
      calc({ relativePermittivity: 4 }).capacitanceF,
      4 * calc().capacitanceF,
    );
    expect(calc({ relativePermittivity: 4 }).electricFieldVm).toBe(
      calc().electricFieldVm,
    );
  });
  it("al duplicar V conserva C, cuadruplica U y duplica Q", () => {
    const r = calc({ voltageV: 200 }),
      original = calc();
    expect(r.capacitanceF).toBe(original.capacitanceF);
    ratio(r.storedEnergyJ, 4 * original.storedEnergyJ);
    ratio(r.storedChargeC, 2 * original.storedChargeC);
  });
  it("admite voltaje cero", () => {
    const r = calc({ voltageV: 0 });
    expect(r.storedChargeC).toBe(0);
    expect(r.storedEnergyJ).toBe(0);
    expect(r.electricFieldVm).toBe(0);
    expect(r.capacitanceF).toBeGreaterThan(0);
  });
  it("invierte Q y E sin cambiar energía al invertir polaridad", () => {
    const r = calc({ voltageV: -100 }),
      original = calc();
    expect(r.storedEnergyJ).toBe(original.storedEnergyJ);
    expect(r.storedChargeC).toBe(-original.storedChargeC);
    expect(r.electricFieldVm).toBe(-original.electricFieldVm);
  });
  it.each(["areaM2", "distanceM", "relativePermittivity"] as const)(
    "rechaza %s nula o negativa",
    (key) => {
      for (const n of [0, -1])
        expect(calculateCapacitor({ ...base, [key]: n }).ok).toBe(false);
    },
  );
  it.each(["areaM2", "distanceM", "relativePermittivity", "voltageV"] as const)(
    "rechaza %s no finita",
    (key) => {
      for (const n of [NaN, Infinity, -Infinity])
        expect(calculateCapacitor({ ...base, [key]: n }).ok).toBe(false);
    },
  );
  it("controla desbordamientos", () =>
    expect(calculateCapacitor({ ...base, voltageV: Number.MAX_VALUE }).ok).toBe(
      false,
    ));
});
