const axios = require('axios');

class NominatimProvider {
  constructor() {
    this.baseUrl = 'https://nominatim.openstreetmap.org/search';
  }

  async geocodeAddress(query) {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          q: query,
          format: 'json',
          limit: 1,
          countrycodes: 'in',
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'CareSetu-SIH/1.0 (contact: caresetu@example.com)',
        },
        timeout: 5000,
      });

      const results = response.data;
      if (!results || results.length === 0) {
        throw new Error('No results from Nominatim');
      }

      const latitude = parseFloat(results[0].lat);
      const longitude = parseFloat(results[0].lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Invalid coordinates from Nominatim');
      }

      console.log(`[Nominatim] ${query} → ${latitude}, ${longitude}`);
      return { latitude, longitude, source: 'nominatim' };
    } catch (error) {
      console.error(`[Nominatim] ${error.message}`);
      throw error;
    }
  }
}

module.exports = new NominatimProvider();
