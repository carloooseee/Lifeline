// src/utils/ml.js
// Clean ONNX + NB pipeline for browser (no jsep, no threaded loaders)

import * as ort from "onnxruntime-web";


const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");


ort.env.wasm.wasmPaths = `${BASE_PATH}/onnx/`;
ort.env.wasm.simd = true;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

const CATEGORY_MODEL_URL      = `${BASE_PATH}/models/category_model.onnx`;
const VECTORIZER_URL          = `${BASE_PATH}/models/vectorizer.json`;
const CATEGORY_LABELS_URL     = `${BASE_PATH}/models/category_labels.json`;
const URGENCY_MODEL_URL       = `${BASE_PATH}/models/urgency_nb.json`;
const URGENCY_LABELS_URL      = `${BASE_PATH}/models/urgency_labels.json`;


// -----------------------------------------
let ortSession = null;
let vocab = null;
let vocabSize = null;
let categoryLabels = null;
let urgencyModel = null;
let urgencyLabels = null;
let featureIdf = null;
let categoryInputName = "input";

// -----------------------------------------
// Utils
// -----------------------------------------
function cleanAndTokens(text) {
  if (!text) return [];
  const cleaned = String(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+|www\.\S+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.split(" ") : [];
}

function buildCategoryVector(tokens) {
  const vec = new Float32Array(vocabSize);

  for (const tok of tokens) {
    const idx = vocab[tok];
    if (idx !== undefined && idx < vocabSize) {
      vec[idx] += 1;
    }
  }

  // If IDF exists, apply TF-IDF
  if (featureIdf && featureIdf.length === vocabSize) {
    for (let i = 0; i < vocabSize; i++) vec[i] *= featureIdf[i];
  } else {
    // Normalize TF
    const total = tokens.length || 1;
    for (let i = 0; i < vocabSize; i++) vec[i] /= total;
  }

  // L2 normalize
  let sum = 0;
  for (let v of vec) sum += v * v;
  const denom = Math.sqrt(sum) || 1;
  for (let i = 0; i < vocabSize; i++) vec[i] /= denom;

  return vec;
}

// -----------------------------------------
// Loaders
// -----------------------------------------
async function loadVectorizer() {
  if (vocab) return;

  const res = await fetch(VECTORIZER_URL);
  if (!res.ok) throw new Error("Missing vectorizer.json");

  const data = await res.json();
  vocab = data.vocabulary_ || data;

  featureIdf =
    Array.isArray(data.idf_) ? data.idf_.map(Number) :
    Array.isArray(data.idf)  ? data.idf.map(Number) :
    null;

  const indices = Object.values(vocab).filter(x => typeof x === "number");
  const maxIndex = Math.max(...indices);
  vocabSize = Math.max(maxIndex + 1, Object.keys(vocab).length);
}

async function loadCategoryModel() {
  if (ortSession) return ortSession;

  const opts = {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all"
  };

  ortSession = await ort.InferenceSession.create(CATEGORY_MODEL_URL, opts);

  if (ortSession.inputNames?.length > 0)
    categoryInputName = ortSession.inputNames[0];

  return ortSession;
}

async function loadLabels() {
  if (!categoryLabels) {
    categoryLabels = await (await fetch(CATEGORY_LABELS_URL)).json();
  }
  if (!urgencyLabels) {
    urgencyLabels = await (await fetch(URGENCY_LABELS_URL)).json();
  }
}

async function loadUrgencyModel() {
  if (urgencyModel) return;

  const json = await (await fetch(URGENCY_MODEL_URL)).json();
  const classes = urgencyLabels;

  const raw = json.feature_log_prob_;
  const nFeatures = raw[0].length;
  const nClasses = classes.length;

  const words = Array.from({ length: nFeatures }, () => new Array(nClasses));

  for (let c = 0; c < nClasses; c++)
    for (let f = 0; f < nFeatures; f++)
      words[f][c] = Number(raw[c][f]);

  urgencyModel = {
    classes,
    logProbs: {
      prior: json.class_log_prior_.map(Number),
      words
    }
  };
}

// -----------------------------------------
// Category prediction
// -----------------------------------------
async function predictCategory(text) {
  await Promise.all([loadVectorizer(), loadCategoryModel(), loadLabels()]);

  let vec = buildCategoryVector(cleanAndTokens(text));

  // -------- Safety: ensure correct size --------
  if (vec.length !== vocabSize) {
    console.warn("Vector size mismatch. Fixing…");
    const fixed = new Float32Array(vocabSize);
    fixed.set(vec.slice(0, vocabSize));
    vec = fixed;
  }

  // Remove NaN (WASM will crash if NaN)
  for (let i = 0; i < vec.length; i++) {
    if (!Number.isFinite(vec[i])) vec[i] = 0;
  }

  const tensor = new ort.Tensor("float32", vec, [1, vocabSize]);
  const out = await ortSession.run({ [categoryInputName]: tensor });

  const outputName = Object.keys(out)[0];
  const scores = Array.from(out[outputName].data);

  let maxI = 0;
  for (let i = 1; i < scores.length; i++)
    if (scores[i] > scores[maxI]) maxI = i;

  return { label: categoryLabels[maxI], scores };
}

// -----------------------------------------
// Urgency prediction
// -----------------------------------------
async function predictUrgency(text) {
  await Promise.all([loadVectorizer(), loadUrgencyModel(), loadLabels()]);

  const tokens = cleanAndTokens(text);
  const found = new Set();

  for (const tok of tokens) {
    const idx = vocab[tok];
    if (idx !== undefined) found.add(idx);
  }

  const scores = [...urgencyModel.logProbs.prior];

  for (const idx of found) {
    const row = urgencyModel.logProbs.words[idx];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) scores[c] += row[c];
  }

  let best = 0;
  for (let i = 1; i < scores.length; i++)
    if (scores[i] > scores[best]) best = i;

  return { label: urgencyModel.classes[best], scores };
}

// -----------------------------------------
// Public API
// -----------------------------------------
export async function prioritizeAlert(text) {
  const cleaned = text?.trim() || "HELP";

  const [cat, urg] = await Promise.all([
    predictCategory(cleaned).catch(() => ({ label: "Unknown", scores: [] })),
    predictUrgency(cleaned).catch(() => ({ label: "Unknown", scores: [] }))
  ]);

  return {
    category: cat.label,
    category_scores: cat.scores,
    urgency_level: urg.label,
    urgency_scores: urg.scores
  };
}

export async function prewarmModels() {
  try {
    await Promise.all([
      loadVectorizer(),
      loadCategoryModel(),
      loadUrgencyModel(),
      loadLabels()
    ]);
    console.log("ML assets pre-warmed.");
  } catch (e) {
    console.warn("Prewarm failed", e);
  }
}

prewarmModels();
