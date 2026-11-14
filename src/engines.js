// ECS / DOTS Playground - shared simulation equations, three storage strategies.
// The DOTS-like implementation is data-oriented JavaScript, NOT Unity DOTS.
export const WIDTH = 1000;
export const HEIGHT = 620;

export function makeSeed(count, seed = 261113) {
  let s = seed >>> 0;
  const random = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  const xs = new Float64Array(count), ys = new Float64Array(count);
  const vxs = new Float64Array(count), vys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    xs[i] = 30 + random() * (WIDTH - 60);
    ys[i] = 30 + random() * (HEIGHT - 60);
    vxs[i] = (random() - 0.5) * 2;
    vys[i] = (random() - 0.5) * 2;
  }
  return { count, xs, ys, vxs, vys };
}

function advance(x, y, vx, vy, px, py) {
  // Shared formula, applied identically to all three implementations.
  const dx = px - x, dy = py - y;
  const pull = 0.09 / Math.sqrt(dx * dx + dy * dy + 196);
  vx = (vx + dx * pull) * 0.985;
  vy = (vy + dy * pull) * 0.985;
  x += vx; y += vy;
  if (x < 0) { x = 0; vx = Math.abs(vx) * 0.85; }
  else if (x > WIDTH) { x = WIDTH; vx = -Math.abs(vx) * 0.85; }
  if (y < 0) { y = 0; vy = Math.abs(vy) * 0.85; }
  else if (y > HEIGHT) { y = HEIGHT; vy = -Math.abs(vy) * 0.85; }
  return [x, y, vx, vy];
}

class Agent {
  constructor(x, y, vx, vy) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; }
  update(px, py) {
    // Same arithmetic as other engines; per-entity behavior belongs to an object.
    const dx = px - this.x, dy = py - this.y;
    const pull = 0.09 / Math.sqrt(dx * dx + dy * dy + 196);
    this.vx = (this.vx + dx * pull) * 0.985;
    this.vy = (this.vy + dy * pull) * 0.985;
    this.x += this.vx; this.y += this.vy;
    if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx) * 0.85; }
    else if (this.x > WIDTH) { this.x = WIDTH; this.vx = -Math.abs(this.vx) * 0.85; }
    if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * 0.85; }
    else if (this.y > HEIGHT) { this.y = HEIGHT; this.vy = -Math.abs(this.vy) * 0.85; }
  }
}

class OOPWorld {
  constructor(seed) {
    this.count = seed.count;
    this.agents = Array.from({ length: seed.count }, (_, i) =>
      new Agent(seed.xs[i], seed.ys[i], seed.vxs[i], seed.vys[i]));
  }
  update(px, py) {
    const agents = this.agents;
    for (let i = 0; i < agents.length; i++) agents[i].update(px, py);
  }
  x(i) { return this.agents[i].x; }
  y(i) { return this.agents[i].y; }
  speed(i) { const a = this.agents[i]; return Math.hypot(a.vx, a.vy); }
}

class ECSWorld {
  constructor(seed) {
    this.count = seed.count;
    // Entity ID === index. Component stores and systems are independent.
    this.entities = Array.from({ length: seed.count }, (_, i) => i);
    this.position = Array.from({ length: seed.count }, (_, i) =>
      ({ x: seed.xs[i], y: seed.ys[i] }));
    this.velocity = Array.from({ length: seed.count }, (_, i) =>
      ({ x: seed.vxs[i], y: seed.vys[i] }));
  }
  update(px, py) {
    // MovementSystem queries entities with Position + Velocity.
    const position = this.position, velocity = this.velocity;
    for (let i = 0; i < this.count; i++) {
      const p = position[i], v = velocity[i];
      const dx = px - p.x, dy = py - p.y;
      const pull = 0.09 / Math.sqrt(dx * dx + dy * dy + 196);
      v.x = (v.x + dx * pull) * 0.985;
      v.y = (v.y + dy * pull) * 0.985;
      p.x += v.x; p.y += v.y;
      if (p.x < 0) { p.x = 0; v.x = Math.abs(v.x) * 0.85; }
      else if (p.x > WIDTH) { p.x = WIDTH; v.x = -Math.abs(v.x) * 0.85; }
      if (p.y < 0) { p.y = 0; v.y = Math.abs(v.y) * 0.85; }
      else if (p.y > HEIGHT) { p.y = HEIGHT; v.y = -Math.abs(v.y) * 0.85; }
    }
  }
  x(i) { return this.position[i].x; }
  y(i) { return this.position[i].y; }
  speed(i) { const v = this.velocity[i]; return Math.hypot(v.x, v.y); }
}

