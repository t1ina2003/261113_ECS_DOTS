import { WIDTH, HEIGHT, ENGINE_INFO, makeSeed, makeWorld, benchmark } from "./engines.js";

const $ = (id) => document.getElementById(id);
const canvas = $("arena");
const ctx = canvas.getContext("2d", { alpha: false });
const countInput = $("count");
const countLabel = $("count-value");
const modeInfo = $("mode-info");
const pauseButton = $("pause-button");
const resetButton = $("reset-button");
const benchButton = $("benchmark-button");
const resultsContainer = $("bench-results");
const formatter = new Intl.NumberFormat("zh-TW");

let kind = "oop";
let entityCount = Number(countInput.value);
let substeps = 1;
let stressWorker = null;
let stressRows = [];
let wasPlayingBeforeStress = false;
let world = makeWorld(kind, makeSeed(entityCount));
let playing = true;
let benchmarking = false;
let dragging = false;
let hits = 0;
let aliveSeconds = 0;
let immuneUntil = 0;
let lastFrameAt = 0;
let lastHudAt = 0;
let fpsAverage = 60;
let tickMsAverage = 0;
const player = { x: WIDTH / 2, y: HEIGHT / 2, targetX: WIDTH / 2, targetY: HEIGHT / 2 };
const keys = new Set();

const COLORS = {
  oop: ["#939eff", "rgba(147,158,255,0.2)"],
  ecs: ["#ffc876", "rgba(255,200,118,0.2)"],
  dod: ["#6ce1c4", "rgba(108,225,196,0.2)"]
};

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function shownCount() { return Math.ceil(entityCount / Math.ceil(entityCount / 700)); }

function rebuild() {
  world = makeWorld(kind, makeSeed(entityCount, 261113));
  hits = 0;
  aliveSeconds = 0;
  immuneUntil = 0;
  player.x = player.targetX = WIDTH / 2;
  player.y = player.targetY = HEIGHT / 2;
  fpsAverage = 60;
  tickMsAverage = 0;
  $("entity-live").innerHTML = formatter.format(entityCount) + " <small>ENTITIES</small>";
  $("draw-live").innerHTML = formatter.format(shownCount()) + " <small>DOTS</small>";
  updateWorkLabel();
  $("hit-live").innerHTML = "0 <small>HITS</small>";
  $("game-message").textContent = "拖曳 / 觸控 / WASD 移動玩家";
  modeInfo.textContent = ENGINE_INFO[kind].detail;
  updateHud();
}

function setMode(next) {
  if (benchmarking || next === kind) return;
  kind = next;
  document.querySelectorAll(".mode").forEach((element) => {
    const selected = element.dataset.mode === next;
    element.classList.toggle("selected", selected);
    element.setAttribute("aria-pressed", String(selected));
  });
  rebuild();
}

document.querySelectorAll(".mode").forEach(button =>
  button.addEventListener("click", () => setMode(button.dataset.mode)));

countInput.addEventListener("input", () => {
  countLabel.textContent = formatter.format(Number(countInput.value));
});
function updateWorkLabel() {
  $("work-label").textContent = "每幀約 " + formatter.format(entityCount * substeps) + " 次實體更新";
}
$("substeps").addEventListener("change", (event) => {
  if (benchmarking) return;
  substeps = Number(event.target.value);
  updateWorkLabel();
});
countInput.addEventListener("change", () => {
  if (benchmarking) return;
  entityCount = Number(countInput.value);
  rebuild();
});
resetButton.addEventListener("click", () => { if (!benchmarking) rebuild(); });

pauseButton.addEventListener("click", () => {
  if (benchmarking) return;
  playing = !playing;
  pauseButton.textContent = playing ? "暫停" : "繼續";
  $("running-status").classList.toggle("paused", !playing);
  $("running-status").innerHTML = playing
    ? '<span class="pulse-dot"></span> RUNNING'
    : '<span class="pulse-dot"></span> PAUSED';
});

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  player.targetX = clamp((event.clientX - rect.left) / rect.width * WIDTH, 0, WIDTH);
  player.targetY = clamp((event.clientY - rect.top) / rect.height * HEIGHT, 0, HEIGHT);
}
canvas.addEventListener("pointerdown", event => {
  dragging = true;
  canvas.setPointerCapture?.(event.pointerId);
  pointerPosition(event);
});
canvas.addEventListener("pointermove", event => {
  if (dragging || event.pointerType === "mouse") pointerPosition(event);
});
canvas.addEventListener("pointerup", () => dragging = false);
canvas.addEventListener("pointercancel", () => dragging = false);
window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(key)) {
    keys.add(key);
    event.preventDefault();
  }
  if (event.code === "Space" && event.target.tagName !== "BUTTON") {
    pauseButton.click();
    event.preventDefault();
  }
});
window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());

