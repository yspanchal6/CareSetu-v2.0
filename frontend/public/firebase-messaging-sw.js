importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "caresetu-37de6.firebaseapp.com",
  projectId: "caresetu-37de6",
  storageBucket: "caresetu-37de6.firebasestorage.app",
  messagingSenderId: "872960501616",
  appId: "YOUR_FIREBASE_APP_ID",
  measurementId: "G-4S0MVRPK06"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);

  const notificationTitle = payload.notification?.title || 'CareSetu Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new alert.',
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});