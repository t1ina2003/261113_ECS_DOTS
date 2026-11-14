import test from "node:test";
import assert from "node:assert/strict";
import { makeSeed, makeWorld, WIDTH, HEIGHT } from "../src/engines.js";

test("seed data is deterministic", () => {
  const a = makeSeed(50, 261113);
  const b = makeSeed(50, 261113);
  assert.deepEqual(Array.from(a.xs), Array.from(b.xs));
  assert.deepEqual(Array.from(a.vys), Array.from(b.vys));
});

test("all three implementations use equivalent physics", () => {
  const count = 900;
  const seed = makeSeed(count, 261113);
  const oop = makeWorld("oop", seed);
  const ecs = makeWorld("ecs", seed);
  const dod = makeWorld("dod", seed);
  for (let step = 0; step < 120; step++) {
    const px = 500 + Math.sin(step / 20) * 200;
    const py = 310 + Math.cos(step / 24) * 130;
    oop.update(px, py);
    ecs.update(px, py);
    dod.update(px, py);
  }
  for (let i = 0; i < count; i++) {
    for (const axis of ["x", "y"]) {
      const expected = oop[axis](i);
      assert.ok(Math.abs(expected - ecs[axis](i)) < 1e-10, "ECS physics diverged");
      assert.ok(Math.abs(expected - dod[axis](i)) < 0.01, "Float32 physics diverged");
      assert.ok(Number.isFinite(expected));
      assert.ok(expected >= 0 && expected <= (axis === "x" ? WIDTH : HEIGHT));
    }
  }
});

test("unknown engines are rejected", () => {
  assert.throws(() => makeWorld("wrong", makeSeed(2)), /Unknown engine/);
});

test("each world exposes matching entity counts", () => {
  const seed = makeSeed(5);
  for (const kind of ["oop", "ecs", "dod"]) {
    const world = makeWorld(kind, seed);
    assert.equal(world.count, 5);
  }
});
