const geocodingService = require('../services/geocoding.service');
const axios = require('axios');

exports.geocode = async (req, res) => {
  try {
    const { address, city, state, pincode } = req.query;

    if (!address && !city && !state && !pincode) {
      return res.status(400).json({ success: false, error: 'Address parameters required for geocoding.' });
    }

    const result = await geocodingService.geocode({
      address: address ? String(address) : '',
      city: city ? String(city) : '',
      state: state ? String(state) : '',
      pincode: pincode ? String(pincode) : '',
    });

    res.json({
      success: true,
      latitude: result.latitude,
      longitude: result.longitude,
      source: result.source || 'nominatim',
      verified: result.verified !== false,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to geocode address.',
    });
  }
};

exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng, latitude, longitude, lon } = req.query;

    const rawLat = lat !== undefined ? lat : latitude;
    const rawLng = lng !== undefined ? lng : (lon !== undefined ? lon : longitude);

    if (rawLat === undefined || rawLng === undefined || rawLat === '' || rawLng === '') {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude query parameters are required. Example: /api/geocoding/reverse?lat=28.6139&lng=77.2090',
      });
    }

    const targetLat = Number(rawLat);
    const targetLng = Number(rawLng);

    if (isNaN(targetLat) || targetLat < -90 || targetLat > 90) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude. Latitude must be a number between -90 and 90 degrees.',
      });
    }

    if (isNaN(targetLng) || targetLng < -180 || targetLng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid longitude. Longitude must be a number between -180 and 180 degrees.',
      });
    }

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: targetLat,
          lon: targetLng,
          format: 'json',
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'CareSetu-SIH/1.0 (contact: caresetu@example.com)',
        },
        timeout: 4000,
      });

      const data = response.data;
      if (data && data.address) {
        const addr = data.address;
        const city = addr.city || fontDistrict(addr) || addr.town || addr.village || addr.county || '';
        const state = addr.state || '';
        const pincode = addr.postcode || '';
        const fullAddress = data.display_name || '';

        return res.json({
          success: true,
          address: fullAddress,
          city,
          state,
          pincode,
          latitude: targetLat,
          longitude: targetLng,
          source: 'nominatim',
        });
      }
    } catch (providerErr) {
      console.warn('[ReverseGeocode] Provider lookup warning:', providerErr?.message || providerErr);
    }

    // Fallback response on external geocoding provider lookup failure or unknown location
    return res.json({
      success: true,
      address: `Location (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`,
      city: 'Custom Location',
      state: '',
      pincode: '',
      latitude: targetLat,
      longitude: targetLng,
      source: 'fallback',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal error processing reverse geocoding.',
    });
  }
};

function fontDistrict(addr) {
  return addr.state_district || addr.district || null;
}
