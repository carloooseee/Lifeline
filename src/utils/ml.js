import * as tf from '@tensorflow/tfjs';

// --- File Paths ---
// 1. Naive Bayes (Urgency) Model
const NB_MODEL_PATH = '/models/nb_urgency_model.json';
// 2. LSTM (Category) Model
const LSTM_MODEL_PATH = '/models/tfjs_category_model/model.json';
// 3. LSTM (Category) Data (Tokenizer/Labels)
const LSTM_DATA_PATH = '/models/lstm_category_data.json';


// --- Global Storage ---
let nbModelData = null;
let lstmModel = null;
let lstmData = null;

// --- 1. NAIVE BAYES (URGENCY) FUNCTIONS ---

/**
 * Loads the Naive Bayes model parameters (vocabulary, weights)
 */
async function loadNBModel() {
  if (nbModelData) return nbModelData;
  try {
    const response = await fetch(NB_MODEL_PATH);
    nbModelData = await response.json();
    console.log('✅ Naive Bayes (Urgency) model loaded.');
    return nbModelData;
  } catch (error) {
    console.error('❌ Failed to load Naive Bayes model:', error);
    return null;
  }
}

/**
 * Preprocesses text for the Naive Bayes model (TF-IDF vector)
 */
function preprocessForNB(message, vocabulary, featureCount) {
  // Use the same cleaning function from your notebook
  const text = message.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const tokens = text.split(' ');
  const vector = new Array(featureCount).fill(0); // Create a zero vector
  
  for (const token of tokens) {
    if (vocabulary.hasOwnProperty(token)) {
      // Use the index from the saved vocabulary
      const index = vocabulary[token] - 1; // -1 because we added 1 in Python
      if (index >= 0 && index < featureCount) {
        vector[index] += 1; // Increment word count
      }
    }
  }
  return vector;
}

/**
 * Runs the Naive Bayes model to predict Urgency
 */
function classifyUrgencyNB(message) {
  if (!nbModelData) return { urgency: "N/A", urgencyConfidence: 0 };

  const { vocabulary, log_likelihoods, log_priors, labels, tfidf_feature_count } = nbModelData;
  
  // 1. Preprocess text into a word-count vector
  const vector = preprocessForNB(message, vocabulary, tfidf_feature_count);
  
  // 2. Calculate scores (log-probabilities)
  const scores = log_priors.map((class_log_prior, class_index) => {
    let score = class_log_prior;
    for (let word_index = 0; word_index < vector.length; word_index++) {
      if (vector[word_index] > 0) {
        score += log_likelihoods[class_index][word_index] * vector[word_index];
      }
    }
    return score;
  });

  // 3. Convert scores to probabilities (Softmax)
  const maxScore = Math.max(...scores);
  const exps = scores.map(score => Math.exp(score - maxScore));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map(exp => exp / sumExps);
  
  // 4. Get best prediction
  const best_index = probs.indexOf(Math.max(...probs));
  
  return {
    urgency: labels[best_index], // e.g., "High"
    urgencyConfidence: probs[best_index] * 100 // e.g., 55.9
  };
}


// --- 2. LSTM (CATEGORY) FUNCTIONS ---

/**
 * Loads the Keras LSTM model and the tokenizer data
 */
async function loadLSTMModel() {
  if (lstmModel && lstmData) return;
  try {
    // Load models in parallel
    const [modelResponse, dataResponse] = await Promise.all([
      !lstmModel ? tf.loadLayersModel(LSTM_MODEL_PATH) : Promise.resolve(lstmModel),
      !lstmData ? fetch(LSTM_DATA_PATH) : Promise.resolve(lstmData)
    ]);

    if (!lstmModel) {
      lstmModel = modelResponse;
      console.log('✅ LSTM (Category) model loaded.');
    }
    if (!lstmData) {
      lstmData = await dataResponse.json();
      console.log('✅ LSTM (Category) data loaded.');
    }
  } catch (error) {
    console.error('❌ Failed to load LSTM model/data:', error);
  }
}

/**
 * Preprocesses text for the LSTM model (Tokenize + Pad)
 */
function preprocessForLSTM(message) {
  if (!lstmData) return null;
  const { vocabulary, max_len } = lstmData;

  // Use the same cleaning function from your notebook
  const text = message.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const tokens = text.split(' ');
  
  let sequence = tokens.map(token => {
    return vocabulary[token] || 0; // 0 is the padding/OOV token
  });
  
  // Pad/Truncate
  if (sequence.length > max_len) {
    sequence = sequence.slice(0, max_len);
  } else {
    // Pad at the end (post-padding)
    sequence = sequence.concat(Array(max_len - sequence.length).fill(0));
  }
  
  // Convert to Tensor: [1, max_len]
  return tf.tensor2d([sequence], [1, max_len], 'int32');
}

/**
 * Runs the LSTM model to predict Category
 */
async function classifyCategoryLSTM(message) {
  if (!lstmModel || !lstmData) return { category: "N/A", categoryConfidence: 0 };

  const tensor = preprocessForLSTM(message);
  if (!tensor) return { category: "N/A", categoryConfidence: 0 };
  
  // 1. Make prediction
  const prediction = lstmModel.predict(tensor);
  const scores = await prediction.data();
  
  // 2. Get best prediction
  const best_index = scores.indexOf(Math.max(...scores));
  const confidence = scores[best_index] * 100;
  const category = lstmData.labels[best_index];
  
  tensor.dispose();
  prediction.dispose();
  
  return {
    category: category, // e.g., "Flood"
    categoryConfidence: confidence // e.g., 86.37
  };
}


// --- 3. FINAL UNIFIED FUNCTION ---

/**
 * Main function to classify an alert.
 * Runs BOTH models to get a Category and an Urgency.
 */
export const prioritizeAlert = async (message) => {
  // Run both models in parallel
  const [categoryResult, urgencyResult] = await Promise.all([
    classifyCategoryLSTM(message),
    classifyUrgencyNB(message)
  ]);

  // Combine the results
  return {
    category: categoryResult.category,
    categoryConfidence: categoryResult.categoryConfidence,
    urgency: urgencyResult.urgency,
    urgencyConfidence: urgencyResult.urgencyConfidence,
    // Create a final "Priority" score based on the urgency
    priority: urgencyResult.urgency === 'High' ? 5 : 3 // Simple 5 (High) or 3 (Medium)
  };
};

// --- 4. START LOADING MODELS IN BACKGROUND ---
// Kick off loading both models as soon as the app loads.
loadNBModel();
loadLSTMModel();