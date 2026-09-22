// ai-redflag.service.js
// M1 — Deterministic Safety Engine for chat messages.
// Runs BEFORE any LLM call. If an emergency is detected the chatbot short-circuits
// and redirects to SOS. The LLM never drives the SOS decision.
//
// Safety design (schema comment): "AI itself does NOT directly trigger SOS.
// The Safety Rule Engine makes the final emergency decision."

const CARDIAC = {
  words: [
    'chest pain', 'heart attack', 'cardiac arrest', 'angina', 'pressure in chest', 'tightness in chest',
    'pain in left arm', 'radiating chest pain', 'heart palpitations', 'my heart',
    // Hindi & Gujarati & Hinglish (Romanized & Devanagari)
    'seene mein dard', 'seene me dard', 'chhati mein dard', 'chhati me dard', 'dil mein dard', 'dil ka daura', 'bahut tez seene ka dard',
    'सीने में दर्द', 'सीने मे दर्द', 'छाती में दर्द', 'दिल में दर्द', 'हार्ट अटैक',
    'છાતીમાં દુખાવો', 'છાતીમાં ખૂબ દુખાવો', 'છાતીમાં ભારે દુખાવો', 'હૃદયમાં દુખાવો', 'હાર્ટ એટેક',
  ],
  severity: 'RED',
};

const RESPIRATORY = {
  words: [
    "can't breathe", "cannot breathe", 'difficulty breathing', 'shortness of breath', 'not breathing',
    'choking', 'asthma attack', 'wheezing', 'gasping for air', 'breathless', 'struggling to breathe', 'suffocating',
    // Hindi & Gujarati
    'saans lene mein takleef', 'saans lene me takleef', 'saans phoolna', 'saans nahi aa rahi', 'saans lene mein dikkat',
    'શ્વાસ લેવામાં તકલીફ', 'શ્વાસ લેવામાં મુશ્કેલી', 'શ્વાસ લેવામાં ભારે તકલીફ', 'શ્વાસ નથી આવી રહ્યો',
  ],
  severity: 'RED',
};

const NEUROLOGICAL = {
  words: [
    'stroke', 'paralysis', 'numbness', 'slurred speech', 'confusion', 'seizure', 'convulsion', 'severe dizziness', 'sudden dizziness',
    'loss of consciousness', 'unconscious', 'fainted', 'passed out', 'vomiting blood',
    // FAST / Stroke indicators
    'face drooping', 'facial droop', 'one side of face drooping', 'face is drooping', 'arm weakness', 'weak arm',
    'cannot move my arm', "can't move my arm", 'cannot move one arm', 'weakness on one side', 'one-sided weakness',
    'sudden weakness', 'sudden numbness', 'trouble speaking', 'difficulty speaking', 'cannot speak', 'speech suddenly affected',
    'sudden vision loss', 'sudden confusion', 'loss of balance',
    // Hindi & Gujarati
    'lakwa', 'chehra tedha', 'chehra latakna', 'ek haath mein kamzori', 'haath nahi hil raha', 'bolne mein dikkat', 'behosh', 'achanak behoshi',
    'મોઢું વાંકડું થવું', 'ચહેરો વાંકો થવો', 'એક હાથમાં નબળાઈ', 'હાથ હલતો નથી', 'બોલવામાં તકલીફ', 'બેભાન',
  ],
  severity: 'RED',
};

const TRAUMA = {
  words: [
    'accident', 'heavy bleeding', 'severe bleeding', 'bleeding heavily', 'head injury', 'broken bone', 'fracture',
    'deep cut', 'severe burn', 'drowned', 'drowning', 'overdose', 'poisoning', 'suicidal', 'suicide', 'stabbed', 'gunshot',
    // Hindi & Gujarati
    'bahut zyada khoon', 'khoon nahi ruk raha', 'gehri chot',
    'ખૂબ લોહી વહી રહ્યું છે', 'લોહી બંધ થતું નથી', 'ગંભીર ઈજા',
  ],
  severity: 'ORANGE',
};

const OTHER_HIGH = {
  words: ['severe pain', 'unbearable pain', 'allergic reaction', 'face swelling', 'throat swelling', 'cannot swallow', 'high fever', 'very high fever', 'coughing blood', 'blood in vomit', 'treated as red'],
  severity: 'ORANGE',
};

const RED_FLAG_CATEGORIES = { CARDIAC, RESPIRATORY, NEUROLOGICAL, TRAUMA, OTHER_HIGH };

const SYMPTOM_LEXICON = [
  'chest pain', 'shortness of breath', 'fever', 'headache', 'cough', 'fatigue', 'nausea',
  'vomiting', 'dizziness', 'diarrhea', 'sore throat', 'rash', 'abdominal pain', 'back pain',
  'joint pain', 'muscle pain', 'weakness', 'sweating', 'chills', 'runny nose', 'congestion',
  'loss of appetite', 'insomnia', 'heartburn', 'constipation', 'swelling', 'itchiness',
  'blurry vision', 'ear pain', 'palpitations',
];

