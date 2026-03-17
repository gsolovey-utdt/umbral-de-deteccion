const BASE_VALUE = 128;
const INITIAL_DELTA_LEVELS = [1, 2, 3, 4, 5, 6];
const REPETITIONS_PER_LEVEL = 5;
const LEVELS_PER_BLOCK = 6;
const TOTAL_TRIALS_PER_BLOCK = LEVELS_PER_BLOCK * REPETITIONS_PER_LEVEL;
const FEEDBACK_MS = 1000;
const CRITERION = 0.5;
const MAX_ADAPTIVE_BLOCKS = 3;
const HARDER_SCALE = 0.65;
const EASIER_SCALE = 1.45;
const MIN_DELTA = 0.25;
const MAX_DELTA = 127;

const ui = {
  welcomeScreen: document.getElementById("welcome-screen"),
  experimentScreen: document.getElementById("experiment-screen"),
  resultsScreen: document.getElementById("results-screen"),
  modeButtons: Array.from(document.querySelectorAll(".mode-btn")),
  startBtn: document.getElementById("start-btn"),
  restartBtn: document.getElementById("restart-btn"),
  trialProgress: document.getElementById("trial-progress"),
  trialInstruction: document.getElementById("trial-instruction"),
  stimulusArea: document.getElementById("stimulus-area"),
  regionOne: document.getElementById("region-one"),
  regionTwo: document.getElementById("region-two"),
  feedbackCanvas: document.getElementById("feedback-canvas"),
  feedbackOverlay: document.getElementById("feedback-overlay"),
  thresholdText: document.getElementById("threshold-text"),
  interpretationText: document.getElementById("interpretation-text"),
  invalidText: document.getElementById("invalid-text"),
  chartCanvas: document.getElementById("results-chart")
};

const state = {
  mode: "Gris",
  deltaLevels: [...INITIAL_DELTA_LEVELS],
  blockNumber: 1,
  trials: [],
  records: [],
  blockRecords: [],
  trialIndex: 0,
  currentTrial: null,
  currentOrientation: "vertical",
  currentBoundary: 0,
  baseInFirstRegion: true,
  trialStartTime: 0,
  awaitingResponse: false,
  chart: null
};

ui.startBtn.addEventListener("click", startExperiment);
ui.restartBtn.addEventListener("click", restartExperiment);
initializeModeSelection();

function startExperiment() {
  state.deltaLevels = [...INITIAL_DELTA_LEVELS];
  state.blockNumber = 1;
  state.records = [];
  startNewBlock();
  ui.invalidText.classList.add("hidden");
  ui.thresholdText.textContent = "";
  showScreen("experiment");
  runNextTrial();
}

function initializeModeSelection() {
  ui.modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (!mode) {
        return;
      }
      setSelectedMode(mode);
    });
  });
  setSelectedMode(state.mode);
}

function setSelectedMode(mode) {
  state.mode = mode;
  ui.modeButtons.forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

function restartExperiment() {
  detachResponseListeners();
  state.awaitingResponse = false;
  clearFeedbackLayer();
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }
  ui.invalidText.classList.add("hidden");
  ui.thresholdText.textContent = "";
  showScreen("welcome");
}

function startNewBlock() {
  state.trials = buildTrials(state.deltaLevels);
  state.blockRecords = [];
  state.trialIndex = 0;
}

function buildTrials(levels) {
  const trials = [];
  levels.forEach((delta, idx) => {
    for (let rep = 0; rep < REPETITIONS_PER_LEVEL; rep += 1) {
      trials.push({
        delta,
        deltaIndex: idx + 1
      });
    }
  });
  return shuffle(trials);
}

function runNextTrial() {
  if (state.trialIndex >= TOTAL_TRIALS_PER_BLOCK) {
    finishBlock();
    return;
  }

  state.currentTrial = state.trials[state.trialIndex];
  state.currentOrientation = getOrientationForDevice();
  state.currentBoundary = getRandomBoundary(state.currentOrientation);
  state.baseInFirstRegion = Math.random() < 0.5;

  updateTrialUi();
  drawStimulus();
  attachResponseListeners();
  state.awaitingResponse = true;
  state.trialStartTime = performance.now();
}

