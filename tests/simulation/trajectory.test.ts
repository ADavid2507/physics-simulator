import { describe, expect, it } from "vitest";
import {
  advanceParticle,
  DT,
  initialMotion,
  MAX_STEPS,
  MAX_TIME,
  rk4Step,
  validateParticle,
} from "../../src/core/trajectory";
import type { ParticleConfig } from "../../src/core/trajectory";
import type { Charge } from "../../src/core/electricity";
const config: ParticleConfig = {
  chargeC: 1e-6,
  massKg: 0.001,
  position: { x: 0, y: 2, z: 0 },
  velocity: { x: 0.5, y: 0, z: 0 },
};
const charges: Charge[] = [
  { id: "a", q: 1e-6, position: { x: 0, y: 0, z: 0 } },
];
const zero = { x: 0, y: 0, z: 0 };
describe("RK4 y movimiento de partículas", () => {
  it("reproduce movimiento uniforme en tres ejes", () => {
    let state = {
      time: 0,
      position: { x: 1, y: -2, z: 3 },
      velocity: { x: 2, y: -3, z: 4 },
    };
    for (let i = 0; i < 100; i++) state = rk4Step(state, 0.01, () => zero);
    expect(state.position.x).toBeCloseTo(3, 11);
    expect(state.position.y).toBeCloseTo(-5, 11);
    expect(state.position.z).toBeCloseTo(7, 11);
    expect(state.time).toBeCloseTo(1, 12);
  });
  it("reproduce la solución con aceleración constante", () => {
    let state = { time: 0, position: zero, velocity: { x: 2, y: 0, z: 0 } };
    for (let i = 0; i < 100; i++)
      state = rk4Step(state, 0.01, () => ({ x: 3, y: -2, z: 0 }));
    expect(state.position.x).toBeCloseTo(3.5, 11);
    expect(state.position.y).toBeCloseTo(-1, 11);
    expect(state.velocity.x).toBeCloseTo(5, 11);
    expect(state.velocity.y).toBeCloseTo(-2, 11);
  });
  it("evalúa aceleración dependiente de la posición en etapas y converge", () => {
    const integrate = (dt: number) => {
      let state = { time: 0, position: { x: 1, y: 0, z: 0 }, velocity: zero };
      for (let i = 0; i < Math.round(1 / dt); i++)
        state = rk4Step(state, dt, (p) => ({ x: -p.x, y: 0, z: 0 }));
      return Math.abs(state.position.x - Math.cos(1));
    };
    expect(integrate(0.05)).toBeLessThan(integrate(0.1) / 10);
  });
  it("es determinista y no modifica las entradas", () => {
    const state = initialMotion(config),
      before = structuredClone(state);
    expect(advanceParticle(state, config, charges, 0)).toEqual(
      advanceParticle(state, config, charges, 0),
    );
    expect(state).toEqual(before);
  });
  it("una partícula positiva se aleja de una fuente positiva y una negativa se acerca", () => {
    const positive = advanceParticle(initialMotion(config), config, charges, 0);
    const negativeConfig = { ...config, chargeC: -config.chargeC };
    const negative = advanceParticle(
      initialMotion(negativeConfig),
      negativeConfig,
      charges,
      0,
    );
    expect(positive.state.velocity.y).toBeGreaterThan(0);
    expect(negative.state.velocity.y).toBeLessThan(0);
  });
  it("sin cargas, la partícula se mueve uniformemente", () => {
    const r = advanceParticle(initialMotion(config), config, [], 0);
    expect(r.state.position.x).toBeCloseTo(config.velocity.x * DT, 12);
    expect(r.state.position.y).toBe(2);
  });
  it("detiene consultas y etapas cercanas a una fuente sin producir NaN", () => {
    const near = { ...config, position: { x: 0.01, y: 0, z: 0 } };
    const r = advanceParticle(initialMotion(near), near, charges, 0);
    expect(r.reason).toBe("NEAR_CHARGE");
    expect(r.state).toEqual(initialMotion(near));
    const approaching = {
      ...config,
      chargeC: 0,
      position: { x: 0.09, y: 0, z: 0 },
      velocity: { x: -10, y: 0, z: 0 },
    };
    expect(
      advanceParticle(initialMotion(approaching), approaching, charges, 0)
        .reason,
    ).toBe("NEAR_CHARGE");
  });
  it("no atraviesa una carga entre muestras de RK4", () => {
    const fast = {
      ...config,
      chargeC: 0,
      position: { x: -0.2, y: 0, z: 0 },
      velocity: { x: 400, y: 0, z: 0 },
    };
    expect(advanceParticle(initialMotion(fast), fast, charges, 0).reason).toBe(
      "NEAR_CHARGE",
    );
  });
  it("conserva el último punto válido al salir del dominio", () => {
    const edge = {
      ...config,
      position: { x: 10, y: 0, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
    };
    const r = advanceParticle(initialMotion(edge), edge, [], 0);
    expect(r.reason).toBe("OUT_OF_BOUNDS");
    expect(r.state.time).toBe(0);
  });
  it("respeta límites de tiempo y pasos", () => {
    expect(
      advanceParticle(
        { ...initialMotion(config), time: MAX_TIME },
        config,
        [],
        0,
      ).reason,
    ).toBe("MAX_TIME");
    expect(
      advanceParticle(initialMotion(config), config, [], MAX_STEPS).reason,
    ).toBe("MAX_STEPS");
    const result = advanceParticle(
      { ...initialMotion(config), time: MAX_TIME - 0.001 },
      config,
      [],
      1,
    );
    expect(result.reason).toBe("MAX_TIME");
    expect(result.state.time).toBe(MAX_TIME);
  });
  it("rechaza masa y datos inválidos", () => {
    for (const massKg of [0, -1, NaN, Infinity]) {
      expect(validateParticle({ ...config, massKg })).not.toBeNull();
      expect(
        advanceParticle(initialMotion(config), { ...config, massKg }, [], 0)
          .reason,
      ).toBe("INVALID_STATE");
    }
    expect(
      advanceParticle(initialMotion(config), config, [], 0, 0).reason,
    ).toBe("INVALID_STATE");
    expect(
      advanceParticle(
        { ...initialMotion(config), velocity: { x: Infinity, y: 0, z: 0 } },
        config,
        [],
        0,
      ).reason,
    ).toBe("INVALID_STATE");
    expect(() =>
      rk4Step(initialMotion(config), 0.1, () => ({ x: NaN, y: 0, z: 0 })),
    ).toThrow();
  });
  it("la trayectoria electrostática converge al reducir dt", () => {
    function simulate(dt: number) {
      let state = initialMotion(config);
      for (let step = 0; step < Math.round(0.4 / dt); step++) {
        const r = advanceParticle(state, config, charges, step, dt);
        if (r.reason) throw new Error(r.reason);
        state = r.state;
      }
      return state.position;
    }
    const reference = simulate(0.001),
      coarse = simulate(0.04),
      fine = simulate(0.02);
    const error = (p: typeof reference) =>
      Math.hypot(p.x - reference.x, p.y - reference.y, p.z - reference.z);
    expect(error(fine)).toBeLessThan(error(coarse) / 8);
  });
});
