"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import jsQR from "jsqr"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Site = { _id: string; siteName: string; siteCode?: string; status: string }
type ScannedRecord = {
  labourCode: string
  name: string
  timestamp: string
  status: "SUCCESS" | "DUPLICATE" | "ERROR"
  message: string
}
type Api<T> = { success: boolean; data?: T; message?: string }

export default function QRScannerAttendancePage() {
  const { showToast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")
  const [attendanceStatus, setAttendanceStatus] = useState<"PRESENT" | "HALF_DAY">("PRESENT")
  const [overtimeHours, setOvertimeHours] = useState<string>("0")
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string>("")
  const [lastScannedCode, setLastScannedCode] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [recentScans, setRecentScans] = useState<ScannedRecord[]>([])
  const [manualCode, setManualCode] = useState("")

  // Load sites
  useEffect(() => {
    fetch(apiUrl("/sites/get-sites"), { credentials: "include" })
      .then(async (res) => {
        const result = (await res.json()) as Api<Site[]>
        if (result.success && result.data) {
          const activeSites = result.data.filter((s) => s.status === "ACTIVE")
          setSites(activeSites)
          if (activeSites.length > 0) setSelectedSiteId(activeSites[0]._id)
        }
      })
      .catch((err) => console.error("Error loading sites:", err))
  }, [])

  // Process labour code for attendance
  const processAttendance = useCallback(
    async (codeOrData: string) => {
      if (isProcessing) return
      setIsProcessing(true)

      let labourCode = codeOrData.trim()
      let parsedLabourId = ""

      // Attempt parsing JSON payload if QR contains JSON
      try {
        if (codeOrData.startsWith("{") && codeOrData.endsWith("}")) {
          const parsed = JSON.parse(codeOrData)
          if (parsed.labourCode) labourCode = parsed.labourCode
          if (parsed.labourId) parsedLabourId = parsed.labourId
        }
      } catch {
        // use raw string as code
      }

      try {
        // 1. Fetch labour details if we don't have direct labourId
        let labourId = parsedLabourId
        let labourName = ""
        let assignedSiteId = selectedSiteId

        const labourRes = await fetch(apiUrl("/labours/get-labours"), { credentials: "include" })
        const labourData = (await labourRes.json()) as Api<any[]>

        if (labourData.success && Array.isArray(labourData.data)) {
          const matched = labourData.data.find(
            (l: any) =>
              l.labourCode?.toLowerCase() === labourCode.toLowerCase() ||
              l._id === labourCode ||
              l._id === parsedLabourId
          )

          if (matched) {
            labourId = matched._id
            labourName = matched.name
            labourCode = matched.labourCode
            if (matched.site?._id) assignedSiteId = matched.site._id
          }
        }

        if (!labourId) {
          throw new Error(`Worker with code "${labourCode}" not found in system.`)
        }

        // 2. Mark attendance via API
        const todayStr = new Date().toISOString().slice(0, 10)
        const payload = {
          labourId,
          siteId: assignedSiteId || selectedSiteId || undefined,
          attendanceDate: todayStr,
          status: attendanceStatus,
          overtimeHours: Number(overtimeHours) || 0,
          remarks: "Marked via QR ID Card Scanner",
        }

        const markRes = await fetch(apiUrl("/attendance/mark"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })

        const markResult = await markRes.json()

        if (!markRes.ok || !markResult.success) {
          throw new Error(markResult.message || "Failed to mark attendance.")
        }

        showToast(`Attendance marked for ${labourName || labourCode} (${attendanceStatus})`, "success")

        setRecentScans((prev) => [
          {
            labourCode,
            name: labourName || "Worker",
            timestamp: new Date().toLocaleTimeString("en-IN"),
            status: "SUCCESS",
            message: `${attendanceStatus} recorded successfully`,
          },
          ...prev.slice(0, 19),
        ])
      } catch (err: any) {
        showToast(err.message, "error")
        setRecentScans((prev) => [
          {
            labourCode: labourCode || "UNKNOWN",
            name: "Worker",
            timestamp: new Date().toLocaleTimeString("en-IN"),
            status: "ERROR",
            message: err.message || "Scan failed",
          },
          ...prev.slice(0, 19),
        ])
      } finally {
        setTimeout(() => {
          setIsProcessing(false)
        }, 1800) // Prevent rapid repeated double scans
      }
    },
    [isProcessing, attendanceStatus, overtimeHours, selectedSiteId, showToast]
  )

  // Start video camera stream
  const startCamera = async () => {
    setCameraError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute("playsinline", "true")
        await videoRef.current.play()
        setIsScanning(true)
        requestAnimationFrame(tick)
      }
    } catch (err: any) {
      console.error("Camera access error:", err)
      setCameraError(
        "Camera permission denied or camera not available. Please allow camera access in your browser or enter Labour Code manually below."
      )
    }
  }

  // Stop camera stream
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // QR Frame Analyzer
  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (ctx) {
          canvas.height = video.videoHeight
          canvas.width = video.videoWidth
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          })

          if (code && code.data && !isProcessing) {
            if (code.data !== lastScannedCode || Date.now() % 3 === 0) {
              setLastScannedCode(code.data)
              processAttendance(code.data)
            }
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    processAttendance(manualCode.trim())
    setManualCode("")
  }

  return (
    <div className="flex min-h-screen bg-[#f7f8fc]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Navbar />
        <main className="mx-auto max-w-5xl p-5 lg:p-7">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">
                Attendance / <span className="font-semibold text-emerald-600">Scan QR Code</span>
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">QR Code Attendance Scanner</h1>
              <p className="mt-1 text-sm text-slate-500">
                Contractors and supervisors can scan worker identity cards via camera for rapid, touch-free attendance.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/pages/contractorpages/attendance"
                className="flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Attendance Sheet
              </Link>
              <Link
                href="/pages/contractorpages/labours"
                className="flex h-10 items-center rounded-md bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800"
              >
                Worker ID Cards
              </Link>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Camera Viewport & Controls */}
            <div className="space-y-5 lg:col-span-7">
              {/* Scan Configuration Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">Scanner Parameters</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Default Site</label>
                    <select
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    >
                      {sites.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.siteName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Attendance Status</label>
                    <select
                      value={attendanceStatus}
                      onChange={(e) => setAttendanceStatus(e.target.value as any)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-emerald-700 outline-none focus:border-indigo-500"
                    >
                      <option value="PRESENT">Present (Full Day)</option>
                      <option value="HALF_DAY">Half Day</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">OT Hours (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={overtimeHours}
                      onChange={(e) => setOvertimeHours(e.target.value)}
                      placeholder="0"
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Camera Container */}
              <div className="relative overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-950 shadow-xl">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className={`h-full w-full object-cover ${isScanning ? "block" : "hidden"}`}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Scanning Overlay Reticle */}
                  {isScanning && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative h-64 w-64 rounded-2xl border-2 border-emerald-400/80 bg-emerald-400/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                        {/* Target Corner accents */}
                        <span className="absolute -top-1 -left-1 h-6 w-6 rounded-tl-lg border-t-4 border-l-4 border-emerald-400" />
                        <span className="absolute -top-1 -right-1 h-6 w-6 rounded-tr-lg border-t-4 border-r-4 border-emerald-400" />
                        <span className="absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-lg border-b-4 border-l-4 border-emerald-400" />
                        <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-br-lg border-b-4 border-r-4 border-emerald-400" />

                        {/* Animated Laser Scanning Line */}
                        <div className="absolute inset-x-2 top-0 h-0.5 animate-pulse bg-emerald-400 shadow-[0_0_12px_#34d399]" />
                        <p className="absolute -bottom-7 inset-x-0 text-center font-mono text-[11px] font-bold tracking-wider text-emerald-400">
                          {isProcessing ? "RECORDING ATTENDANCE..." : "ALIGN WORKER QR IN FRAME"}
                        </p>
                      </div>
                    </div>
                  )}

                  {!isScanning && (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
                        📷
                      </div>
                      <h3 className="mt-3 text-base font-bold text-white">Camera is Standby</h3>
                      <p className="mt-1 max-w-sm text-xs text-slate-400">
                        Click below to launch device camera and scan worker ID card QR code.
                      </p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="mt-5 flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-bold text-slate-950 hover:bg-emerald-400 shadow-lg"
                      >
                        Start Camera Scanner
                      </button>
                    </div>
                  )}
                </div>

                {isScanning && (
                  <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">Scanner Active</span>
                    </div>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                    >
                      Stop Camera
                    </button>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                  <p className="font-bold">Camera Notice:</p>
                  <p className="mt-1">{cameraError}</p>
                </div>
              )}

              {/* Manual Input Fallback */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800">Manual Code Entry (Barcode / ID Fallback)</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Worker ID Code (e.g. L-100001) manually type karke bhi attendance mark kar sakte hain.
                </p>
                <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter Worker Code (e.g. L-100001)"
                    className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-xs font-mono outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim() || isProcessing}
                    className="h-10 rounded-md bg-indigo-700 px-5 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50"
                  >
                    Mark Attendance
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Live Scan Feed / Log */}
            <div className="space-y-5 lg:col-span-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Live Scanned Attendance</h3>
                    <p className="text-[11px] text-slate-500">Today&apos;s real-time scan activity</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                    {recentScans.length} Scans
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {recentScans.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      No scans yet today. Start camera and show worker ID card QR code.
                    </div>
                  ) : (
                    recentScans.map((scan, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start justify-between rounded-lg border p-3 text-xs transition ${
                          scan.status === "SUCCESS"
                            ? "border-emerald-200 bg-emerald-50/60"
                            : "border-red-200 bg-red-50/60"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-900">{scan.name}</strong>
                            <span className="font-mono text-[10px] font-bold text-indigo-700">
                              #{scan.labourCode}
                            </span>
                          </div>
                          <p
                            className={`mt-1 text-[11px] ${
                              scan.status === "SUCCESS" ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {scan.message}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] font-semibold text-slate-500">
                          {scan.timestamp}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Instructions Card */}
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 text-xs text-slate-700">
                <strong className="block text-sm font-bold text-indigo-950">
                  Supervisor Instructions
                </strong>
                <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                  <li>&bull; Shift start par camera open karein aur workers se ID card show karne ko bolein.</li>
                  <li>&bull; Har scan hone par green status confirmation flash hoga aur sheet me save hoga.</li>
                  <li>&bull; Agar worker ke paas physical card nahi hai to unka code search karke manual mark karein.</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