function updateTrialUi() {
  ui.trialProgress.textContent =
    `Bloque ${state.blockNumber} - Ensayo ${state.trialIndex + 1} de ${TOTAL_TRIALS_PER_BLOCK}`;
  ui.trialInstruction.textContent = state.currentOrientation === "vertical"
    ? "Hace clic donde crees que esta el borde."
    : "Toca donde crees que esta el borde.";
}

function drawStimulus() {
  const base = getBaseColor(state.mode);
  const comparison = buildComparisonColor(base, state.mode, state.currentTrial.delta);
  const baseColor = toRgb(base);
  const comparisonColor = toRgb(comparison);
  const firstColor = state.baseInFirstRegion ? baseColor : comparisonColor;
  const secondColor = state.baseInFirstRegion ? comparisonColor : baseColor;

  if (state.currentOrientation === "vertical") {
    const x = state.currentBoundary;
    ui.regionOne.style.left = "0px";
    ui.regionOne.style.top = "0px";
    ui.regionOne.style.width = `${x}px`;
    ui.regionOne.style.height = "100%";
    ui.regionOne.style.background = firstColor;

    ui.regionTwo.style.left = `${x}px`;
    ui.regionTwo.style.top = "0px";
    ui.regionTwo.style.width = `calc(100% - ${x}px)`;
    ui.regionTwo.style.height = "100%";
    ui.regionTwo.style.background = secondColor;
  } else {
    const y = state.currentBoundary;
    ui.regionOne.style.left = "0px";
    ui.regionOne.style.top = "0px";
    ui.regionOne.style.width = "100%";
    ui.regionOne.style.height = `${y}px`;
    ui.regionOne.style.background = firstColor;

    ui.regionTwo.style.left = "0px";
    ui.regionTwo.style.top = `${y}px`;
    ui.regionTwo.style.width = "100%";
    ui.regionTwo.style.height = `calc(100% - ${y}px)`;
    ui.regionTwo.style.background = secondColor;
  }

  clearFeedbackLayer();
}

function drawNeutralBackground() {
  const base = toRgb(getBaseColor(state.mode));
  ui.regionOne.style.left = "0px";
  ui.regionOne.style.top = "0px";
  ui.regionOne.style.width = "100%";
  ui.regionOne.style.height = "100%";
  ui.regionOne.style.background = base;
  ui.regionTwo.style.width = "0px";
  ui.regionTwo.style.height = "0px";
}

function getBaseColor(mode) {
  if (mode === "Rojo") {
    return { r: BASE_VALUE, g: 0, b: 0 };
  }
  if (mode === "Verde") {
    return { r: 0, g: BASE_VALUE, b: 0 };
  }
  if (mode === "Azul") {
    return { r: 0, g: 0, b: BASE_VALUE };
  }
  return { r: BASE_VALUE, g: BASE_VALUE, b: BASE_VALUE };
}

function buildComparisonColor(base, mode, delta) {
  const out = { ...base };

  if (mode === "Gris") {
    out.r = clamp(base.r + delta, 0, 255);
    out.g = clamp(base.g + delta, 0, 255);
    out.b = clamp(base.b + delta, 0, 255);
  } else if (mode === "Rojo") {
    out.r = clamp(base.r + delta, 0, 255);
  } else if (mode === "Verde") {
    out.g = clamp(base.g + delta, 0, 255);
  } else if (mode === "Azul") {
    out.b = clamp(base.b + delta, 0, 255);
  }

  return out;
}

function getOrientationForDevice() {
  const phoneLike = window.matchMedia("(max-width: 900px) and (pointer: coarse)").matches;
  return phoneLike ? "horizontal" : "vertical";
}

function getRandomBoundary(orientation) {
  const rect = ui.stimulusArea.getBoundingClientRect();
  const dimension = orientation === "vertical" ? rect.width : rect.height;
  let margin = Math.max(20, Math.round(dimension * 0.08));
  const maxPossible = Math.max(20, Math.floor(dimension / 2) - 8);
  margin = Math.min(margin, maxPossible);

  const min = margin;
  const max = dimension - margin;
  if (max <= min) {
    return Math.round(dimension / 2);
  }
  return min + Math.random() * (max - min);
}

