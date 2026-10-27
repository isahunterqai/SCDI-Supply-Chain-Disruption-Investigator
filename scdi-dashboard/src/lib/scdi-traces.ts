/**
 * SCDI iteration traces for the dashboard.
 * Prefer historically generated runs from scdi-agent (Kaggle ingest → PEE loop).
 * Fall back to the static maritime-strike mock if generated file is absent.
 */
export type { Verdict, ScdiIteration } from "./scdi-traces.generated";
export { SCDI_ITERATIONS } from "./scdi-traces.generated";
