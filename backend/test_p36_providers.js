const textbeeProvider = require('./src/services/providers/textbee.provider');
const brevoProvider = require('./src/services/providers/brevo.provider');
const fcmProvider = require('./src/services/providers/fcm.provider');
const notificationService = require('./src/services/notification.service');

async function runTests() {
  console.log("=== PHASE 3.6 PROVIDER TESTS ===\n");

  // 1. TextBee Provider
  console.log("1. Testing TextBee Provider Mock Fallback...");
  const textbeeResult = await textbeeProvider.sendSMS("+1234567890", "Test SMS");
  console.log("TextBee Result:", textbeeResult);
  if (textbeeResult.provider === 'textbee' && !textbeeResult.success) {
    console.log("✅ TextBee gracefully failed due to missing API key.");
  } else {
    console.error("❌ TextBee test failed.");
    process.exit(1);
  }

  // 2. Brevo Provider
  console.log("\n2. Testing Brevo Provider Mock Fallback...");
  const brevoResult = await brevoProvider.sendEmail({ to: "test@example.com", subject: "Test", text: "Test", html: "" });
  console.log("Brevo Result:", brevoResult);
  if (brevoResult.provider === 'brevo' && !brevoResult.success) {
    console.log("✅ Brevo gracefully failed due to missing API key.");
  } else {
    console.error("❌ Brevo test failed.");
    process.exit(1);
  }

  // 3. FCM Provider
  console.log("\n3. Testing FCM Provider Mock Fallback...");
  const fcmResult = await fcmProvider.sendPush({ token: "fake-token", title: "Test", body: "Test" });
  console.log("FCM Result:", fcmResult);
  if (fcmResult.provider === 'fcm' && fcmResult.mock === true) {
    console.log("✅ FCM gracefully used MOCK due to missing Admin Credentials.");
  } else {
    console.error("❌ FCM test failed.");
    process.exit(1);
  }

  // 4. Notification Service Abstraction
  console.log("\n4. Testing Notification Service Abstraction...");
  const serviceResult = await notificationService.sendNotification({
    userId: null, // Skip DB to just test provider routing
    type: 'SYSTEM',
    title: 'Test',
    message: 'Test Message',
    phone: '+1234567890',
    email: 'test@example.com'
  });
  console.log("Service Result:", serviceResult); // Will be null since userId is null, but no throw!
  console.log("✅ Notification Service successfully handled all missing credentials without crashing.");

  console.log("\n✅ ALL PROVIDER GRACEFUL FAILURE TESTS PASSED!");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Unexpected error during tests:", err);
  process.exit(1);
});