function attachResponseListeners() {
  detachResponseListeners();
  if (state.currentOrientation === "vertical") {
    ui.stimulusArea.addEventListener("click", onClickResponse);
  } else {
    ui.stimulusArea.addEventListener("touchstart", onTouchResponse, { passive: false });
    if (!("ontouchstart" in window)) {
      ui.stimulusArea.addEventListener("click", onClickResponse);
    }
  }
}

function detachResponseListeners() {
  ui.stimulusArea.removeEventListener("click", onClickResponse);
  ui.stimulusArea.removeEventListener("touchstart", onTouchResponse);
}

function onClickResponse(event) {
  if (!state.awaitingResponse) {
    return;
  }
  const rect = ui.stimulusArea.getBoundingClientRect();
  const position = state.currentOrientation === "vertical"
    ? event.clientX - rect.left
    : event.clientY - rect.top;
  processResponse(position);
}

function onTouchResponse(event) {
  if (!state.awaitingResponse) {
    return;
  }
  event.preventDefault();
  const touch = event.changedTouches[0];
  if (!touch) {
    return;
  }
  const rect = ui.stimulusArea.getBoundingClientRect();
  const position = state.currentOrientation === "vertical"
    ? touch.clientX - rect.left
    : touch.clientY - rect.top;
  processResponse(position);
}

function processResponse(responsePosition) {
  if (!state.awaitingResponse) {
    return;
  }

  state.awaitingResponse = false;
  detachResponseListeners();

  const reactionTime = Math.round(performance.now() - state.trialStartTime);
  const error = Math.abs(responsePosition - state.currentBoundary);
  const tolerance = getTolerancePx();
  const correct = error <= tolerance ? 1 : 0;
  const feedbackMessage = getFeedbackMessage(error);

  drawFeedback(responsePosition, feedbackMessage, error);
  saveTrialRecord(responsePosition, error, correct, reactionTime);

  window.setTimeout(() => {
    state.trialIndex += 1;
    runNextTrial();
  }, FEEDBACK_MS);
}

function getTolerancePx() {
  const smallestSide = Math.min(window.innerWidth, window.innerHeight);
  return smallestSide < 360 ? 14 : 10;
}

function getFeedbackMessage(error) {
  if (error <= 5) {
    return "Impresionante";
  }
  if (error <= 20) {
    return "Fallaste por poco";
  }
  return "Fallaste por mucho";
}

function drawFeedback(responsePosition, feedbackMessage, error) {
  const canvas = ui.feedbackCanvas;
  const rect = ui.stimulusArea.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.lineWidth = 3;

  if (state.currentOrientation === "vertical") {
    drawVerticalMarker(ctx, state.currentBoundary, rect.height, "#0f8a52");
    drawVerticalMarker(ctx, responsePosition, rect.height, "#d9480f");
    drawLabel(ctx, "Borde real", state.currentBoundary + 6, 20, "#0f8a52", rect.width);
    drawLabel(ctx, "Tu eleccion", responsePosition + 6, 40, "#d9480f", rect.width);
  } else {
    drawHorizontalMarker(ctx, state.currentBoundary, rect.width, "#0f8a52");
    drawHorizontalMarker(ctx, responsePosition, rect.width, "#d9480f");
    drawLabel(ctx, "Borde real", 8, state.currentBoundary - 8, "#0f8a52", rect.width);
    drawLabel(ctx, "Tu eleccion", 8, responsePosition - 8, "#d9480f", rect.width);
  }

  ui.feedbackOverlay.textContent = `${feedbackMessage} | Error: ${error.toFixed(1)} px`;
  ui.feedbackOverlay.classList.remove("hidden");
}

function drawVerticalMarker(ctx, x, height, color) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}

function drawHorizontalMarker(ctx, y, width, color) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

