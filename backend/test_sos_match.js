const { emergencyApi } = require('./src/services/api_test_stub.js'); // Wait, I don't have api.ts in backend.
// I will just use axios directly.

const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/emergency/sos', {
      symptoms: "Chest pain",
      latitude: 22.5580,
      longitude: 72.8882,
      emergencyType: "CARDIAC"
    }, {
      headers: {
        // Need a valid patient token. Wait, I can just write a raw db query to verify
        // or bypass auth since it's a test.
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.message);
  }
}
test();
