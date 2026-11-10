importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyDm3vQQ1txW_XVQU90btV1Fm7-OaILm348",
  authDomain: "kinetic-lms.firebaseapp.com",
  projectId: "kinetic-lms",
  storageBucket: "kinetic-lms.firebasestorage.app",
  messagingSenderId: "192310701596",
  appId: "1:192310701596:web:38a55a65c84ed6b18739d9",
  measurementId: "G-5XF63L5H0V",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message", payload);

  const title = payload.notification?.title || payload.data?.title || "Kinetic LMS";
  const options = {
    body: payload.notification?.body || payload.data?.body || "New update received",
    icon: "/assets/notification.png",
    badge: "/assets/notification.png",
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/pages/contractorpages/attendance";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
