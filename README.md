# ECS / DOTS 實戰實驗室 — Swarm Arena

可直接在瀏覽器玩的群體追逐遊戲，透過 **OOP / ECS / DOD（DOTS 思想）** 三種實作比較真實更新耗時。

## 目的

- 控制光點躲避群體追逐（滑鼠、觸控、方向鍵或 WASD）。
- 即時調整實體數量，切換演算法並觀察模擬更新 ms、每秒更新量及 FPS。
- 使用「執行公平跑分」測試同一資料集、同一輸入軌跡、同樣的運算，**不包含 Canvas 繪製**，以免混淆渲染與邏輯成本。
- 認識 ECS 的資料／系統分離與 Data-Oriented Design 的連續資料儲存。

> **注意：** 這是**純 JavaScript 的 DOTS 風格示範**，**不是 Unity DOTS、Burst 或 Job System**。ECS 是程式組織方式，DOD 才是著重記憶體布局的設計方法；真實效能取決於瀏覽器、JIT 與裝置。**沒有任何情境是「非 ECS 不可」**，通常要先用 profiler 找出瓶頸。

## 使用

開啟 [GitHub Pages](https://t1ina2003.github.io/261113_ECS_DOTS/)（需要先設定 Pages）。或在本機用靜態檔伺服器開啟專案根目錄。

```bash
python -m http.server 8000
```

瀏覽 http://localhost:8000 。

## GitHub Pages

**Settings → Pages → Build and deployment → Deploy from a branch → `main` → `/(root)` → Save**

全站為靜態 HTML/CSS/JS ES Modules，無需 Node、套件安裝、API Key、後端、建置步驟。

## Git Flow

`main` 為對外部署、`develop` 為整合、`feature/swarm-arena` 為功能開發分支。

## 公平比較與限制

三種引擎共享初始位置及速度、相同單體更新公式與玩家路徑；跑分排除初始化與渲染；多次測量可能因 JIT、GC 與瀏覽器負載變動。JavaScript Float32Array 有捨入誤差，對大規模長時間模擬可能與 Number 版本有細微差異。


## 進階：電腦太快，如何找到瓶頸？

1. 遊戲上方「敵人數量」可提高到 250,000；「每幀模擬次數」可提高到 8×，觀察 FPS 與模擬耗時。
2. 下方「自動尋找運算瓶頸」會在 **Web Worker** 中以 9 級負載逐步測試，最高 250,000 × 32 = **800 萬次實體更新／模擬幀**。
3. 三種引擎在同級工作負載採用相同種子與運算步驟；每級 2 回合預熱、3 回合計時，取中位數。當三種實作都超過 **16.67ms**（單執行緒每幀 60 FPS 的理論上限）時自動停止。
4. 紅色標示超過理論預算，綠色標示尚未超過。頁面使用 Worker 以避免 UI 凍結，因此不能把測試表的時間視為主畫面的實際掉幀；也不能代表多執行緒極限。

在較慢的手機上請注意電池與溫度；可隨時按「停止測試」。這些結果**不是保證 DOTS 最快**，請將此實驗視為分析方法，而非通用性能排名。
