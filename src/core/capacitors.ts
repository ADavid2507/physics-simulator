export const EPSILON_0 = 8.8541878128e-12;
export interface CapacitorConfig {
  areaM2: number;
  distanceM: number;
  relativePermittivity: number;
  voltageV: number;
}
export function calculateCapacitor(config: CapacitorConfig) {
  const {
    areaM2: area,
    distanceM: distance,
    relativePermittivity: kappa,
    voltageV: voltage,
  } = config;
  if (
    ![area, distance, kappa, voltage].every(Number.isFinite) ||
    area <= 0 ||
    distance <= 0 ||
    kappa <= 0
  ) {
    return {
      ok: false as const,
      message:
        "Área, distancia y permitividad deben ser positivas. Todos los valores deben ser finitos.",
    };
  }
  const capacitanceF = (EPSILON_0 * kappa * area) / distance;
  const storedChargeC = capacitanceF * voltage;
  const storedEnergyJ = 0.5 * capacitanceF * voltage * voltage;
  const electricFieldVm = voltage / distance;
  if (
    ![capacitanceF, storedChargeC, storedEnergyJ, electricFieldVm].every(
      Number.isFinite,
    ) ||
    capacitanceF <= 0
  ) {
    return {
      ok: false as const,
      message: "Las magnitudes exceden el rango numérico del modelo.",
    };
  }
  return {
    ok: true as const,
    capacitanceF,
    storedChargeC,
    storedEnergyJ,
    electricFieldVm,
  };
}