function movePlayer(dt) {
  const distance = 440 * dt;
  const left = keys.has("arrowleft") || keys.has("a");
  const right = keys.has("arrowright") || keys.has("d");
  const up = keys.has("arrowup") || keys.has("w");
  const down = keys.has("arrowdown") || keys.has("s");
  if (left || right || up || down) {
    player.targetX += (Number(right) - Number(left)) * distance;
    player.targetY += (Number(down) - Number(up)) * distance;
  }
  player.targetX = clamp(player.targetX, 15, WIDTH - 15);
  player.targetY = clamp(player.targetY, 15, HEIGHT - 15);
  // Position is the single source of truth. Canvas simply projects it.
  const factor = 1 - Math.exp(-19 * dt);
  player.x += (player.targetX - player.x) * factor;
  player.y += (player.targetY - player.y) * factor;
}

const background = document.createElement("canvas");
background.width = WIDTH; background.height = HEIGHT;
const bg = background.getContext("2d");
function drawBackground() {
  bg.fillStyle = "#080e1d"; bg.fillRect(0, 0, WIDTH, HEIGHT);
  bg.strokeStyle = "#20314c"; bg.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 40) {
    bg.beginPath(); bg.moveTo(x + .5, 0); bg.lineTo(x + .5, HEIGHT); bg.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 40) {
    bg.beginPath(); bg.moveTo(0, y + .5); bg.lineTo(WIDTH, y + .5); bg.stroke();
  }
  bg.strokeStyle = "#324460"; bg.strokeRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1);
  const glow = bg.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, 450);
  glow.addColorStop(0, "#1c294c65"); glow.addColorStop(1, "#0a102000");
  bg.fillStyle = glow; bg.fillRect(0, 0, WIDTH, HEIGHT);
}
drawBackground();

function draw(now, checkCollisions) {
  ctx.drawImage(background, 0, 0);
  const stride = Math.ceil(entityCount / 700);
  const color = COLORS[kind][0];
  ctx.fillStyle = color;
  let collision = false;
  for (let i = 0; i < entityCount; i += stride) {
    const x = world.x(i), y = world.y(i);
    ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
    if (checkCollisions && Math.abs(player.x - x) < 12 && Math.abs(player.y - y) < 12) {
      const dx = player.x - x, dy = player.y - y;
      if (dx * dx + dy * dy < 144) collision = true;
    }
  }
  if (collision && now > immuneUntil) {
    hits++;
    aliveSeconds = 0;
    immuneUntil = now + 900;
    $("game-message").textContent = "被敵人碰到了！重新計時，繼續閃避";
  }
  const safe = now < immuneUntil;
  ctx.beginPath(); ctx.arc(player.x, player.y, safe ? 24 : 20, 0, Math.PI * 2);
  ctx.strokeStyle = safe ? "#f7c778" : "#4ecbeb88";
  ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
  ctx.fillStyle = safe ? "#f7c778" : "#70e5fc"; ctx.fill();
  ctx.beginPath(); ctx.arc(player.x, player.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#0d2944"; ctx.fill();
  if (!playing) {
    ctx.fillStyle = "#080f1dc2"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center"; ctx.font = "bold 32px sans-serif";
    ctx.fillStyle = "#cbd9ef"; ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2);
  }
}