function drawLabel(ctx, text, x, y, color, maxWidth) {
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "bold 13px Trebuchet MS";
  const safeX = clamp(x, 4, Math.max(4, maxWidth - 120));
  const safeY = clamp(y, 16, ctx.canvas.height);
  const textWidth = ctx.measureText(text).width + 10;
  ctx.fillRect(safeX - 4, safeY - 12, textWidth, 18);
  ctx.fillStyle = color;
  ctx.fillText(text, safeX, safeY);
}

function clearFeedbackLayer() {
  const canvas = ui.feedbackCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ui.feedbackOverlay.classList.add("hidden");
  ui.feedbackOverlay.textContent = "";
}

function saveTrialRecord(responsePosition, error, correct, reactionTime) {
  const orientation = state.currentOrientation;
  const firstSide = orientation === "vertical" ? "izquierda" : "arriba";
  const secondSide = orientation === "vertical" ? "derecha" : "abajo";
  const record = {
    trialNumber: state.records.length + 1,
    blockNumber: state.blockNumber,
    trialInBlock: state.trialIndex + 1,
    colorMode: state.mode,
    deltaLevelIndex: state.currentTrial.deltaIndex,
    deltaValue: round2(state.currentTrial.delta),
    trueBoundaryPx: round2(state.currentBoundary),
    responsePx: round2(responsePosition),
    absoluteErrorPx: round2(error),
    correct,
    reactionTimeMs: reactionTime,
    orientationUsed: orientation,
    baseSide: state.baseInFirstRegion ? firstSide : secondSide,
    comparisonSide: state.baseInFirstRegion ? secondSide : firstSide
  };

  state.records.push(record);
  state.blockRecords.push(record);
}

function finishBlock() {
  const stats = computeStatsByLevel(state.deltaLevels, state.blockRecords);
  const quality = evaluateBlockQuality(stats);
  const shouldAdapt = (quality.allAboveCriterion || quality.allBelowCriterion)
    && state.blockNumber < MAX_ADAPTIVE_BLOCKS;

  if (shouldAdapt) {
    const direction = quality.allAboveCriterion ? "harder" : "easier";
    const previousLevels = [...state.deltaLevels];
    state.deltaLevels = adjustDeltaLevels(state.deltaLevels, direction);
    state.blockNumber += 1;
    startNewBlock();
    showAdaptiveTransition(direction, previousLevels, state.deltaLevels);
    return;
  }

  finishExperiment(stats, quality);
}

function showAdaptiveTransition(direction, previousLevels, nextLevels) {
  drawNeutralBackground();
  clearFeedbackLayer();
  const msg = direction === "harder"
    ? "Ajuste automatico: ahora la diferencia de color es mas sutil."
    : "Ajuste automatico: ahora la diferencia de color es mayor.";

  ui.trialProgress.textContent = `Comienza bloque ${state.blockNumber}`;
  ui.trialInstruction.textContent = msg;
  ui.feedbackOverlay.textContent =
    `${msg} Nuevos deltas: ${formatDeltaList(nextLevels)} (antes: ${formatDeltaList(previousLevels)}).`;
  ui.feedbackOverlay.classList.remove("hidden");

  window.setTimeout(() => {
    ui.feedbackOverlay.classList.add("hidden");
    runNextTrial();
  }, 1600);
}

function finishExperiment(stats, quality) {
  showScreen("results");
  const invalid = quality.allVeryHigh
    || quality.allVeryLow
    || quality.stronglyDecreasing
    || quality.allAboveCriterion
    || quality.allBelowCriterion;

  ui.invalidText.classList.toggle("hidden", !invalid);

  if (invalid) {
    ui.thresholdText.textContent = "Umbral estimado: no disponible";
    renderResultsChart(stats, null, null);
    return;
  }

  const estimate = estimateThreshold(stats, CRITERION);
  if (!estimate || !Number.isFinite(estimate.threshold)) {
    ui.thresholdText.textContent = "Umbral estimado: no disponible";
    renderResultsChart(stats, null, null);
    ui.invalidText.classList.remove("hidden");
    return;
  }

  const thresholdRounded = estimate.threshold.toFixed(2);
  ui.thresholdText.textContent = `Umbral estimado: ${thresholdRounded}`;
  renderResultsChart(stats, estimate.curve, estimate.threshold);
}

