import * as tf from '@tensorflow/tfjs';

// --- Model Asset Paths ---
// (This assumes you will place your 4 JSON files in the 'public/' directory)
const CATEGORY_MODEL_URL = '/model.json';
const CATEGORY_TOKENIZER_URL = '/tokenizer_category.json';
const URGENCY_MODEL_URL = '/urgency_nb.json';
const URGENCY_VOCAB_URL = '/tfidf_vectorizer.json';

// --- Constants ---
const MAX_LEN_CATEGORY = 50; // From your model's input shape

/**
 * 🔴 CRITICAL: UPDATE THIS ARRAY 🔴
 * Your category model ('model.json') outputs 10 categories (indices 0-9).
 * You must replace these generic names with your actual category labels
 * in the exact order they were in during training.
 */
const CATEGORY_LABELS = [
  'Category 0: Hurricane', 
  'Category 1: Fire', 
  'Category 2: Rescue/Trapped', 
  'Category 3: Power Outage', 
  'Category 4: Flood', 
  'Category 5: Earthquake', 
  'Category 6: Medical Emergency', 
  'Category 7: Drought', 
  'Category 8: Injury', 
  'Category 9: Crime/Violence'
  // (The names above are just logical guesses, you MUST update them)
];


// --- Cached ML Assets ---
let categoryModel = null;
let categoryWordIndex = null;
let urgencyModel = null;
let urgencyVocab = null;

// --- Asset Loader Functions ---

/**
 * Loads and caches the Keras LSTM model and its tokenizer.
 */
async function loadCategoryAssets() {
  if (categoryModel && categoryWordIndex) return;
  
  try {
    // Load the model
    categoryModel = await tf.loadLayersModel(CATEGORY_MODEL_URL);
    
    // Load the tokenizer word index
    const tokenizerResponse = await fetch(CATEGORY_TOKENIZER_URL);
    const tokenizerData = await tokenizerResponse.json();
    // The word_index is stored as a JSON string within the main JSON config
    categoryWordIndex = JSON.parse(tokenizerData.config.word_index); 
    
    console.log("Category ML assets loaded.");
  } catch (err) {
    console.error("Error loading category ML assets:", err);
    throw new Error("Could not load category model.");
  }
}

/**
 * Loads and caches the Naive Bayes model and its TF-IDF vocabulary.
 */
async function loadUrgencyAssets() {
  if (urgencyModel && urgencyVocab) return;
  
  try {
    // Load the Naive Bayes model params
    const modelResponse = await fetch(URGENCY_MODEL_URL);
    urgencyModel = await modelResponse.json();
    
    // Load the TF-IDF vocabulary
    const vocabResponse = await fetch(URGENCY_VOCAB_URL);
    urgencyVocab = await vocabResponse.json();
    
    console.log("Urgency ML assets loaded.");
  } catch (err) {
    console.error("Error loading urgency ML assets:", err);
    throw new Error("Could not load urgency model.");
  }
}

// --- Pipeline 1: Category Prediction (TensorFlow.js) ---

/**
 * Processes raw text into a tokenized, padded sequence for the Keras model.
 * @param {string} text - The user's input message.
 * @returns {number[]} A sequence array of length MAX_LEN_CATEGORY.
 */
