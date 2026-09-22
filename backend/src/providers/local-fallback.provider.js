const CITY_COORDINATES = {
  'karamsad':           { latitude: 22.5352, longitude: 72.8943 },
  'anand':              { latitude: 22.5645, longitude: 72.9289 },
  'vallabh vidyanagar': { latitude: 22.5290, longitude: 72.9189 },
  'vidyanagar':         { latitude: 22.5290, longitude: 72.9189 },
  'v v nagar':          { latitude: 22.5290, longitude: 72.9189 },
  'nadiad':             { latitude: 22.6939, longitude: 72.8619 },
  'valasan':            { latitude: 22.5452, longitude: 72.9015 },
};

class LocalFallbackProvider {
  async geocodeAddress(input) {
    const query = [input.address, input.city, input.pincode]
      .filter(Boolean).join(' ').toLowerCase();

    for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
      if (query.includes(city)) {
        console.log(`[LocalFallback] Using city center for "${city}"`);
        // City-center coordinates are an UNVERIFIED point near the city, not the
        // hospital tag. Mark it explicitly so callers never treat it as exact.
        return { ...coords, source: 'local_fallback', accuracy: 'city_center', verified: false };
      }
    }
    throw new Error('Address not recognized by local fallback');
  }
}

module.exports = new LocalFallbackProvider();
