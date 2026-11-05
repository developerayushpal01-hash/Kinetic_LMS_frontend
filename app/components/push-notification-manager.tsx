"use client"

import { useEffect } from "react"
import { requestNotificationPermission, onMessageListener } from "@/lib/firebase"
import { useToast } from "@/app/components/toast-provider"

export const PushNotificationManager = () => {
  const { showToast } = useToast()

  useEffect(() => {
    // Check and ask for notification permission on client mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        requestNotificationPermission().then((token) => {
          if (token) {
            console.log("FCM push token registered successfully:", token)
          }
        })
      }
    }

    // Handle foreground notifications received while user is on the app
    onMessageListener((payload) => {
      const title = payload?.notification?.title || "New Notification"
      const body = payload?.notification?.body || ""
      showToast(`${title}: ${body}`, "info")
    })
  }, [showToast])

  return null
}

