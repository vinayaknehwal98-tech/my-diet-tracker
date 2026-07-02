importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyDuc449HUPShaU5wBP9CFDU_eREh8n0gsU",
  authDomain: "diet-tracker-5142c.firebaseapp.com",
  projectId: "diet-tracker-5142c",
  storageBucket: "diet-tracker-5142c.firebasestorage.app",
  messagingSenderId: "737243616902",
  appId: "1:737243616902:web:e0c5ddc889f16ec09f6307"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, mealId } = payload.data || {};
  self.registration.showNotification(title || '🍽️ Meal Time!', {
    body: body || 'Time for your meal!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: mealId ? `meal-${mealId}` : 'diet-reminder',
    data: payload.data,
    actions: mealId ? [
      { action: 'done', title: '✅ Done' },
      { action: 'snooze', title: '⏰ Snooze 5m' }
    ] : []
  });
});