class DODWorld {
  constructor(seed) {
    this.count = seed.count;
    // Structure-of-Arrays: compact, fixed-size, sequential typed-array storage.
    this.xs = new Float32Array(seed.xs);
    this.ys = new Float32Array(seed.ys);
    this.vxs = new Float32Array(seed.vxs);
    this.vys = new Float32Array(seed.vys);
  }
  update(px, py) {
    // Contiguous component data, one hot loop, no per-entity object traversal.
    const xs = this.xs, ys = this.ys, vxs = this.vxs, vys = this.vys;
    for (let i = 0; i < this.count; i++) {
      let x = xs[i], y = ys[i], vx = vxs[i], vy = vys[i];
      const dx = px - x, dy = py - y;
      const pull = 0.09 / Math.sqrt(dx * dx + dy * dy + 196);
      vx = (vx + dx * pull) * 0.985;
      vy = (vy + dy * pull) * 0.985;
      x += vx; y += vy;
      if (x < 0) { x = 0; vx = Math.abs(vx) * 0.85; }
      else if (x > WIDTH) { x = WIDTH; vx = -Math.abs(vx) * 0.85; }
      if (y < 0) { y = 0; vy = Math.abs(vy) * 0.85; }
      else if (y > HEIGHT) { y = HEIGHT; vy = -Math.abs(vy) * 0.85; }
      xs[i] = x; ys[i] = y; vxs[i] = vx; vys[i] = vy;
    }
  }
  x(i) { return this.xs[i]; }
  y(i) { return this.ys[i]; }
  speed(i) { return Math.hypot(this.vxs[i], this.vys[i]); }
}

export const ENGINE_INFO = {
  oop: { name: "OOP 傳統物件", short: "Object-oriented", detail: "每一隻敵人都是帶有 update() 方法的物件；很好理解，但大量資料可能需要較多間接存取。" },
  ecs: { name: "ECS 組件系統", short: "Entity · Component · System", detail: "每個敵人只有 Entity ID，Position / Velocity 分開存；MovementSystem 統一計算。重點是可組合性，不保證一定最快。" },
  dod: { name: "DOD / DOTS 風格", short: "Data-oriented · Typed arrays", detail: "以 Float32Array 儲存連續的 x/y/vx/vy 資料，由單一 System 逐筆掃描；這是 JavaScript 資料導向示範，不是 Unity DOTS。" }
};

export function makeWorld(kind, seed) {
  if (kind === "oop") return new OOPWorld(seed);
  if (kind === "ecs") return new ECSWorld(seed);
  if (kind === "dod") return new DODWorld(seed);
  throw new Error("Unknown engine: " + kind);
}

// Separate benchmark from rendering: each engine receives the same seed,
// same synthetic player path, same warm-up and measured step counts.
export async function benchmark(count, onProgress = () => {}) {
  const seed = makeSeed(count, 261113);
  const kinds = ["oop", "ecs", "dod"];
  const results = {};
  for (const [index, kind] of kinds.entries()) {
    const world = makeWorld(kind, seed);
    let sum = 0;
    const warmup = 40, measured = 100;
    for (let step = 0; step < warmup + measured; step++) {
      const px = 500 + Math.sin(step * 0.029) * 290;
      const py = 310 + Math.cos(step * 0.023) * 180;
      const start = performance.now();
      world.update(px, py);
      if (step >= warmup) sum += performance.now() - start;
      if ((step + 1) % 20 === 0) {
        onProgress((index + (step + 1) / (warmup + measured)) / kinds.length);
        // Yield so browser can paint progress on mobile.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    results[kind] = {
      ms: sum / measured,
      millionUpdatesPerSecond: count * measured / sum / 1000
    };
  }
  return results;
}
