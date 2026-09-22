const axios = require('axios');

class MapplsGeocodingProvider {
  constructor() {
    this.apiKey = process.env.MAPPLS_API_KEY;
    this.baseUrl = 'https://search.mappls.com/search/address/geocode';
    this.detailBaseUrl = 'https://explore.mappls.com/apis/O2O/entity';
  }

  async geocodeAddress(address) {
    if (!this.apiKey) throw new Error('Location service not configured. Contact support.');

    try {
      // STEP 1: Try direct geocode
      const response = await axios.get(this.baseUrl, {
        params: { address, access_token: this.apiKey, itemCount: 1 },
        timeout: 5000,
      });

      const results = response.data.copResults;
      if (!results || (Array.isArray(results) && results.length === 0)) {
        throw new Error('Address not found. Please verify.');
      }

      const first = Array.isArray(results) ? results[0] : results;
      let latitude = parseFloat(first.latitude || first.lat);
      let longitude = parseFloat(first.longitude || first.lng);

      // STEP 2: Fallback to eLoc if lat/lng missing
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        if (first.eLoc) {
          const detailResponse = await axios.get(`${this.detailBaseUrl}/${first.eLoc}`, {
            params: { access_token: this.apiKey },
            timeout: 5000,
          });
          const detail = detailResponse.data;
          latitude = parseFloat(detail.latitude);
          longitude = parseFloat(detail.longitude);
        }
      }

      // STEP 3: Validate
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const level = first.geocodeLevel ? `${first.geocodeLevel} level` : 'a general area';
        throw new Error(`Your address was only resolved to ${level}. Please add a street name or landmark.`);
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('Invalid coordinates returned. Try a more specific address.');
      }

      return { latitude, longitude };
    } catch (error) {
      console.error(`[Mappls] Error: ${error.message}`);
      if (error.response && error.response.status === 401) {
        throw new Error('Geocoding service unauthorized. Please verify your MAPPLS_API_KEY in .env');
      }
      throw new Error(error.message || 'Unable to determine hospital location.');
    }
  }
}

module.exports = new MapplsGeocodingProvider();