function computeStatsByLevel(deltaLevels, records) {
  return deltaLevels.map((delta, index) => {
    const levelIndex = index + 1;
    const rows = records.filter((r) => r.deltaLevelIndex === levelIndex);
    const n = rows.length;
    const nCorrect = rows.reduce((acc, row) => acc + row.correct, 0);
    return {
      delta,
      deltaIndex: levelIndex,
      n,
      nCorrect,
      proportionCorrect: n > 0 ? nCorrect / n : 0
    };
  });
}

function evaluateBlockQuality(stats) {
  const proportions = stats.map((s) => s.proportionCorrect);
  const allAboveCriterion = proportions.every((p) => p > CRITERION);
  const allBelowCriterion = proportions.every((p) => p < CRITERION);
  const allVeryHigh = proportions.every((p) => p >= 0.8);
  const allVeryLow = proportions.every((p) => p <= 0.2);
  const corr = pearsonCorrelation(
    proportions.map((_, idx) => idx + 1),
    proportions
  );
  const netDrop = proportions[0] - proportions[proportions.length - 1];
  const stronglyDecreasing = corr < -0.75 && netDrop > 0.25;

  return {
    allAboveCriterion,
    allBelowCriterion,
    allVeryHigh,
    allVeryLow,
    stronglyDecreasing
  };
}

function adjustDeltaLevels(levels, direction) {
  const scale = direction === "harder" ? HARDER_SCALE : EASIER_SCALE;
  return levels.map((delta) => round2(clamp(delta * scale, MIN_DELTA, MAX_DELTA)));
}

function estimateThreshold(stats, criterion) {
  const xs = stats.map((s) => s.delta);
  const ys = stats.map((s) => s.proportionCorrect);
  const logisticFit = fitLogistic(xs, ys);

  if (logisticFit && logisticFit.valid && logisticFit.b > 0) {
    const threshold = logisticFit.thresholdAt(criterion);
    if (Number.isFinite(threshold)) {
      const curve = buildCurveFromFunction(xs[0], xs[xs.length - 1], (x) => logisticFit.predict(x));
      return {
        method: "logistico",
        threshold,
        curve
      };
    }
  }

  const fallback = nearestToCriterion(stats, criterion);
  const curve = interpolateCurve(stats, 80);
  return {
    method: "observado",
    threshold: fallback.delta,
    curve
  };
}

function fitLogistic(xs, ys) {
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const span = Math.max(1e-6, maxX - minX);
  const zx = xs.map((x) => (x - minX) / span);

  let a = 0;
  let b = 1;
  const lr = 0.35;
  const iters = 5000;

  for (let i = 0; i < iters; i += 1) {
    let gradA = 0;
    let gradB = 0;

    for (let j = 0; j < zx.length; j += 1) {
      const z = zx[j];
      const y = ys[j];
      const pred = sigmoid(a + b * z);
      const err = pred - y;
      const common = 2 * err * pred * (1 - pred);
      gradA += common;
      gradB += common * z;
    }

    a -= (lr * gradA) / zx.length;
    b -= (lr * gradB) / zx.length;
  }

  const predict = (x) => {
    const z = (x - minX) / span;
    return sigmoid(a + b * z);
  };

  const thresholdAt = (criterion) => {
    if (criterion <= 0 || criterion >= 1 || Math.abs(b) < 1e-6) {
      return Number.NaN;
    }
    const logit = Math.log(criterion / (1 - criterion));
    const z = (logit - a) / b;
    const threshold = minX + z * span;
    if (threshold < minX || threshold > maxX) {
      return Number.NaN;
    }
    return threshold;
  };

  const threshold50 = thresholdAt(0.5);
  const valid = Number.isFinite(threshold50);

  return { a, b, valid, predict, thresholdAt };
}

