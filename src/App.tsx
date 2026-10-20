import { ParticlePanel } from "./modules/ParticlePanel";
import { useTrajectory } from "./modules/useTrajectory";
import type { SetStateAction } from "react";
import { CapacitorModule } from "./modules/CapacitorModule";
import { useMemo, useState } from "react";
import { buildFieldLines, buildEquipotentials } from "./core/fieldGeometry";
import { addCharge, fieldAt, MAX_CHARGES } from "./core/electricity";
import type { Charge, Vec } from "./core/electricity";
import { ElectricScene } from "./visualization/ElectricScene";
import "./App.css";
const axes = ["x", "y", "z"] as const;
function preset(kind: string): Charge[] {
  const c = (id: string, q: number, x: number): Charge => ({
    id,
    q: q * 1e-6,
    position: { x, y: 0, z: 0 },
  });
  if (kind === "positive") return [c("a", 1, 0)];
  if (kind === "negative") return [c("a", -1, 0)];
  return [c("a", 1, -1), c("b", kind === "equal" ? 1 : -1, 1)];
}
function Numeric({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid =
    draft !== null &&
    (!draft.trim() ||
      !Number.isFinite(Number(draft)) ||
      Math.abs(Number(draft)) > 1e6);
  return (
    <label className="number-label">
      {label}
      <input
        type="number"
        step="any"
        min={-1e6}
        max={1e6}
        title="Rango admitido: −1000000 a 1000000. Una entrada inválida conserva el último valor válido."
        value={draft ?? value}
        aria-invalid={invalid}
        onChange={(e) => {
          const s = e.target.value;
          setDraft(s);
          if (
            s.trim() &&
            Number.isFinite(Number(s)) &&
            Math.abs(Number(s)) <= 1e6
          )
            onChange(Number(s));
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}
const fmt = (n: number) => (n === 0 ? "0" : n.toExponential(4));
function ElectricModule({ active }: { active: boolean }) {
  const [charges, setSourceCharges] = useState<Charge[]>(() =>
    preset("dipole"),
  );
  const [probe, setProbe] = useState<Vec>({ x: 0, y: 1, z: 0 });
  const [vectors, setVectors] = useState(true),
    [grid, setGrid] = useState(true),
    [volume, setVolume] = useState(false);
  const [showLines, setShowLines] = useState(false);
  const [showContours, setShowContours] = useState(false);
  const [planeZ, setPlaneZ] = useState(0);
  const fieldLines = useMemo(
    () => showLines ? buildFieldLines(charges) : [],
    [showLines, charges],
  );
  const contours = useMemo(
    () => showContours ? buildEquipotentials(charges, planeZ) : { levels: [], segments: [] },
    [showContours, charges, planeZ],
  );
  const simulation = useTrajectory(charges, active);
  function setCharges(next: SetStateAction<Charge[]>) {
    simulation.reset();
    setSourceCharges(next);
  }
  const result = fieldAt(probe, charges);
  function update(id: string, patch: Partial<Charge>) {
    setCharges((old) => old.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">LABORATORIO INTERACTIVO · MÓDULO 1</span>
          <h1>Campo eléctrico</h1>
          <p>Explora cómo las cargas transforman el espacio.</p>
        </div>
        <span className="badge">Electrostática · SI</span>
      </header>
      <nav aria-label="Escenarios de ejemplo">
        <span>Explorar</span>
        {[
          ["positive", "+ Una carga"],
          ["negative", "− Una carga"],
          ["equal", "Cargas iguales"],
          ["dipole", "Dipolo"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setCharges(preset(key))}>
            {label}
          </button>
        ))}
        <button onClick={() => setCharges([])}>Vaciar</button>
      </nav>
      <div className="workspace">
        <section className="panel">
          <div className="section-title">
            <h2>Cargas fuente</h2>
            <span>{charges.length} / 10</span>
          </div>
          <p className="muted">Magnitud en μC · posición en metros</p>
          <div className="charge-list">
            {charges.map((c, i) => (
              <article key={c.id}>
                <div className="section-title">
                  <h3>
                    <i className={`dot ${c.q < 0 ? "negative" : "positive"}`} />
                    Carga {i + 1}
                  </h3>
                  <button
                    className="delete"
                    aria-label={`Eliminar carga ${i + 1}`}
                    onClick={() =>
                      setCharges((old) =>
                        old.filter((item) => item.id !== c.id),
                      )
                    }
                  >
                    Eliminar
                  </button>
                </div>
                <Numeric
                  label={`q${i + 1} (μC)`}
                  value={c.q * 1e6}
                  onChange={(q) => update(c.id, { q: q * 1e-6 })}
                />
                <div className="coordinates">
                  {axes.map((axis) => (
                    <Numeric
                      key={axis}
                      label={`${axis}${i + 1} (m)`}
                      value={c.position[axis]}
                      onChange={(value) =>
                        update(c.id, {
                          position: { ...c.position, [axis]: value },
                        })
                      }
                    />
                  ))}
                </div>
              </article>
            ))}
            {!charges.length && (
              <p className="muted">
                Agrega una carga para comenzar. Sin cargas, E y V son cero.
              </p>
            )}
          </div>
          <button
            className="primary"
            disabled={charges.length >= MAX_CHARGES}
            onClick={() =>
              setCharges((old) =>
                addCharge(old, {
                  id: crypto.randomUUID(),
                  q: 1e-6,
                  position: { x: 0, y: 0, z: 0 },
                }),
              )
            }
          >
            + Agregar carga
          </button>
          {charges.length === 10 && (
            <p className="muted">Límite de diez cargas alcanzado.</p>
          )}
        </section>
        <section className="scene-panel" aria-label="Escena tridimensional">
          <div className="scene-heading">
            <span>ESPACIO 3D</span>
            <span>1 unidad = 1 m</span>
          </div>
          <div className="canvas">
            <ElectricScene
              charges={charges}
              probe={probe}
              vectors={vectors}
              grid={grid}
              volume={volume}
              trajectory={simulation.run.points}
              fieldLines={fieldLines}
              contours={contours.segments}
            />
          </div>
          <div className="scene-controls">
            <label>
              <input
                type="checkbox"
                checked={vectors}
                onChange={(e) => setVectors(e.target.checked)}
              />{" "}
              Vectores
            </label>
            <label>
              <input
                type="checkbox"
                checked={grid}
                onChange={(e) => setGrid(e.target.checked)}
              />{" "}
              Ejes y cuadrícula
            </label>
            <label>
              <input
                type="checkbox"
                checked={volume}
                onChange={(e) => setVolume(e.target.checked)}
              />{" "}
              Muestreo 3D
            </label>
          </div>
          <div className="scene-controls field-options">
            <label>
              <input type="checkbox" checked={showLines} onChange={event => setShowLines(event.target.checked)} />
              Líneas de campo
            </label>
            <label>
              <input type="checkbox" checked={showContours} onChange={event => setShowContours(event.target.checked)} />
              Equipotenciales XY
            </label>
          </div>
          {showContours && <div className="contour-controls">
            <label>
              Plano XY: z = {planeZ.toFixed(1)} m
              <input type="range" min={-5} max={5} step={0.1} value={planeZ} onChange={event => setPlaneZ(Number(event.target.value))} />
            </label>
            <p>Niveles automáticos (V): {contours.levels.length ? contours.levels.map(level => level === 0 ? "0" : level.toExponential(2)).join(" · ") : "No hay contornos en este plano."}</p>
            <p><span className="contour-positive">Positivo</span> · <span className="contour-negative">Negativo</span> · Blanco: V = 0. Contornos aproximados en una malla de 64 × 64 celdas.</p>
          </div>}
          <p className="scene-help">
            Arrastra para rotar · rueda para acercar · botón derecho para
            desplazar
          </p>
        </section>
        <section className="panel inspector">
          <span className="eyebrow">PUNTO DE CONSULTA</span>
          <h2>Inspector E / V</h2>
          <p className="muted">El marcador amarillo indica el punto P.</p>
          <div className="coordinates">
            {axes.map((axis) => (
              <Numeric
                key={axis}
                label={`${axis} (m)`}
                value={probe[axis]}
                onChange={(value) =>
                  setProbe((old) => ({ ...old, [axis]: value }))
                }
              />
            ))}
          </div>
          <div aria-live="polite">
            {result.ok ? (
              <>
                <div className="metric">
                  <span>Magnitud del campo |E|</span>
                  <strong>
                    {fmt(result.magnitude)} <small>N/C</small>
                  </strong>
                </div>
                <dl>
                  {axes.map((axis) => (
                    <div key={axis}>
                      <dt>E{axis}</dt>
                      <dd>{fmt(result.field[axis])} N/C</dd>
                    </div>
                  ))}
                </dl>
                <div className="metric potential">
                  <span>Potencial eléctrico V</span>
                  <strong>
                    {fmt(result.potential)} <small>V</small>
                  </strong>
                </div>
              </>
            ) : (
              <p className="warning" role="alert">
                {result.message}
              </p>
            )}
          </div>
          <div className="legend">
            <span>
              <i className="dot positive" />
              Positiva
            </span>
            <span>
              <i className="dot negative" />
              Negativa
            </span>
            <span>
              <i className="dot probe" />
              Consulta
            </span>
          </div>
          <p className="muted explanation">
            Las flechas indican dirección. Su longitud usa una escala
            logarítmica; el inspector muestra los valores físicos reales.
            Muestreo de flechas entre −4 y 4 m; por defecto, plano XY.
            Las líneas verdes siguen E y sus puntas indican la dirección.
            Líneas y contornos se recortan al dominio de ±5 m; su cantidad es ilustrativa.
            Las equipotenciales son curvas en el plano elegido, no superficies 3D.
          </p>
        </section>
      </div>
      <ParticlePanel simulation={simulation} />
      <footer>
        Cargas fijas en el vacío · Superposición de Coulomb · Radio excluido:
        0.08 m · Estado temporal en memoria
      </footer>
    </main>
  );
}

export default function App() {
  const [module, setModule] = useState<"electric" | "capacitor">("electric");
  return (
    <>
      <nav className="module-nav" aria-label="Módulos del simulador">
        <button
          aria-current={module === "electric" ? "page" : undefined}
          onClick={() => setModule("electric")}
        >
          01 · Campo eléctrico
        </button>
        <button
          aria-current={module === "capacitor" ? "page" : undefined}
          onClick={() => setModule("capacitor")}
        >
          02 · Capacitores
        </button>
      </nav>
      <div hidden={module !== "electric"}>
        <ElectricModule active={module === "electric"} />
      </div>
      <div hidden={module !== "capacitor"}>
        <CapacitorModule />
      </div>
    </>
  );
}
