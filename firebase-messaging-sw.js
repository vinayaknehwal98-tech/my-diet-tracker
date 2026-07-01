importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

firebase.initializeApp({
  apiKey: "AIzaSyDuc449HUPShaU5wBP9CFDU_eREh8n0gsU",
  authDomain: "diet-tracker-5142c.firebaseapp.com",
  projectId: "diet-tracker-5142c",
  storageBucket: "diet-tracker-5142c.firebasestorage.app",
  messagingSenderId: "737243616902",
  appId: "1:737243616902:web:e0c5ddc889f16ec09f6307"
});

const messaging = firebase.messaging();

messaging.setBackgroundMessageHandler((payload) => {
  const data = payload.data || {};

  const title =
    data.title ||
    payload.notification?.title ||
    "🍽️ Meal Time!";

  const options = {
    body:
      data.body ||
      payload.notification?.body ||
      "Time for your meal!",
    icon: "https://vinayaknehwal98-tech.github.io/my-diet-tracker/icon-192.png",
    badge: "https://vinayaknehwal98-tech.github.io/my-diet-tracker/icon-192.png",
    data
  };

  return self.registration.showNotification(title, options);
});
