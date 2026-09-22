const fetch = require('node-fetch'); // we'll use native fetch since node 18+

async function run() {
  const response = await fetch('https://api.textbee.dev/api/v1/gateway/devices', {
    headers: {
      'x-api-key': 'txb_PXWnDWhtltoeu2mejv3J7ZcjAfm5z3lD'
    }
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
