"use client"

import { useEffect, useRef } from "react"
import { requestNotificationPermission, onMessageListener } from "@/lib/firebase"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl, getAuthHeaders } from "@/lib/api"

export const PushNotificationManager = () => {
  const { showToast } = useToast()
  const tokenSentRef = useRef(false)

  useEffect(() => {
    // Check and ask for notification permission on client mount
    if (typeof window !== "undefined" && "Notification" in window) {
      requestNotificationPermission().then(async (token) => {
        if (token && !tokenSentRef.current) {
          tokenSentRef.current = true
          try {
            await fetch(apiUrl("/auth/save-fcm-token"), {
              method: "POST",
              headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({ token }),
            })
            console.log("FCM token synchronized with backend successfully")
          } catch (e) {
            console.error("Failed to sync FCM token with backend:", e)
          }
        }
      })
    }

    // Handle foreground notifications received while user is on the app
    onMessageListener((payload) => {
      const title = payload?.notification?.title || payload?.data?.title || "Kinetic LMS Alert"
      const body = payload?.notification?.body || payload?.data?.body || ""
      
      // 1. Show in-app Toast
      showToast(`${title}: ${body}`, "info")

      // 2. Also trigger native browser Desktop/System push notification if supported
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: "/assets/notification.png",
          })
        } catch (e) {
          console.warn("Direct Notification constructor failed, service worker will handle:", e)
        }
      }
    })
  }, [showToast])

  return null
}