function processTextForCategory(text) {
  // 1. Clean text (lowercase and remove punctuation based on tokenizer's filters)
  const cleanText = text
    .toLowerCase()
    .replace(/[!"#$%&()*+,-./:;<=>?@[\\]^_`{|}~\t\n]/g, ' ') // Replace with space
    .trim();

  // 2. Tokenize
  const tokens = cleanText.split(' ').filter(Boolean); // Split by space and remove empty strings
  
  // 3. Convert tokens to integers using the word index
  let sequence = tokens.map(token => {
    return categoryWordIndex[token] || 1; // 1 is the <OOV> token index
  });

  // 4. Pad or Truncate the sequence
  if (sequence.length > MAX_LEN_CATEGORY) {
    // Truncate from the beginning (Keras default)
    sequence = sequence.slice(sequence.length - MAX_LEN_CATEGORY); 
  } else if (sequence.length < MAX_LEN_CATEGORY) {
    // Pad with 0s at the beginning (Keras default)
    const padding = Array(MAX_LEN_CATEGORY - sequence.length).fill(0);
    sequence = padding.concat(sequence);
  }
  
  return sequence;
}

/**
 * Predicts the disaster category using the loaded LSTM model.
 * @param {string} text - The user's input message.
 * @returns {Promise<string>} The predicted category name.
 */
async function predictCategory(text) {
  await loadCategoryAssets();
  
  const sequence = processTextForCategory(text);
  const tensor = tf.tensor2d([sequence], [1, MAX_LEN_CATEGORY], 'int32');
  
  let predictionTensor;
  try {
    // Run prediction
    predictionTensor = categoryModel.predict(tensor);
    // Get the index of the highest probability
    const categoryIndex = (await predictionTensor.argMax(1).data())[0];
    
    return CATEGORY_LABELS[categoryIndex] || "Unknown Category";
  } finally {
    // Clean up memory
    tensor.dispose(); 
    if (predictionTensor) predictionTensor.dispose();
  }
}

// --- Pipeline 2: Urgency Prediction (Naive Bayes) ---

/**
 * Processes raw text into a list of vocab indices for the Naive Bayes model.
 * @param {string} text - The user's input message.
 * @returns {number[]} A list of indices corresponding to the urgency vocab.
 */
function processTextForUrgency(text) {
  // 1. Clean text (lowercase, remove punctuation, consolidate whitespace)
  const cleanText = text
    .toLowerCase()
    .replace(/[!"#$%&()*+,-./:;<=>?@[\\]^_`{|}~\t\n]/g, ' ') 
    .replace(/\s+/g, ' ')
    .trim();
    
  const tokens = cleanText.split(' ');
  const ngrams = new Set();

  // 2. Get all unigrams (single words)
  for (const token of tokens) {
    if (urgencyVocab.hasOwnProperty(token)) {
      ngrams.add(token);
    }
  }

  // 3. Get all bigrams (two words)
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i+1]}`;
    if (urgencyVocab.hasOwnProperty(bigram)) {
      ngrams.add(bigram);
    }
  }

  // 4. Map the found ngrams to their indices
  return Array.from(ngrams).map(ngram => urgencyVocab[ngram]);
}

/**
 * Predicts the urgency level using the loaded Naive Bayes model.
 * @param {string} text - The user's input message.
 * @returns {Promise<string>} The predicted urgency level ("High" or "Medium").
 */
async function predictUrgency(text) {
  await loadUrgencyAssets();
  
  const { classes, logProbs } = urgencyModel; // classes = ["High", "Medium"]
  const { prior: logPriors, words: logWordProbs } = logProbs;
  
  const ngramIndices = processTextForUrgency(text);
  
  // Start with the prior probabilities for "High" and "Medium"
  const scores = logPriors.slice(); 
  
  // Add the log probabilities for each word/ngram found in the text
  for (const index of ngramIndices) {
    if (logWordProbs[index]) {
      scores[0] += logWordProbs[index][0]; // Add log prob for "High"
      scores[1] += logWordProbs[index][1]; // Add log prob for "Medium"
    }
  }
  
  // Find the class with the highest score
  const maxScore = Math.max(...scores);
  const bestClassIndex = scores.indexOf(maxScore);
  
  return classes[bestClassIndex] || "Unknown";
}


// --- Main Export Function ---

/**
 * Runs both ML pipelines in parallel to get category and urgency.
 * This is the function called by Home.jsx.
 * @param {string} text - The user's raw message.
 * @returns {Promise<{category: string, urgency_level: string}>}
 */
export const prioritizeAlert = async (text) => {
  // If the message is empty, use the default "HELP"
  const AIBot = "I'm sorry, I can't provide assistance with that."
  const safeText = (text.trim() === "" || text.trim() === AIBot) ? "HELP" : text;

  try {
    // Run both predictions at the same time
    const [category, urgency_level] = await Promise.all([
      predictCategory(safeText),
      predictUrgency(safeText)
    ]);

    return { category, urgency_level };
  } catch (err) {
    console.error("Full ML Pipeline Error:", err);
    // This fallback is caught by your try...catch block in Home.jsx
    throw err; 
  }
};

// --- Pre-warming ---
// Call this to load models as soon as the app loads, 
// so the first click isn't slow.
(async () => {
  try {
    await Promise.all([
      loadCategoryAssets(),
      loadUrgencyAssets()
    ]);
    console.log("All ML models pre-warmed.");
  } catch (err) {
    console.warn("Could not pre-warm ML models:", err);
  }
})();