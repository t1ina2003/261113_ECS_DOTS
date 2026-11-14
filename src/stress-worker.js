// CPU-only, off-main-thread benchmark. This intentionally measures simulation
// cost, not browser FPS. A threshold crossing is a theoretical frame-budget
// warning, not proof that the visible page will drop frames.
import { makeSeed, makeWorld } from "./engines.js";

const BUDGET_MS = 1000 / 60;
const stages = [
  [5000, 1], [30000, 1], [100000, 1], [250000, 1],
  [250000, 2], [250000, 4], [250000, 8], [250000, 16],
  [250000, 32]
];
const engines = ["oop", "ecs", "dod"];

function measure(kind, seed, substeps) {
  const world = makeWorld(kind, seed);
  const samples = [];
  const warmup = 2;
  const trials = 3;
  // Exactly the same positions and number of physics steps for each engine.
  let tick = 0;
  for (let frame = 0; frame < warmup + trials; frame++) {
    const start = performance.now();
    for (let s = 0; s < substeps; s++) {
      const px = 500 + Math.sin(tick * 0.029) * 290;
      const py = 310 + Math.cos(tick * 0.023) * 180;
      world.update(px, py);
      tick++;
    }
    if (frame >= warmup) samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[1]; // Median of 3 mitigates one-off scheduling/GC noise.
}

self.onmessage = (event) => {
  if (event.data?.type !== "start") return;
  const results = [];
  try {
    for (let i = 0; i < stages.length; i++) {
      const [count, substeps] = stages[i];
      const seed = makeSeed(count, 261113);
      const ms = {};
      for (const kind of engines) ms[kind] = measure(kind, seed, substeps);
      const result = { count, substeps, work: count * substeps, ms };
      results.push(result);
      self.postMessage({ type: "stage", result, index: i + 1, total: stages.length });
      // Stop after all engines have crossed the 60 FPS single-thread budget;
      // otherwise keep escalating until the capped, finite workload.
      if (engines.every((kind) => ms[kind] > BUDGET_MS)) break;
    }
    self.postMessage({ type: "done", results, budgetMs: BUDGET_MS });
  } catch (error) {
    self.postMessage({ type: "error", message: String(error) });
  }
};
