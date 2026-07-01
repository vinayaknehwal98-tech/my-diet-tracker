// Bulk Diet Tracker — Service Worker

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDuc449HUPShaU5wBP9CFDU_eREh8n0gsU",
  authDomain: "diet-tracker-5142c.firebaseapp.com",
  projectId: "diet-tracker-5142c",
  storageBucket: "diet-tracker-5142c.firebasestorage.app",
  messagingSenderId: "737243616902",
  appId: "1:737243616902:web:e0c5ddc889f16ec09f6307"
});

const messaging = firebase.messaging();

const CACHE_NAME = "bulk-diet-v5";

const STATIC = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// INSTALL
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC))
  );
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// BACKGROUND PUSH NOTIFICATION
messaging.onBackgroundMessage((payload) => {
  const { title, body, mealId, type } = payload.data || {};
  
  const options = {
    body: body || 'Time for your meal!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: mealId ? `meal-${mealId}` : 'diet-reminder',
    data: payload.data,
    actions: mealId ? [
      { action: 'done', title: '✅ Done' },
      { action: 'snooze', title: '⏰ Snooze 5m' }
    ] : []
  };

  return self.registration.showNotification(title || '🍽️ Meal Time!', options);
});

// NOTIFICATION CLICK
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;

  if (action === 'done' && data.mealId) {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
          clients[0].postMessage({ type: 'MEAL_DONE_FROM_NOTIF', mealId: data.mealId });
        } else {
          self.clients.openWindow('./?action=done&mealId=' + data.mealId);
        }
      })
    );
  } else if (action === 'snooze') {
    // Snooze — re-show after 5 min
    setTimeout(() => {
      self.registration.showNotification(event.notification.title, {
        ...event.notification,
        body: '(Snoozed) ' + event.notification.body
      });
    }, 5 * 60 * 1000);
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        if (clients.length > 0) clients[0].focus();
        else self.clients.openWindow("./");
      })
    );
  }
});

// MESSAGE EVENTS
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === "STOP_ALARM") {
    self.registration.getNotifications({ tag: `meal-alarm-${msg.mealId}` })
