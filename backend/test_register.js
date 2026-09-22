const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/auth/register', {
      name: "Test Hospital GPS",
      email: "gps@hospital.com",
      password: "password123",
      phone: "9876543210",
      role: "HOSPITAL",
      address: "Some address that does not matter",
      city: "Karamsad",
      state: "Gujarat",
      pincode: "388325",
      latitude: 22.5580,
      longitude: 72.8882
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
test();
