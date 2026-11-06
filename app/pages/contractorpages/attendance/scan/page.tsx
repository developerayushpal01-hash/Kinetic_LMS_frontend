"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import Navbar from "@/app/components/navbar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type MatchedLabour = {
  _id: string
  name: string
  labourCode: string
  mobile?: string
  trade?: string
  dailyWage?: number
  site?: { _id: string; siteName: string } | null
}

type Api<T> = { success: boolean; data?: T; message?: string }

export default function CleanQRScannerPage() {
  const { showToast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  const [matchedLabour, setMatchedLabour] = useState<MatchedLabour | null>(null)
  const [attendanceStatus, setAttendanceStatus] = useState<"PRESENT" | "HALF_DAY">("PRESENT")
  const [overtimeHours, setOvertimeHours] = useState<string>("0")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scanCooldown, setScanCooldown] = useState(false)

  // 1. Identify Worker from QR
  const identifyWorker = useCallback(
    async (codeOrData: string) => {
      if (scanCooldown || matchedLabour) return
      setScanCooldown(true)

      let labourCode = codeOrData.trim()
      let parsedLabourId = ""

      try {
        if (codeOrData.startsWith("{") && codeOrData.endsWith("}")) {
          const parsed = JSON.parse(codeOrData)
          if (parsed.labourCode) labourCode = parsed.labourCode
          if (parsed.labourId) parsedLabourId = parsed.labourId
        }
      } catch {
        // raw code
      }

      try {
        const labourRes = await fetch(apiUrl("/labours/get-labours"), { credentials: "include" })
        const labourData = (await labourRes.json()) as Api<any[]>

        if (!labourData.success || !Array.isArray(labourData.data)) {
          throw new Error("Workforce data unreachable")
        }

        const matched = labourData.data.find(
          (l: any) =>
            l.labourCode?.toLowerCase() === labourCode.toLowerCase() ||
            l._id === labourCode ||
            l._id === parsedLabourId
        )

        if (!matched) {
          throw new Error(`Worker with code "${labourCode}" not found.`)
        }

        setMatchedLabour({
          _id: matched._id,
          name: matched.name,
          labourCode: matched.labourCode,
          mobile: matched.mobile,
          trade: matched.skillId?.skillName || matched.trade || "Worker",
          dailyWage: matched.dailyWage || matched.skillId?.defaultDailyWage,
          site: matched.site,
        })

        if (typeof window !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([60, 40, 60])
        }

        showToast(`Worker Scanned: ${matched.name}`, "info")
      } catch (err: any) {
        showToast(err.message, "error")
        setTimeout(() => setScanCooldown(false), 2000)
      }
    },
    [scanCooldown, matchedLabour, showToast]
  )

  // 2. Submit Attendance
  const submitAttendance = async () => {
    if (!matchedLabour) return
    setIsSubmitting(true)

    try {
      const todayStr = new Date().toISOString().slice(0, 10)

      const payload = {
        labourId: matchedLabour._id,
        siteId: matchedLabour.site?._id || undefined,
        attendanceDate: todayStr,
        status: attendanceStatus,
        overtimeHours: Number(overtimeHours) || 0,
        remarks: "Marked via Scanner",
      }

      const res = await fetch(apiUrl("/attendance/mark"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to mark attendance.")
      }

      showToast(
        `✓ ${matchedLabour.name}: ${attendanceStatus}${
          Number(overtimeHours) > 0 ? ` + ${overtimeHours}h OT` : ""
        } Marked!`,
        "success"
      )

      setMatchedLabour(null)
      setAttendanceStatus("PRESENT")
      setOvertimeHours("0")
    } catch (err: any) {
      showToast(err.message, "error")
    } finally {
      setIsSubmitting(false)
      setTimeout(() => setScanCooldown(false), 1500)
    }
  }

  // Camera Management - pure, unconditional camera startup
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return

      // Plain constraints: will grab whatever video input exists (laptop cam, phone back or front)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute("playsinline", "true")
        await videoRef.current.play()
        requestAnimationFrame(tick)
      }
    } catch (err) {
      console.warn("Camera start:", err)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (canvas) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d", { willReadFrequently: true })

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          })

          if (qrCode && qrCode.data) {
            identifyWorker(qrCode.data)
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-white">
      {/* Top Mobile Navbar */}
      <Navbar />

      {/* Pure Fullscreen Scanner Viewport */}
      <div className="relative flex-1 overflow-hidden bg-black flex items-center justify-center">
        {/* Full View Live Camera Video */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Clean Scanning Frame */}
        {!matchedLabour && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative h-64 w-64 rounded-3xl border-2 border-emerald-400 bg-emerald-500/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

              {/* Animated Laser Line */}
              <div className="absolute inset-x-2 top-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-bounce" />
            </div>

            <p className="mt-8 rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur-md">
              Place QR Code inside the frame
            </p>
          </div>
        )}

        {/* BOTTOM SHEET MODAL: ONLY OPENS AFTER QR IS SCANNED */}
        {matchedLabour && (
          <div className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-slate-700 bg-slate-900/98 p-5 pb-24 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200">
            {/* Top Drag Indicator */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600" />

            {/* Worker Name & Details */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 font-black text-white text-lg shadow-md">
                  {matchedLabour.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">{matchedLabour.name}</h3>
                  <p className="text-xs font-mono text-emerald-400 font-semibold">{matchedLabour.labourCode}</p>
                  <p className="text-[11px] text-slate-400">{matchedLabour.trade}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setMatchedLabour(null)
                  setScanCooldown(false)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Attendance Options */}
            <div className="mt-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendance Status</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAttendanceStatus("PRESENT")}
                    className={`rounded-xl py-3 text-xs font-bold transition-all ${
                      attendanceStatus === "PRESENT"
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    ✓ Present (Full)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceStatus("HALF_DAY")}
                    className={`rounded-xl py-3 text-xs font-bold transition-all ${
                      attendanceStatus === "HALF_DAY"
                        ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-400"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    ½ Half Day
                  </button>
                </div>
              </div>

              {/* OT Selection */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overtime (OT)</label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {overtimeHours === "0" ? "No OT" : `${overtimeHours} hrs`}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-2">
                  {["0", "1", "2", "3", "4"].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setOvertimeHours(hrs)}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                        overtimeHours === hrs
                          ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {hrs === "0" ? "0h" : `${hrs}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMatchedLabour(null)
                    setScanCooldown(false)
                  }}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-3.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={submitAttendance}
                  className="flex-[2] rounded-xl bg-emerald-500 py-3.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? "Marking..." : "Confirm & Mark Attendance"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
