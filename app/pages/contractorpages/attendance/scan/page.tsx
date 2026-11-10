"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import jsQR from "jsqr"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Status = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY"

interface ScannedLabour {
  _id: string
  name: string
  labourCode: string
  mobile?: string
  siteId?: string
}

const statusList: { status: Status; label: string; activeClass: string }[] = [
  { status: "PRESENT", label: "Present", activeClass: "bg-emerald-600 text-white border-emerald-600" },
  { status: "HALF_DAY", label: "Half Day", activeClass: "bg-amber-500 text-white border-amber-500" },
  { status: "ABSENT", label: "Absent", activeClass: "bg-rose-600 text-white border-rose-600" },
  { status: "LEAVE", label: "Leave", activeClass: "bg-sky-600 text-white border-sky-600" },
  { status: "HOLIDAY", label: "Holiday", activeClass: "bg-violet-600 text-white border-violet-600" },
]

const otPresets = [
  { label: "None", value: "0" },
  { label: "0.5 hr", value: "0.5" },
  { label: "1.0 hr", value: "1" },
  { label: "1.5 hr", value: "1.5" },
  { label: "2.0 hr", value: "2" },
  { label: "2.5 hr", value: "2.5" },
  { label: "3.0 hr", value: "3" },
  { label: "4.0 hr", value: "4" },
]

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

