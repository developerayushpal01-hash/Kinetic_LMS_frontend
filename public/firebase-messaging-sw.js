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

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);
  
  const notificationTitle = payload.notification ? payload.notification.title : "Kinetic LMS Notification";
  const notificationOptions = {
    body: payload.notification ? payload.notification.body : "You have a new update.",
    icon: "/assets/notification.png",
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

