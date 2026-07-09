// Bulk Diet Tracker — Service Worker

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

const CACHE_NAME = "move-import-buttons-cache-fix-1";

const STATIC = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const isAppShellRequest =
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");

  if (isAppShellRequest) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};

  const title =
    data.title ||
    payload.notification?.title ||
    "🍽️ Meal Time!";

  const body =
    data.body ||
    payload.notification?.body ||
    "Time for your meal!";

  const mealId = data.mealId;

  const options = {
    body,
    icon: "https://vinayaknehwal98-tech.github.io/my-diet-tracker/icon-192.png",
    badge: "https://vinayaknehwal98-tech.github.io/my-diet-tracker/icon-192.png",
    tag: mealId ? `meal-${mealId}` : "diet-reminder",
    data,
    requireInteraction: !!mealId,
    actions: mealId
      ? [
          { action: "done", title: "✅ Done" },
          { action: "snooze", title: "⏰ Snooze 5m" }
        ]
      : []
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const mealId = data.mealId;
  const action = event.action;

  if (action === "done" && mealId) {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          if (clients.length > 0) {
            clients[0].focus();
            clients[0].postMessage({
              type: "MEAL_DONE_FROM_NOTIF",
              mealId
            });
          } else {
            self.clients.openWindow(`./?action=done&mealId=${mealId}`);
          }
        })
    );
    return;
  }

  if (action === "snooze" && mealId) {
    event.waitUntil(
      self.registration.showNotification("⏰ Snoozed", {
        body: "Open the app to continue the alarm.",
        icon: "https://vinayaknehwal98-tech.github.io/my-diet-tracker/icon-192.png",
        badge: "https://vinayaknehwal98-tech.github.io/my-diet-tracker/icon-192.png",
        tag: `meal-${mealId}`,
        data
      })
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow("./");
        }
      })
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === "STOP_ALARM" && msg.mealId) {
    event.waitUntil(
      self.registration.getNotifications({
        tag: `meal-${msg.mealId}`
      }).then((notifications) => {
        notifications.forEach((n) => n.close());
      })
    );
  }
});
