const mappls = require('../providers/mappls.provider');
const nominatim = require('../providers/nominatim.provider');
const localFallback = require('../providers/local-fallback.provider');

class GeocodingService {
  async geocode(input) {
    const fullQuery = [input.address, input.city, input.state, input.pincode, 'India']
      .filter(Boolean).join(', ');

    // PROVIDER 1: Mappls
    if (process.env.MAPPLS_API_KEY && process.env.MAPPLS_API_KEY.length > 10) {
      try {
        const result = await mappls.geocodeAddress(fullQuery);
        if (result && Number.isFinite(result.latitude)) {
          console.log('[Geocoder] Success via Mappls');
          return { ...result, source: 'mappls', accuracy: 'street' };
        }
      } catch (e) {
        console.warn('[Geocoder] Mappls failed:', e.message);
      }
    }

    // PROVIDER 2: Nominatim (guaranteed free)
    try {
      const result = await nominatim.geocodeAddress(fullQuery);
      console.log('[Geocoder] Success via Nominatim');
      return { ...result, accuracy: 'street' };
    } catch (e) {
      console.warn('[Geocoder] Nominatim failed:', e.message);
    }

    // PROVIDER 3: Local fallback — an UNVERIFIED city-center estimate. Only used
    // when no real geocoder resolved the address; flagged so callers can't
    // mistake it for an exact hospital location.
    try {
      const result = await localFallback.geocodeAddress(input);
      console.warn('[Geocoder] Degraded result via local fallback (city-center estimate, not verified)');
      return { ...result, source: 'local_fallback', accuracy: 'city_center', verified: false };
    } catch (e) {
      console.error('[Geocoder] ALL providers failed');
      throw new Error('Unable to determine hospital location. Please verify the address.');
    }
  }
}

module.exports = new GeocodingService();
