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
      const title = payload?.notification?.title || payload?.data?.title || "New Notification"
      const body = payload?.notification?.body || payload?.data?.body || ""
      showToast(`${title}: ${body}`, "info")
    })
  }, [showToast])

  return null
}