function updateHud() {
  $("update-ms").textContent = tickMsAverage ? tickMsAverage.toFixed(3) : "—";
  $("fps").textContent = playing ? Math.round(fpsAverage) : "—";
  $("survival").textContent = "生存 " + aliveSeconds.toFixed(1) + "s";
  $("hit-live").innerHTML = hits + " <small>HITS</small>";
}
function frame(now) {
  requestAnimationFrame(frame);
  if (benchmarking) { lastFrameAt = now; return; }
  const dt = lastFrameAt ? Math.min(0.05, (now - lastFrameAt) / 1000) : 1 / 60;
  lastFrameAt = now;
  if (playing) {
    movePlayer(dt);
    const start = performance.now();
    for (let i = 0; i < substeps; i++) world.update(player.x, player.y);
    const elapsed = performance.now() - start;
    tickMsAverage = tickMsAverage ? tickMsAverage * .88 + elapsed * .12 : elapsed;
    fpsAverage = fpsAverage * .88 + (1 / Math.max(dt, .001)) * .12;
    aliveSeconds += dt;
  }
  draw(now, playing);
  if (now - lastHudAt > 320) { updateHud(); lastHudAt = now; }
}

function renderResults(results, count) {
  const entries = [["oop","OOP"],["ecs","ECS"],["dod","DOD / DOTS 風格"]];
  const longest = Math.max(...entries.map(([key]) => results[key].ms), 0.000001);
  const fastest = entries.reduce((best, [key]) =>
    results[key].ms < results[best].ms ? key : best, entries[0][0]);
  const baseline = results.oop.ms;
  resultsContainer.replaceChildren();
  const overview = document.createElement("p");
  overview.className = "section-desc";
  overview.textContent = "實測 " + formatter.format(count) + " 隻實體，每次更新平均耗時（越短越好）：";
  resultsContainer.append(overview);
  for (const [key, label] of entries) {
    const entry = results[key];
    const row = document.createElement("div");
    row.className = "bench-row";
    const ratio = Math.max(2, entry.ms / longest * 100);
    const compared = baseline / Math.max(entry.ms, 0.000001);
    row.innerHTML = '<div class="bench-name">' + label + '<small>' +
      (key === fastest ? "本次最快" : ENGINE_INFO[key].short) + '</small></div>' +
      '<div class="bench-track"><div class="bench-fill ' + key +
      '" style="width:' + ratio.toFixed(2) + '%"></div></div>' +
      '<div class="bench-value">' + entry.ms.toFixed(3) + ' ms<small>相對 OOP ' +
      compared.toFixed(2) + '×</small></div>';
    resultsContainer.append(row);
  }
  const summary = document.createElement("div");
  summary.className = "bench-summary";
  summary.textContent = "這次最快：" + ENGINE_INFO[fastest].name +
    "。這是你裝置的實測，不代表此架構在所有專案都更快。若數字接近，請多次測試。";
  resultsContainer.append(summary);
}

benchButton.addEventListener("click", async () => {
  if (benchmarking) return;
  benchmarking = true;
  benchButton.disabled = true;
  pauseButton.disabled = true;
  resetButton.disabled = true;
  countInput.disabled = true;
  document.querySelectorAll(".mode").forEach(button => button.disabled = true);
  benchButton.textContent = "測試中…";
  resultsContainer.innerHTML = '<div class="empty-bench" role="status"><div id="progress-text">正在公平跑分 · 0%</div><div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div><small>已暫停遊戲運算，測試結果不含 Canvas 渲染。</small></div>';
  const count = entityCount;
  try {
    const results = await benchmark(count, fraction => {
      $("progress-fill").style.width = Math.round(fraction * 100) + "%";
      $("progress-text").textContent = "正在公平跑分 · " + Math.round(fraction * 100) + "%";
    });
    renderResults(results, count);
  } catch (err) {
    resultsContainer.textContent = "測試失敗：" + String(err);
  } finally {
    benchmarking = false;
    benchButton.disabled = false;
    pauseButton.disabled = false;
    resetButton.disabled = false;
    countInput.disabled = false;
    document.querySelectorAll(".mode").forEach(button => button.disabled = false);
    benchButton.textContent = "重新執行公平跑分 ↗";
    lastFrameAt = 0;
  }
});

rebuild();
draw(0, false);
requestAnimationFrame(frame);

