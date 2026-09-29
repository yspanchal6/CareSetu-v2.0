/**
 * CARESETU V2.0 - STEP 3
 * Deterministic Normalization & Distance Utilities for Hospital Entity Matching
 */

/**
 * Normalizes hospital names for comparison.
 * - Lowercases, trims
 * - Removes common noise words (hospital, pvt, ltd, dr, centre, center, care, etc.)
 * - Normalizes punctuation and spacing
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  let str = name.toLowerCase().trim();

  // Normalize common medical/hospital abbreviations
  str = str
    .replace(/&/g, ' and ')
    .replace(/\b(dr|doctor|prof)\b\.?/gi, '')
    .replace(/\b(pvt|private|ltd|limited|corp|inc)\b\.?/gi, '')
    .replace(/\b(hospital|hospitals|hosp|clinic|medical|centre|center|institute|research|foundation|healthcare)\b\.?/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return str;
}

/**
 * Normalizes address strings.
 */
function normalizeAddress(address) {
  if (!address || typeof address !== 'string') return '';
  return address
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes pincodes (cleans non-digits, trims).
 */
function normalizePincode(pincode) {
  if (!pincode) return null;
  const digits = String(pincode).replace(/\D/g, '').trim();
  return digits.length >= 6 ? digits.slice(0, 6) : digits || null;
}

/**
 * Normalizes state names for consistent comparison.
 */
function normalizeState(state) {
  if (!state || typeof state !== 'string') return '';
  return state.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Normalizes district/city names for consistent comparison.
 */
function normalizeDistrict(district) {
  if (!district || typeof district !== 'string') return '';
  return district.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Normalizes Indian phone numbers to 10 digits if possible.
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10); // Take last 10 digits (strips +91 / 0 prefix)
  }
  return digits.length > 0 ? digits : null;
}

/**
 * Calculates Haversine distance in kilometers between two coordinates.
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) {
    return null;
  }

  const R = 6371; // Earth radius in km
  const dLat = (nLat2 - nLat1) * (Math.PI / 180);
  const dLon = (nLon2 - nLon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * (Math.PI / 180)) *
      Math.cos(nLat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Jaccard Token Similarity score (0.0 to 1.0) for strings.
 */
function calculateTokenSimilarity(str1, str2) {
  const norm1 = normalizeName(str1);
  const norm2 = normalizeName(str2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  const set1 = new Set(norm1.split(' ').filter(w => w.length > 1));
  const set2 = new Set(norm2.split(' ').filter(w => w.length > 1));

  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  set1.forEach(word => {
    if (set2.has(word)) intersection++;
  });

  const union = new Set([...set1, ...set2]).size;
  return union > 0 ? intersection / union : 0;
}

module.exports = {
  normalizeName,
  normalizeAddress,
  normalizePincode,
  normalizeState,
  normalizeDistrict,
  normalizePhone,
  calculateHaversineDistance,
  calculateTokenSimilarity
};
