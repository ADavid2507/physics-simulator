import { Component } from "react";
import type { ReactNode } from "react";
export class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="warning">
        No se pudo iniciar WebGL. Los resultados numéricos siguen disponibles.
      </p>
    ) : (
      this.props.children
    );
  }
}