const INTENT_KEYWORDS = {
  EMERGENCY: ['sos', 'emergency', 'ambulance', '911', '108', '112', 'report emergency'],
  SYMPTOM_CHECK: ['symptom', 'feel', 'feeling', 'pain', 'fever', 'cough', 'headache', 'sick', 'hurting', 'ache', 'dizzy', 'nausea'],
  MEDICATION: ['medication', 'medicine', 'meds', 'drug', 'dose', 'dosage', 'prescription', 'combine', 'interaction', 'pill'],
  FIRST_AID: ['first aid', 'wound', 'cut', 'burn', 'bandage', 'bleeding', 'sprain'],
  HOSPITAL_SEARCH: ['hospital', 'doctor near', 'nearest hospital', 'clinic', 'facility', 'emergency room', 'icu'],
  HEALTH_PACK: ['health pack', 'report', 'blood test', 'lab', 'test result'],
  APPOINTMENT: ['appointment', 'book', 'schedule', 'visit'],
};

const intentFrom = (text) => {
  const lower = text.toLowerCase();
  for (const [intent, keys] of Object.entries(INTENT_KEYWORDS)) {
    if (keys.some((k) => lower.includes(k))) return intent;
  }
  return 'GENERAL_HEALTH';
};

function isNegatedOrInformational(text, word) {
  if (!text || !word) return false;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(word.toLowerCase());
  if (idx === -1) return false;

  const prefix = lower.slice(Math.max(0, idx - 50), idx).trim();
  const suffix = lower.slice(idx + word.length, Math.min(lower.length, idx + word.length + 50)).trim();

  // Negation patterns in prefix (English / Hinglish): no, not, don't, without, denies, negative for
  const negationRegexPrefix = /\b(no|not|don'?t|does'?n'?t|did'?n'?t|without|free of|negative for|deny|denies|denying|ruled out)\b/i;
  if (negationRegexPrefix.test(prefix)) {
    return true;
  }

  // Negation patterns in suffix (Hindi / Gujarati / Hinglish): nahi, nahin, nahi hai, nahi h, નથી, ના
  const negationRegexSuffix = /\b(nahi|nahin|na|nahi hai|nahi h)\b|नहीं|ना|નથી/i;
  if (negationRegexSuffix.test(suffix)) {
    return true;
  }

  // Informational inquiry patterns: what is, what does, meaning of, explain, tell me about, asking about, asking what, information on, define
  const infoRegex = /\b(what is|what are|what does|what causes|meaning of|definition of|explain|tell me about|asking about|asking what|information on|define|learn about|read about|difference between)\b|का मतलब|का कारण|અર્થ શું/i;
  if (infoRegex.test(prefix) || infoRegex.test(suffix)) {
    return true;
  }

  // General informational questions ending with ? without active symptom indicators
  if (lower.includes('?') && /^(what|why|how|can|could|tell me)\b/i.test(lower.trim())) {
    if (!/\b(i have|i am having|i'm having|my|experiencing|suffering from)\b/i.test(prefix)) {
      return true;
    }
  }

  return false;
}

const detect = (text) => {
  const lower = text.toLowerCase();
  const detectedWords = [];
  const emergencySignals = [];
  let severity = 'GREEN';
  let categoryHit = null;
  let isNegatedOrInfo = false;

  for (const [category, cfg] of Object.entries(RED_FLAG_CATEGORIES)) {
    const hits = cfg.words.filter((w) => lower.includes(w));
    for (const hit of hits) {
      if (isNegatedOrInformational(text, hit)) {
        isNegatedOrInfo = true;
        console.log(`[AI-Redflag] Negated/Informational match for "${hit}" — not triggering SOS redirect.`);
        continue;
      }
      detectedWords.push(hit);
      emergencySignals.push(`RED_FLAG:${category}:${hit}`);
      if (cfg.severity === 'RED') severity = 'RED';
      else if (severity !== 'RED') severity = 'ORANGE';
      categoryHit = category;
      break;
    }
    if (categoryHit) break;
  }

  const symptoms = SYMPTOM_LEXICON.filter((s) => lower.includes(s));
  const intent = intentFrom(text);

  let riskLevel = 'UNKNOWN';
  let safetyDecision = 'UNKNOWN';
  let isEmergency = false;

  if (severity === 'RED') {
    riskLevel = 'CRITICAL';
    safetyDecision = 'EMERGENCY';
    isEmergency = true;
  } else if (severity === 'ORANGE') {
    riskLevel = 'HIGH';
    safetyDecision = 'EMERGENCY';
    isEmergency = true;
  } else if (severity === 'YELLOW') {
    riskLevel = 'MEDIUM';
    safetyDecision = 'CAUTION';
  } else {
    riskLevel = 'LOW';
    safetyDecision = 'NORMAL';
  }

  const note = categoryHit
    ? `${categoryHit} red-flag matched: ${detectedWords[0]}`
    : isNegatedOrInfo
    ? 'Informational or negated symptom query — routed to AI Assistant'
    : 'No emergency signals detected';

  return {
    isEmergency,
    severity,
    riskLevel,
    safetyDecision,
    detectedWords,
    emergencySignals,
    symptoms,
    intent,
    note,
    isNegatedOrInfo,
  };
};

module.exports = { detect, RED_FLAG_CATEGORIES, SYMPTOM_LEXICON };