export default function GooglePayFastScannerPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isProcessingRef = useRef<boolean>(false)
  const streamRef = useRef<MediaStream | null>(null)
  const barcodeDetectorRef = useRef<any>(null)

  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState<boolean>(false)
  const [hasTorch, setHasTorch] = useState<boolean>(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")

  // Modal / Bottom sheet state on QR scan
  const todayString = localDate(new Date())
  const [scannedLabour, setScannedLabour] = useState<ScannedLabour | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(todayString)
  const [selectedStatus, setSelectedStatus] = useState<Status>("PRESENT")
  const [selectedOT, setSelectedOT] = useState<string>("0")
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Initialize Native BarcodeDetector (instant hardware QR scanning on Chrome/Android)
  useEffect(() => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const BD = (window as any).BarcodeDetector
        barcodeDetectorRef.current = new BD({ formats: ["qr_code"] })
      } catch (e) {
        console.warn("Native BarcodeDetector not available, falling back to jsQR", e)
      }
    }
  }, [])

  // Start Camera with optimal video resolution and autofocus
  const startCamera = useCallback(
    async (mode: "environment" | "user") => {
      setCameraError(null)

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported on this device/browser.")
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 60, min: 30 },
          },
          audio: false,
        })

        streamRef.current = stream

        const track = stream.getVideoTracks()[0]
        if (track) {
          try {
            await track.applyConstraints({
              // @ts-expect-error advanced constraints for mobile
              advanced: [{ focusMode: "continuous" }],
            })
          } catch {}

          const capabilities = (track.getCapabilities?.() || {}) as { torch?: boolean }
          setHasTorch(Boolean(capabilities.torch))
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute("playsinline", "true")
          await videoRef.current.play()
          setCameraActive(true)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unable to open camera"
        setCameraError(msg)
        setCameraActive(false)
      }
    },
    []
  )

  // Stop camera
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setTorchOn(false)
  }, [])

  // Toggle Torch (Flash)
  const toggleTorch = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (track) {
      try {
        const nextState = !torchOn
        // @ts-expect-error torch is valid on mobile browsers
        await track.applyConstraints({ advanced: [{ torch: nextState }] })
        setTorchOn(nextState)
      } catch (e) {
        console.error("Torch error", e)
      }
    }
  }

  // Flip Camera
  const flipCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment"
    setFacingMode(nextMode)
    startCamera(nextMode)
  }

  // QR Decoder callback - Instant Bottom Sheet Popup
  const handleCodeFound = useCallback((codeText: string) => {
    if (isProcessingRef.current) return

    try {
      let labour: ScannedLabour | null = null

      try {
        const parsed = JSON.parse(codeText)
        if (parsed && (parsed.labourId || parsed._id)) {
          labour = {
            _id: parsed.labourId || parsed._id,
            name: parsed.name || "Labour",
            labourCode: parsed.labourCode || "",
            mobile: parsed.mobile,
            siteId: parsed.siteId,
          }
        }
      } catch {
        if (codeText.length >= 10) {
          labour = {
            _id: codeText.trim(),
            name: "Labour",
            labourCode: codeText.trim(),
          }
        }
      }

      if (labour && labour._id) {
        // Instant haptic feedback like Google Pay (if supported)
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(40)
          } catch {}
        }

        // Lock scanner loop immediately
        isProcessingRef.current = true

        // Defaults: Date = Today, Status = PRESENT, OT = 0
        setSelectedDate(localDate(new Date()))
        setSelectedStatus("PRESENT")
        setSelectedOT("0")

        // Open bottom sheet
        setScannedLabour(labour)
      }
    } catch (e) {
      console.error("QR decode error:", e)
    }
  }, [])

  // Submit attendance from bottom sheet
  const handleConfirmAttendance = async () => {
    if (!scannedLabour) return

    // Prevent future date safety check
    const today = localDate(new Date())
    if (selectedDate > today) {
      showToast("Future date attendance cannot be marked", "error")
      return
    }

    setSubmitting(true)

    try {
      const payload: {
        labourId: string
        attendanceDate: string
        status: Status
        siteId?: string
        overtimeHours?: number
      } = {
        labourId: scannedLabour._id,
        attendanceDate: selectedDate,
        status: selectedStatus,
      }

      if (scannedLabour.siteId) {
        payload.siteId = scannedLabour.siteId
      }

      const otHours = Number(selectedOT)
      if (otHours > 0) {
        payload.overtimeHours = otHours
      }

      const res = await fetch(apiUrl("/attendance/mark"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to mark attendance")
      }

      const otLabel = otHours > 0 ? ` +${otHours}h OT` : ""
      const isPast = selectedDate !== today ? ` (${selectedDate})` : ""
      showToast(`Marked ${selectedStatus}${otLabel} for ${scannedLabour.name}${isPast}`, "success")

      // Close bottom sheet and resume scanner
      setScannedLabour(null)
      setTimeout(() => {
        isProcessingRef.current = false
      }, 500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving attendance"
      showToast(msg, "error")
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel / Close sheet to scan next
  const handleCancelSheet = () => {
    setScannedLabour(null)
    setTimeout(() => {
      isProcessingRef.current = false
    }, 300)
  }

  // Start camera on mount
  useEffect(() => {
    startCamera(facingMode)
    return () => {
      stopCamera()
    }
  }, [facingMode, startCamera, stopCamera])

  // ULTRA-FAST Scanner Loop
  useEffect(() => {
    let active = true
    let isDetecting = false

    const scan = async () => {
      if (!active) return

      const video = videoRef.current
      if (
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        !isProcessingRef.current &&
        !isDetecting
      ) {
        if (barcodeDetectorRef.current) {
          isDetecting = true
          try {
            const barcodes = await barcodeDetectorRef.current.detect(video)
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleCodeFound(barcodes[0].rawValue)
            }
          } catch {
          } finally {
            isDetecting = false
          }
        } else {
          const canvas = canvasRef.current
          if (canvas) {
            const ctx = canvas.getContext("2d", { willReadFrequently: true })
            if (ctx) {
              const targetWidth = Math.min(video.videoWidth, 640)
              const scale = targetWidth / video.videoWidth
              const targetHeight = Math.floor(video.videoHeight * scale)

              if (canvas.width !== targetWidth) canvas.width = targetWidth
              if (canvas.height !== targetHeight) canvas.height = targetHeight

              ctx.drawImage(video, 0, 0, targetWidth, targetHeight)
              const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)

              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              })

              if (code && code.data && !isProcessingRef.current) {
                handleCodeFound(code.data)
              }
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scan)
    }

    if (cameraActive) {
      animFrameRef.current = requestAnimationFrame(scan)
    }

    return () => {
      active = false
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [cameraActive, handleCodeFound])

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-black text-white select-none">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Fullscreen Video Background */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Google Pay Style Viewfinder with Dark Backdrop */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between">
        {/* Top Dark Overlay */}
        <div className="w-full flex-1 bg-black/55 backdrop-blur-[1px]" />

        {/* Center Scanner Window Row */}
        <div className="flex w-full items-center justify-center">
          <div className="flex-1 h-[290px] sm:h-[340px] bg-black/55 backdrop-blur-[1px]" />

          {/* GPay Viewfinder Box */}
          <div className="relative h-[290px] w-[290px] sm:h-[340px] sm:w-[340px] flex-shrink-0">
            {/* 4 Rounded Corner Accents */}
            <div className="absolute -top-1 -left-1 h-12 w-12 border-t-4 border-l-4 border-white rounded-tl-3xl" />
            <div className="absolute -top-1 -right-1 h-12 w-12 border-t-4 border-r-4 border-white rounded-tr-3xl" />
            <div className="absolute -bottom-1 -left-1 h-12 w-12 border-b-4 border-l-4 border-white rounded-bl-3xl" />
            <div className="absolute -bottom-1 -right-1 h-12 w-12 border-b-4 border-r-4 border-white rounded-br-3xl" />

            {/* Glowing Laser / Scan Line */}
            {cameraActive && !scannedLabour && (
              <div className="absolute inset-x-2 top-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_18px_#38bdf8] animate-[scanner_1.8s_ease-in-out_infinite]" />
            )}

            {/* Scanning Guide Hint */}
            <div className="absolute -bottom-11 inset-x-0 text-center">
              <span className="text-xs sm:text-sm font-medium tracking-wide text-white/95 drop-shadow-lg">
                Scan Labour QR Code
              </span>
            </div>
          </div>

          <div className="flex-1 h-[290px] sm:h-[340px] bg-black/55 backdrop-blur-[1px]" />
        </div>

        {/* Bottom Dark Overlay */}
        <div className="w-full flex-1 bg-black/55 backdrop-blur-[1px]" />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <button
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 active:scale-95 transition"
          aria-label="Back"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 className="text-base sm:text-lg font-semibold tracking-wide drop-shadow-md">Scan QR Code</h1>

        {hasTorch ? (
          <button
            onClick={toggleTorch}
            className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md border border-white/20 active:scale-95 transition ${
              torchOn ? "bg-amber-400 text-black shadow-[0_0_15px_#fbbf24]" : "bg-black/40 text-white"
            }`}
            aria-label="Flashlight"
          >
            <svg className="h-5 w-5" fill={torchOn ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={flipCamera}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 active:scale-95 transition"
            aria-label="Flip Camera"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom Floating Navigation Links */}
      <div className="absolute bottom-24 inset-x-0 z-40 flex items-center justify-center gap-3 px-6 pointer-events-auto">
        <button
          onClick={() => router.push("/pages/contractorpages/attendance/mark")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs sm:text-sm font-medium hover:bg-white/30 active:scale-95 transition shadow-xl"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Manual Mark
        </button>
        <button
          onClick={() => router.push("/pages/contractorpages/attendance")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs sm:text-sm font-medium hover:bg-white/30 active:scale-95 transition shadow-xl"
        >
          Attendance List
        </button>
      </div>

      {/* Camera Error Modal */}
      {cameraError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
          <div className="max-w-sm w-full rounded-3xl bg-neutral-900 border border-neutral-800 p-6 text-center text-white">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-bold">Camera Access Required</h3>
            <p className="mt-2 text-xs sm:text-sm text-neutral-400">{cameraError}</p>
            <button
              onClick={() => startCamera(facingMode)}
              className="mt-6 w-full rounded-full bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg active:scale-95 transition"
            >
              Retry Camera
            </button>
          </div>
        </div>
      )}

      {/* Google Pay Style Confirmation Bottom Sheet */}
      {scannedLabour && (
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-t-3xl bg-neutral-900 border-t border-neutral-800 px-6 pt-5 pb-8 sm:pb-10 text-white shadow-[0_-10px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-250 max-h-[92vh] overflow-y-auto mb-[env(safe-area-inset-bottom,0px)]">
            {/* Grab handle */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-700" />

            {/* Labour Info Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-bold text-lg">
                  {scannedLabour.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight">{scannedLabour.name}</h2>
                  <p className="text-xs text-neutral-400">
                    Code: <span className="font-semibold text-neutral-300">{scannedLabour.labourCode}</span>
                  </p>
                  {scannedLabour.mobile && (
                    <p className="text-xs text-neutral-400">Mob: {scannedLabour.mobile}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelSheet}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 hover:text-white active:scale-90 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Attendance Date Selection (Defaults to Today, Allows Past Dates, Blocks Future Dates) */}
            <div className="mt-4 rounded-2xl bg-neutral-800/70 border border-neutral-700/60 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-700/60 text-emerald-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200">
                      Attendance Date
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      {selectedDate === todayString ? "Today" : "Backdated entry"}
                    </span>
                  </div>
                </div>

                <input
                  type="date"
                  max={todayString}
                  value={selectedDate}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val && val <= todayString) {
                      setSelectedDate(val)
                    } else if (val > todayString) {
                      showToast("Future date attendance cannot be marked", "error")
                    }
                  }}
                  className="rounded-xl bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Status Options - Defaults to PRESENT */}
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {statusList.map((item) => {
                  const isSelected = selectedStatus === item.status
                  return (
                    <button
                      key={item.status}
                      type="button"
                      onClick={() => setSelectedStatus(item.status)}
                      className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                        isSelected
                          ? item.activeClass + " shadow-md scale-[1.02]"
                          : "border-neutral-800 bg-neutral-800/80 text-neutral-300 hover:bg-neutral-800 active:scale-95"
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Overtime (OT) Options (None, 0.5, 1, 1.5, 2, 2.5, 3, 4 hrs) */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Overtime (OT)
                </label>
                {selectedOT !== "0" && (
                  <span className="text-xs font-medium text-emerald-400">
                    +{selectedOT} hours OT
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {otPresets.map((ot) => {
                  const isSelected = selectedOT === ot.value
                  return (
                    <button
                      key={ot.value}
                      type="button"
                      onClick={() => setSelectedOT(ot.value)}
                      className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-medium border text-center transition-all ${
                        isSelected
                          ? "bg-emerald-500 text-black border-emerald-500 font-bold shadow-md scale-[1.03]"
                          : "border-neutral-800 bg-neutral-800/80 text-neutral-300 hover:bg-neutral-800 active:scale-95"
                      }`}
                    >
                      {ot.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 mb-2 flex gap-3">
              <button
                type="button"
                onClick={handleCancelSheet}
                disabled={submitting}
                className="flex-1 rounded-full bg-neutral-800 py-3.5 text-sm font-medium text-neutral-300 hover:bg-neutral-700 active:scale-95 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAttendance}
                disabled={submitting}
                className="flex-[2] rounded-full bg-emerald-500 py-3.5 text-sm font-semibold text-black shadow-lg hover:bg-emerald-400 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-black" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  `Confirm ${selectedStatus}${selectedOT !== "0" ? ` (+${selectedOT}h OT)` : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Laser scan animation */}
      <style jsx global>{`
        @keyframes scanner {
          0% {
            top: 2%;
            opacity: 0.8;
          }
          50% {
            top: 96%;
            opacity: 1;
          }
          100% {
            top: 2%;
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  )
}