function renderResultsChart(stats, curve, thresholdValue) {
  const observed = stats.map((s) => ({ x: s.delta, y: s.proportionCorrect }));
  const minDelta = Math.min(...stats.map((s) => s.delta));
  const maxDelta = Math.max(...stats.map((s) => s.delta));

  const datasets = [
    {
      label: "Proporcion observada",
      data: observed,
      borderColor: "#126a9a",
      backgroundColor: "#126a9a",
      borderWidth: 2,
      tension: 0,
      pointRadius: 5,
      pointHoverRadius: 6,
      showLine: true
    }
  ];

  if (curve && curve.length > 1) {
    datasets.push({
      label: "Curva de sensibilidad",
      data: curve,
      borderColor: "#0f8a52",
      backgroundColor: "#0f8a52",
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.25,
      showLine: true
    });
  }

  datasets.push({
    label: "Criterio (0.5)",
    data: [
      { x: minDelta, y: CRITERION },
      { x: maxDelta, y: CRITERION }
    ],
    borderColor: "#7f8a9d",
    borderDash: [8, 6],
    borderWidth: 2,
    pointRadius: 0,
    tension: 0,
    showLine: true
  });

  if (Number.isFinite(thresholdValue)) {
    datasets.push({
      label: "Umbral estimado",
      data: [{ x: thresholdValue, y: CRITERION }],
      borderColor: "#d9480f",
      backgroundColor: "#d9480f",
      pointRadius: 6,
      pointHoverRadius: 7,
      showLine: false
    });
  }

  if (state.chart) {
    state.chart.destroy();
  }

  if (typeof Chart === "undefined") {
    ui.thresholdText.textContent += " | No se pudo cargar el grafico.";
    return;
  }

  state.chart = new Chart(ui.chartCanvas, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          labels: {
            color: "#243249",
            filter(item, chartData) {
              const label = chartData.datasets[item.datasetIndex]?.label;
              return label === "Proporcion observada" || label === "Curva de sensibilidad";
            }
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          min: minDelta,
          max: maxDelta,
          title: {
            display: true,
            text: "Delta (diferencia de color)"
          },
          ticks: {
            callback(value) {
              return Number(value).toFixed(2).replace(/\.00$/, "");
            }
          }
        },
        y: {
          min: 0,
          max: 1,
          title: {
            display: true,
            text: "Proporcion correcta"
          }
        }
      }
    }
  });
}

function nearestToCriterion(stats, criterion) {
  return stats.reduce((best, item) => {
    const diff = Math.abs(item.proportionCorrect - criterion);
    if (!best || diff < best.diff) {
      return { diff, delta: item.delta };
    }
    return best;
  }, null);
}

function interpolateCurve(stats, pointsCount) {
  const out = [];
  const min = stats[0].delta;
  const max = stats[stats.length - 1].delta;

  for (let i = 0; i <= pointsCount; i += 1) {
    const x = min + ((max - min) * i) / pointsCount;
    out.push({ x, y: interpolateY(stats, x) });
  }
  return out;
}

function interpolateY(stats, x) {
  for (let i = 0; i < stats.length - 1; i += 1) {
    const a = stats[i];
    const b = stats[i + 1];
    if (x >= a.delta && x <= b.delta) {
      const t = (x - a.delta) / (b.delta - a.delta);
      return a.proportionCorrect + t * (b.proportionCorrect - a.proportionCorrect);
    }
  }
  return stats[stats.length - 1].proportionCorrect;
}

function buildCurveFromFunction(min, max, fn) {
  const curve = [];
  const steps = 90;
  for (let i = 0; i <= steps; i += 1) {
    const x = min + ((max - min) * i) / steps;
    curve.push({ x, y: clamp(fn(x), 0, 1) });
  }
  return curve;
}

function showScreen(name) {
  ui.welcomeScreen.classList.toggle("hidden", name !== "welcome");
  ui.experimentScreen.classList.toggle("hidden", name !== "experiment");
  ui.resultsScreen.classList.toggle("hidden", name !== "results");
}

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n !== ys.length || n === 0) {
    return 0;
  }
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : 0;
}

function formatDeltaList(levels) {
  return levels.map((v) => v.toFixed(2).replace(/\.00$/, "")).join(", ");
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function toRgb(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
