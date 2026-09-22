// ai-nlp.service.js
// Medical Named Entity Recognition (NER), Symptom, Intent, Negation, Duration, Severity, & Multilingual NLP Engine.

const SYMPTOM_DICTIONARY = [
  'chest pain', 'chest discomfort', 'shortness of breath', 'difficulty breathing', 'breathlessness', 'fever', 'feever', 'headache', 'hedache',
  'cough', 'fatigue', 'nausea', 'vomiting', 'dizziness', 'diarrhea', 'sore throat', 'rash',
  'abdominal pain', 'tummy ache', 'back pain', 'joint pain', 'muscle pain', 'weakness', 'sweating', 'chills',
  'runny nose', 'congestion', 'loss of appetite', 'insomnia', 'heartburn', 'constipation',
  'swelling', 'itchiness', 'blurry vision', 'ear pain', 'palpitations', 'facial drooping', 'slurred speech',
  // Hindi & Gujarati & Hinglish
  'seene mein dard', 'seene me dard', 'chhati mein dard', 'chhati me dard', 'dil mein dard',
  'saans lene mein takleef', 'saans lene me takleef', 'saans phoolna',
  'છાતીમાં દુખાવો', 'છાતીમાં ભારે દુખાવો', 'શ્વાસ લેવામાં તકલીફ', 'તાવ', 'માથાનો દુખાવો'
];

const SYNONYM_MAP = {
  'chest discomfort': 'chest pain',
  'chhati me dard': 'chest pain',
  'chhati mein dard': 'chest pain',
  'seene me dard': 'chest pain',
  'seene mein dard': 'chest pain',
  'છાતીમાં દુખાવો': 'chest pain',
  'hedache': 'headache',
  'head pain': 'headache',
  'માથાનો દુખાવો': 'headache',
  'feever': 'fever',
  'તાવ': 'fever',
  'tummy ache': 'abdominal pain',
  'saans lene me takleef': 'shortness of breath',
  'શ્વાસ લેવામાં તકલીફ': 'shortness of breath'
};

const MEDICATION_DICTIONARY = [
  'amoxicillin', 'paracetamol', 'ibuprofen', 'aspirin', 'metformin', 'atorvastatin',
  'cetirizine', 'azithromycin', 'pantoprazole', 'amlodipine', 'losartan', 'omeprazole'
];

const ALLERGY_DICTIONARY = [
  'penicillin', 'peanuts', 'sulfa', 'latex', 'dust', 'pollen', 'shellfish', 'dairy', 'eggs', 'soy'
];

const SEVERITY_PATTERNS = [
  { pattern: /\b(severe|intense|unbearable|extreme|excruciating|terrible|very high|very bad|ખૂબ|બહુ)\b/i, level: 'SEVERE' },
  { pattern: /\b(moderate|noticeable|medium)\b/i, level: 'MODERATE' },
  { pattern: /\b(mild|slight|minor|little|light|હળવો)\b/i, level: 'MILD' }
];

const DURATION_PATTERNS = [
  /\b(\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?))\b/i,
  /\b(for\s+\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?))\b/i,
  /\b(since\s+(?:yesterday|morning|last night|2 days ago|\d+\s*days?))\b/i
];

const INTENT_PATTERNS = {
  EMERGENCY: /\b(sos|emergency|ambulance|911|108|112|report emergency|dying|collapsed|માટે કટોકટી)\b/i,
  INFORMATIONAL: /\b(what is|what causes|meaning of|explain|tell me about|definition of|learn about|information on|why does|how does|અર્થ શું છે)\b/i,
  MEDICATION: /\b(medication|medicine|meds|drug|dose|dosage|prescription|pill|side effect|combine|take with|દવા)\b/i,
  FIRST_AID: /\b(first aid|wound|cut|burn|bandage|bleeding|sprain|sting|bite|પ્રાથમિક સારવાર)\b/i,
  SYMPTOM_CHECK: /\b(symptom|feel|feeling|pain|fever|cough|headache|sick|hurting|ache|dizzy|nausea|દુખાવો)\b/i
};

/**
 * Perform Medical Named Entity Recognition (NER) and NLP Extraction on text input.
 */
function processNLP(text) {
  if (!text || typeof text !== 'string') {
    return {
      symptoms: [],
      negatedSymptoms: [],
      intent: 'GENERAL_HEALTH',
      duration: null,
      severity: 'UNSPECIFIED',
      medications: [],
      allergies: [],
      entities: []
    };
  }

  const lower = text.toLowerCase();
  const entities = [];
  const symptoms = [];
  const negatedSymptoms = [];
  const medications = [];
  const allergies = [];

  // 1. Duration extraction
  let duration = null;
  for (const regex of DURATION_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      duration = match[0].trim();
      entities.push({ type: 'DURATION', value: duration });
      break;
    }
  }

  // 2. Severity extraction
  let severity = 'UNSPECIFIED';
  for (const { pattern, level } of SEVERITY_PATTERNS) {
    if (pattern.test(text)) {
      severity = level;
      entities.push({ type: 'SEVERITY', value: level });
      break;
    }
  }

  // 3. Negation detection helper
  const isNegated = (word) => {
    const idx = lower.indexOf(word.toLowerCase());
    if (idx === -1) return false;
    const prefix = lower.slice(Math.max(0, idx - 40), idx).trim();
    return /\b(no|not|don'?t|does'?n'?t|did'?n'?t|without|free of|negative for|deny|denies|ruled out|નથી)\b/i.test(prefix);
  };

  // 4. Symptom NER with Synonym Normalization
  for (const rawSym of SYMPTOM_DICTIONARY) {
    if (lower.includes(rawSym)) {
      const canonicalSym = SYNONYM_MAP[rawSym] || rawSym;
      if (isNegated(rawSym)) {
        if (!negatedSymptoms.includes(canonicalSym)) negatedSymptoms.push(canonicalSym);
        entities.push({ type: 'NEGATED_SYMPTOM', raw: rawSym, value: canonicalSym });
      } else {
        if (!symptoms.includes(canonicalSym)) symptoms.push(canonicalSym);
        entities.push({ type: 'SYMPTOM', raw: rawSym, value: canonicalSym });
      }
    }
  }

  // 5. Medication NER
  for (const med of MEDICATION_DICTIONARY) {
    if (lower.includes(med)) {
      medications.push(med);
      entities.push({ type: 'MEDICATION', value: med });
    }
  }

  // 6. Allergy NER
  for (const all of ALLERGY_DICTIONARY) {
    if (lower.includes(all)) {
      allergies.push(all);
      entities.push({ type: 'ALLERGY', value: all });
    }
  }

  // 7. Intent classification
  let intent = 'GENERAL_HEALTH';
  for (const [intentKey, regex] of Object.entries(INTENT_PATTERNS)) {
    if (regex.test(text)) {
      intent = intentKey;
      break;
    }
  }

  return {
    symptoms,
    negatedSymptoms,
    intent,
    duration,
    severity,
    medications,
    allergies,
    entities
  };
}

module.exports = {
  processNLP,
  SYNONYM_MAP
};
