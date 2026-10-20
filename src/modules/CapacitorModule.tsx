import { useState } from "react";
import { calculateCapacitor } from "../core/capacitors";
import { CapacitorScene } from "../visualization/CapacitorScene";
const initial = { area: 100, distance: 2, kappa: 1, voltage: 100 };
const controls = [
  {
    key: "area",
    label: "Área de las placas",
    unit: "cm²",
    min: 1,
    max: 400,
    step: 1,
  },
  {
    key: "distance",
    label: "Separación",
    unit: "mm",
    min: 0.1,
    max: 20,
    step: 0.1,
  },
  {
    key: "kappa",
    label: "Permitividad relativa κ",
    unit: "",
    min: 1,
    max: 10,
    step: 0.1,
  },
  {
    key: "voltage",
    label: "Voltaje",
    unit: "V",
    min: -1000,
    max: 1000,
    step: 1,
  },
] as const;
function formatSI(value: number, unit: string) {
  if (value === 0) return `0 ${unit}`;
  const prefixes: [number, string][] = [
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "μ"],
    [1e-9, "n"],
    [1e-12, "p"],
  ];
  const prefix = prefixes.find(([scale]) => Math.abs(value) >= scale);
  return prefix
    ? `${Number((value / prefix[0]).toPrecision(5))} ${prefix[1]}${unit}`
    : `${value.toExponential(4)} ${unit}`;
}
function Parameter({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
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
    <div className="capacitor-parameter">
      <label className="number-label">
        {label} {unit && `(${unit})`}
        <input
          type="number"
          min={min}
          max={max}
          step="any"
          value={draft ?? value}
          aria-invalid={invalid}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const n = Number(text);
            if (text.trim() && Number.isFinite(n) && n >= min && n <= max)
              onChange(n);
          }}
          onBlur={() => setDraft(null)}
        />
      </label>
      <input
        type="range"
        aria-label={`Ajustar ${label}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          setDraft(null);
          onChange(Number(event.target.value));
        }}
      />
      <p className="muted">
        {invalid
          ? "Fuera de rango. Se conserva el último valor válido."
          : `${min} a ${max} ${unit}`}
      </p>
    </div>
  );
}
export function CapacitorModule() {
  const [values, setValues] = useState(initial);
  const config = {
    areaM2: values.area * 1e-4,
    distanceM: values.distance * 1e-3,
    relativePermittivity: values.kappa,
    voltageV: values.voltage,
  };
  const result = calculateCapacitor(config);
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">LABORATORIO INTERACTIVO · MÓDULO 2</span>
          <h1>Capacitores y dieléctricos</h1>
          <p>Explora la capacitancia y la energía de dos placas paralelas.</p>
        </div>
        <span className="badge">Fuente ideal · V constante</span>
      </header>
      <nav aria-label="Ejemplos de capacitor">
        <span>Explorar</span>
        <button onClick={() => setValues(initial)}>Vacío · κ = 1</button>
        <button onClick={() => setValues({ ...initial, kappa: 4 })}>
          Dieléctrico ideal · κ = 4
        </button>
        <button onClick={() => setValues({ ...initial, distance: 4 })}>
          Doble separación
        </button>
        <button onClick={() => setValues({ ...initial, voltage: 200 })}>
          Doble voltaje
        </button>
      </nav>
      <div className="workspace">
        <section className="panel">
          <h2>Configuración</h2>
          <p className="muted">
            Ajusta los parámetros. Los resultados se actualizan inmediatamente.
          </p>
          {controls.map((control) => (
            <Parameter
              key={control.key}
              label={control.label}
              unit={control.unit}
              min={control.min}
              max={control.max}
              step={control.step}
              value={values[control.key]}
              onChange={(value) =>
                setValues((old) => ({ ...old, [control.key]: value }))
              }
            />
          ))}
          <button className="primary" onClick={() => setValues(initial)}>
            Restablecer
          </button>
        </section>
        <section
          className="scene-panel"
          aria-label="Capacitor de placas paralelas en 3D"
        >
          <div className="scene-heading">
            <span>PLACAS PARALELAS</span>
            <span>Escala visual ampliada</span>
          </div>
          <div className="canvas">
            <CapacitorScene config={config} />
          </div>
          <div className="scene-controls">
            <span>
              <i className="dot positive" /> Placa positiva
            </span>
            <span>
              <i className="dot negative" /> Placa negativa
            </span>
            <span>
              <i className="dot probe" /> Campo interno
            </span>
          </div>
          <p className="scene-help">
            Arrastra para rotar · rueda para acercar. El grosor de las placas es
            ilustrativo.
          </p>
        </section>
        <section className="panel inspector">
          <span className="eyebrow">RESULTADOS EN TIEMPO REAL</span>
          <h2>Propiedades del capacitor</h2>
          <div aria-live="polite">
            {result.ok ? (
              <>
                {[
                  ["Capacitancia C", formatSI(result.capacitanceF, "F")],
                  ["Energía almacenada U", formatSI(result.storedEnergyJ, "J")],
                  [
                    "Carga de la placa superior Q",
                    formatSI(result.storedChargeC, "C"),
                  ],
                  [
                    "Campo vertical Eᵧ",
                    formatSI(-result.electricFieldVm, "V/m"),
                  ],
                ].map(([label, value]) => (
                  <div className="metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </>
            ) : (
              <p role="alert" className="warning">
                {result.message}
              </p>
            )}
          </div>
          <p className="muted explanation">
            C = κε₀A/d
            <br />U = ½CV²
            <br />Q = CV · |E| = |V|/d
          </p>
          <p className="muted explanation">
            La placa superior está a V respecto de la inferior. Con V negativo,
            se invierten la carga y el campo; la energía sigue siendo positiva.
          </p>
        </section>
      </div>
      <section className="panel model-notes">
        <h2>Modelo físico</h2>
        <p className="muted">
          Dieléctrico ideal que llena todo el espacio; κ constante. Campo
          uniforme, sin efectos de borde, pérdidas ni ruptura dieléctrica. Al
          variar A, d o κ se mantiene el voltaje seleccionado: la fuente puede
          intercambiar carga con el capacitor.
        </p>
        <p className="muted">
          Las placas son cuadradas: lado = √A. La escena utiliza escalas
          independientes para lado y separación; conserva sus tendencias, pero
          no representa su proporción física real. Verde: dieléctrico con κ
          mayor que 1.
        </p>
      </section>
      <footer>
        Unidades SI dentro del motor · Configuración temporal en memoria · κ
        representa un material ideal ajustable
      </footer>
    </main>
  );
}