// Auto-escalation deliberately happens in a dedicated Web Worker.
// The main thread stays responsive, and FPS never masquerades as a CPU benchmark.
function setStressControls(disabled) {
  benchButton.disabled = disabled;
  pauseButton.disabled = disabled;
  resetButton.disabled = disabled;
  countInput.disabled = disabled;
  $("substeps").disabled = disabled;
  document.querySelectorAll(".mode").forEach(button => button.disabled = disabled);
}

function stopStress(cancelled = false) {
  stressWorker?.terminate();
  stressWorker = null;
  benchmarking = false;
  setStressControls(false);
  $("stress-button").disabled = false;
  $("stress-stop").hidden = true;
  if (wasPlayingBeforeStress && !playing) pauseButton.click();
  lastFrameAt = 0;
  if (cancelled) $("stress-progress").textContent = "已停止，可重新測試";
}

function renderStress(rows, finished) {
  const host = $("stress-results");
  const budget = 1000 / 60;
  const tags = { oop: "OOP", ecs: "ECS", dod: "DOD" };
  const table = document.createElement("table");
  table.className = "stress-table";
  const heading = document.createElement("thead");
  heading.innerHTML = "<tr><th>工作負載（隻 × 次）</th><th>OOP</th><th>ECS</th><th>DOD</th></tr>";
  table.append(heading);
  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    const label = document.createElement("td");
    label.textContent = formatter.format(row.count) + " × " + row.substeps;
    tr.append(label);
    for (const kind of ["oop", "ecs", "dod"]) {
      const value = row.ms[kind];
      const td = document.createElement("td");
      td.className = value > budget ? "stress-over" : "stress-under";
      td.textContent = value.toFixed(2) + " ms " + (value > budget ? "▲" : "✓");
      td.title = tags[kind] + (value > budget ? " 超過" : " 尚未超過") + " 16.67ms 單執行緒預算";
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  host.replaceChildren(table);
  const text = document.createElement("p");
  text.className = "stress-caption";
  if (finished) {
    const stageFor = (kind) => rows.find(row => row.ms[kind] > budget);
    const found = ["oop", "ecs", "dod"].map(kind =>
      tags[kind] + "：" +
      (stageFor(kind) ? formatter.format(stageFor(kind).work) + " 更新/幀" : "測試上限內未超標")
    );
    text.textContent = "首次超過 16.67 ms 的工作量｜" + found.join("；") +
      "。這是 CPU 單執行緒模擬成本門檻，不是實際 FPS。";
  } else {
    text.textContent = "正在加壓：紅色表示該架構耗盡單幀 16.67 ms 的理論模擬預算。";
  }
  host.append(text);
}

$("stress-button").addEventListener("click", () => {
  if (benchmarking) return;
  if (typeof Worker === "undefined") {
    $("stress-progress").textContent = "這個瀏覽器不支援 Web Worker。";
    return;
  }
  benchmarking = true;
  wasPlayingBeforeStress = playing;
  if (playing) pauseButton.click();
  setStressControls(true);
  stressRows = [];
  $("stress-button").disabled = true;
  $("stress-stop").hidden = false;
  $("stress-progress").textContent = "正在初始化測試…";
  $("stress-results").innerHTML = '<p class="stress-placeholder">獨立運算執行緒測試中。可以隨時按「停止測試」。</p>';
  try {
    stressWorker = new Worker("./src/stress-worker.js", { type: "module" });
    stressWorker.onmessage = ({ data }) => {
      if (data.type === "stage") {
        stressRows.push(data.result);
        renderStress(stressRows, false);
        $("stress-progress").textContent = "已測 " + data.index + "/" + data.total + " 級";
      } else if (data.type === "done") {
        renderStress(stressRows, true);
        $("stress-progress").textContent = "完成，共 " + stressRows.length + " 級";
        stopStress(false);
      } else if (data.type === "error") {
        $("stress-progress").textContent = "測試失敗：" + data.message;
        stopStress(false);
      }
    };
    stressWorker.onerror = () => {
      $("stress-progress").textContent = "Worker 測試發生錯誤，請檢查瀏覽器 Console。";
      stopStress(false);
    };
    stressWorker.postMessage({ type: "start" });
  } catch (error) {
    $("stress-progress").textContent = "無法啟動測試：" + String(error);
    stopStress(false);
  }
});

$("stress-stop").addEventListener("click", () => {
  if (stressWorker) stopStress(true);
});
