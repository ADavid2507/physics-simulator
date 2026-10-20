import { useState } from "react";
import type { useTrajectory } from "./useTrajectory";
import { DOMAIN, DT, MAX_TIME, validateParticle } from "../core/trajectory";
import type { StopReason } from "../core/trajectory";
const axes = ["x", "y", "z"] as const;
const reasons: Record<StopReason, string> = {
  MAX_TIME: "Se alcanzó el tiempo máximo.",
  OUT_OF_BOUNDS: "La partícula alcanzó el límite del dominio.",
  NEAR_CHARGE: "La partícula se acercó a menos de 0.08 m de una carga.",
  MAX_STEPS: "Se alcanzó el máximo de pasos.",
  INVALID_STATE: "Estado numérico inválido: revisa las magnitudes.",
};
function Input({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid =
    draft !== null &&
    (!draft.trim() ||
      !Number.isFinite(Number(draft)) ||
      Number(draft) < min ||
      Number(draft) > max);
  return (
    <label className="number-label">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step="any"
        value={draft ?? value}
        aria-invalid={invalid}
        onChange={(event) => {
          const text = event.target.value,
            n = Number(text);
          setDraft(text);
          if (text.trim() && Number.isFinite(n) && n >= min && n <= max)
            onChange(n);
        }}
        onBlur={() => setDraft(null)}
      />
      {invalid && (
        <span className="input-error">
          Usa un valor entre {min} y {max}. Se conserva el anterior.
        </span>
      )}
    </label>
  );
}
export function ParticlePanel({
  simulation,
}: {
  simulation: ReturnType<typeof useTrajectory>;
}) {
  const { config, configure, run, start, pause, reset } = simulation;
  const current = run.points[run.points.length - 1];
  const labels = {
    READY: "Preparada",
    RUNNING: "En ejecución",
    PAUSED: "En pausa",
    COMPLETED: "Finalizada",
    ERROR: "Error numérico",
  };
  const error = validateParticle(config);
  return (
    <section className="panel particle-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">DINÁMICA · RK4</span>
          <h2>Partícula de prueba</h2>
        </div>
        <span className="badge">{labels[run.status]}</span>
      </div>
      <p className="muted">
        La esfera violeta y su recorrido representan una partícula que no altera
        las cargas fuente. Cambiar su configuración o las cargas reinicia la
        trayectoria.
      </p>
      <div className="particle-fields">
        <div>
          <h3>Propiedades</h3>
          <Input
            label="Carga de partícula (μC)"
            value={config.chargeC * 1e6}
            min={-100}
            max={100}
            onChange={(value) =>
              configure({ ...config, chargeC: value * 1e-6 })
            }
          />
          <Input
            label="Masa (g)"
            value={config.massKg * 1000}
            min={0.001}
            max={10000}
            onChange={(value) => configure({ ...config, massKg: value * 1e-3 })}
          />
        </div>
        <div>
          <h3>Posición inicial (m)</h3>
          <div className="coordinates">
            {axes.map((axis) => (
              <Input
                key={axis}
                label={`r₀ ${axis} (m)`}
                value={config.position[axis]}
                min={-DOMAIN}
                max={DOMAIN}
                onChange={(value) =>
                  configure({
                    ...config,
                    position: { ...config.position, [axis]: value },
                  })
                }
              />
            ))}
          </div>
          <p className="muted">
            Dominio: −{DOMAIN} a {DOMAIN} m en cada eje.
          </p>
        </div>
        <div>
          <h3>Velocidad inicial (m/s)</h3>
          <div className="coordinates">
            {axes.map((axis) => (
              <Input
                key={axis}
                label={`v₀ ${axis} (m/s)`}
                value={config.velocity[axis]}
                min={-100}
                max={100}
                onChange={(value) =>
                  configure({
                    ...config,
                    velocity: { ...config.velocity, [axis]: value },
                  })
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="particle-actions">
        <button
          className="primary"
          disabled={
            !!error ||
            run.status === "RUNNING" ||
            run.status === "COMPLETED" ||
            run.status === "ERROR"
          }
          onClick={start}
        >
          {run.status === "PAUSED" ? "Continuar" : "Iniciar"}
        </button>
        <button disabled={run.status !== "RUNNING"} onClick={pause}>
          Pausar
        </button>
        <button onClick={reset}>Reiniciar trayectoria</button>
        <span>
          t = {current.time.toFixed(3)} s · {run.steps} pasos
        </span>
      </div>
      <p className="muted">
        Posición actual: (
        {axes.map((axis) => current.position[axis].toFixed(3)).join(", ")}) m ·
        Rapidez:{" "}
        {Math.hypot(
          current.velocity.x,
          current.velocity.y,
          current.velocity.z,
        ).toFixed(3)}{" "}
        m/s
      </p>
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      {run.reason && (
        <p className="warning" role="status">
          {reasons[run.reason]} Se conserva el último punto válido. Reinicia
          para volver a ejecutar.
        </p>
      )}
      <p className="muted">
        Paso fijo: {DT} s · Duración máxima: {MAX_TIME} s · Hasta 10000 pasos.
        La animación puede ir más lenta que el tiempo real. El modo numérico es
        educativo; magnitudes extremas requieren revisar la convergencia del
        paso.
      </p>
    </section>
  );
}
