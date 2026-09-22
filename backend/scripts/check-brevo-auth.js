const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const brevo = require('../src/services/providers/brevo.provider');

async function runDiagnostic() {
  console.log('==================================================');
  console.log('CARESETU BREVO DIAGNOSTIC CHECK (NO EMAIL SENT)');
  console.log('==================================================');

  const config = brevo.validateConfig();
  console.log('Configuration Valid:', config.valid);
  console.log('Sender Email (Masked):', config.senderEmailMasked);

  if (config.errors.length > 0) {
    console.error('Config Errors:', config.errors);
  }
  if (config.warnings.length > 0) {
    console.warn('Config Warnings:', config.warnings);
  }

  console.log('--------------------------------------------------');
  console.log('Testing Brevo API Key & IP Authorization...');

  const result = await brevo.verifyBrevoAuth();

  console.log('API Authentication Status:', result.authenticated ? 'SUCCESS (200 OK)' : `FAILED (HTTP ${result.status})`);
  console.log('Diagnostic Details:', result.reason || 'Authenticated successfully.');

  if (result.serverIpDetected) {
    console.log('\n[ACTION REQUIRED] To resolve Brevo 401 Authorization error:');
    console.log(`1. Log into your Brevo account dashboard: https://app.brevo.com/security/authorised_ips`);
    console.log(`2. Add your current server IP: ${result.serverIpDetected}`);
    console.log(`3. Or disable IP restriction in Brevo Security Settings if operating on dynamic IPs.`);
  }

  console.log('==================================================');
}

runDiagnostic();
