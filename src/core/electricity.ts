export interface Vec {
  x: number;
  y: number;
  z: number;
}
export interface Charge {
  id: string;
  q: number;
  position: Vec;
}
export const K = 8.9875517923e9;
export const MAX_CHARGES = 10;
export const MIN_DISTANCE = 0.08;
export function addCharge(charges: Charge[], charge: Charge) {
  if (charges.length >= MAX_CHARGES) throw new Error("Máximo 10 cargas");
  return [...charges, charge];
}
export function fieldAt(point: Vec, charges: Charge[]) {
  if (
    charges.length > MAX_CHARGES ||
    ![
      point.x,
      point.y,
      point.z,
      ...charges.flatMap((c) => [
        c.q,
        c.position.x,
        c.position.y,
        c.position.z,
      ]),
    ].every(Number.isFinite)
  )
    return {
      ok: false as const,
      message: "Entradas inválidas: usa números finitos y máximo diez cargas.",
    };
  const field = { x: 0, y: 0, z: 0 };
  let potential = 0;
  for (const c of charges) {
    if (c.q === 0) continue;
    const dx = point.x - c.position.x,
      dy = point.y - c.position.y,
      dz = point.z - c.position.z;
    const r = Math.hypot(dx, dy, dz);
    if (r < MIN_DISTANCE)
      return {
        ok: false as const,
        message: "Consulta a menos de 0.08 m de una carga. Mueve el punto P.",
      };
    const factor = (K * c.q) / r / r / r;
    field.x += factor * dx;
    field.y += factor * dy;
    field.z += factor * dz;
    potential += (K * c.q) / r;
  }
  const magnitude = Math.hypot(field.x, field.y, field.z);
  if (![field.x, field.y, field.z, potential, magnitude].every(Number.isFinite))
    return {
      ok: false as const,
      message: "Resultado fuera del rango numérico. Reduce las magnitudes.",
    };
  return { ok: true as const, field, potential, magnitude };
}
