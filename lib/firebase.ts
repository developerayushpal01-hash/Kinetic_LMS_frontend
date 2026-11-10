import { initializeApp, getApps, getApp } from "firebase/app"
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging"

export const firebaseConfig = {
  apiKey: "AIzaSyDm3vQQ1txW_XVQU90btV1Fm7-OaILm348",
  authDomain: "kinetic-lms.firebaseapp.com",
  projectId: "kinetic-lms",
  storageBucket: "kinetic-lms.firebasestorage.app",
  messagingSenderId: "192310701596",
  appId: "1:192310701596:web:38a55a65c84ed6b18739d9",
  measurementId: "G-5XF63L5H0V",
}

// Initialize Firebase safely for Next.js SSR
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

// Request Notification Permission and Get FCM Token
export const requestNotificationPermission = async (vapidKey?: string): Promise<string | null> => {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("Notifications are not supported in this browser.")
      return null
    }

    const supported = await isSupported()
    if (!supported) {
      console.warn("Firebase Messaging is not supported on this device/browser.")
      return null
    }

    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      console.log("Notification permission status:", permission)
      return null
    }

    // Register service worker if supported
    let registration: ServiceWorkerRegistration | undefined
    if ("serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")
    }

    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: vapidKey || process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined,
    })

    if (token) {
      console.log("✅ FCM Registration Token:", token)
      return token
    } else {
      console.warn("No FCM registration token received.")
      return null
    }
  } catch (error) {
    console.error("Error retrieving FCM token:", error)
    return null
  }
}

// Foreground message listener
export const onMessageListener = (callback: (payload: any) => void) => {
  if (typeof window === "undefined") return

  isSupported().then((supported) => {
    if (supported) {
      const messaging = getMessaging(app)
      onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload)
        callback(payload)
      })
    }
  })
}
