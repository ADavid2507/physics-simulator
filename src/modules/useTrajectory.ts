import { useEffect, useState } from "react";
import type { Charge } from "../core/electricity";
import {
  advanceParticle,
  initialMotion,
  validateParticle,
} from "../core/trajectory";
import type {
  MotionState,
  ParticleConfig,
  StopReason,
} from "../core/trajectory";
export const DEFAULT_PARTICLE: ParticleConfig = {
  chargeC: 1e-6,
  massKg: 0.001,
  position: { x: 0, y: 2, z: 0 },
  velocity: { x: 0.5, y: 0, z: 0 },
};
export type RunStatus = "READY" | "RUNNING" | "PAUSED" | "COMPLETED" | "ERROR";
interface Run {
  status: RunStatus;
  points: MotionState[];
  steps: number;
  reason?: StopReason;
}
function fresh(config: ParticleConfig): Run {
  return { status: "READY", points: [initialMotion(config)], steps: 0 };
}
export function useTrajectory(charges: Charge[], active: boolean) {
  const [config, setConfig] = useState(DEFAULT_PARTICLE);
  const [run, setRun] = useState<Run>(() => fresh(DEFAULT_PARTICLE));
  function reset() {
    setRun(fresh(config));
  }
  function configure(next: ParticleConfig) {
    setConfig(next);
    setRun(fresh(next));
  }
  function start() {
    if (validateParticle(config)) return;
    setRun((previous) => {
      const check = advanceParticle(
        previous.points[previous.points.length - 1],
        config,
        charges,
        previous.steps,
      );
      if (check.reason)
        return {
          ...previous,
          reason: check.reason,
          status: check.reason === "INVALID_STATE" ? "ERROR" : "COMPLETED",
        };
      return { ...previous, status: "RUNNING" };
    });
  }
  useEffect(() => {
    if (run.status !== "RUNNING" || !active) return;
    const timer = window.setInterval(
      () =>
        setRun((previous) => {
          if (previous.status !== "RUNNING") return previous;
          const points = [...previous.points];
          let state = points[points.length - 1];
          let steps = previous.steps;
          let reason: StopReason | undefined;
          // Fixed physical dt, ten bounded steps per UI update; no frame-dependent physics.
          for (let i = 0; i < 10; i++) {
            const next = advanceParticle(state, config, charges, steps);
            if (next.state !== state) {
              state = next.state;
              points.push(state);
              steps++;
            }
            if (next.reason) {
              reason = next.reason;
              break;
            }
          }
          return {
            points,
            steps,
            reason,
            status: reason
              ? reason === "INVALID_STATE"
                ? "ERROR"
                : "COMPLETED"
              : "RUNNING",
          };
        }),
      20,
    );
    return () => window.clearInterval(timer);
  }, [run.status, charges, config, active]);
  return {
    config,
    configure,
    run,
    reset,
    start,
    pause: () =>
      setRun((previous) =>
        previous.status === "RUNNING"
          ? { ...previous, status: "PAUSED" }
          : previous,
      ),
  };
}
