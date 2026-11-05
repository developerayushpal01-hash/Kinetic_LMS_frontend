"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { apiUrl } from "@/lib/api"
import { useToast } from "@/app/components/toast-provider"

type ApiResponse = {
  success: boolean
  message?: string
}

const ForgotPasswordPage = () => {
  const router = useRouter()
  const { showToast } = useToast()
  const [loginId, setLoginId] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const request = async (endpoint: string, body: object) => {
    const response = await fetch(apiUrl(endpoint), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = (await response.json()) as ApiResponse

    if (!response.ok || !result.success) {
      throw new Error(result.message ?? "Request failed. Please try again.")
    }

    return result
  }

  const handleSendOtp = async () => {
    if (!loginId.trim()) {
      setError("Email or mobile number enter karo.")
      showToast("Email or mobile number enter karo.", "error")
      return
    }

    setError("")
    setMessage("")
    setIsSendingOtp(true)

    try {
      const result = await request("/auth/forgot-password", { loginId: loginId.trim() })
      setOtpSent(true)
      setMessage(result.message ?? "OTP sent successfully.")
      showToast(result.message ?? "OTP sent successfully.", "success")
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "OTP send nahi ho saka."
      setError(message)
      showToast(message, "error")
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!otpSent) {
      setError("Pehle OTP send karo.")
      showToast("Pehle OTP send karo.", "error")
      return
    }

    setIsSubmitting(true)

    try {
      await request("/auth/verify-otp", {
        loginId: loginId.trim(),
        otp: otp.trim(),
      })

      const result = await request("/auth/reset-password", {
        loginId: loginId.trim(),
        newPassword,
      })

      setMessage(result.message ?? "Password reset successfully.")
      showToast(result.message ?? "Password reset successfully.", "success")
      setTimeout(() => router.replace("/pages/login"), 900)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Password reset nahi ho saka."
      setError(message)
      showToast(message, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-[#f1f3ff] via-[#f7f8fb] to-[#edf2f7] text-slate-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-5 sm:px-7">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold text-[#4432db]">Kinetic LMS</Link>
          <span className="hidden h-5 w-px bg-slate-300 sm:block" />
          <span className="hidden text-sm text-slate-600 sm:block">Labor Management System</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden text-slate-600 sm:inline">Authentication</span>
          <span className="hidden text-slate-400 sm:inline">&gt;</span>
          <strong className="text-[#4432db]">Forgot Password</strong>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-6 py-7 shadow-lg shadow-slate-200/70 sm:px-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-[#4432db]">LMS</div>
            <h1 className="mt-1 text-xl font-semibold text-slate-700">Forgot Password</h1>
            <p className="mt-2 text-sm text-slate-500">Please verify your identity to reset your password.</p>
          </div>

          <form onSubmit={handleResetPassword} className="mt-7 space-y-5">
            <div>
              <label htmlFor="loginId" className="mb-2 block text-xs font-medium text-slate-700">Email / Mobile</label>
              <div className="relative">
                <svg aria-hidden="true" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6.5h18v11H3v-11Zm0 .5 9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                <input
                  id="loginId"
                  value={loginId}
                  onChange={(event) => {
                    setLoginId(event.target.value)
                    setOtpSent(false)
                  }}
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="e.g. user@enterprise.com"
                  className="h-11 w-full rounded border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4432db] focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isSendingOtp}
                className="mt-1 ml-auto block text-xs font-medium text-[#4432db] hover:underline disabled:opacity-60"
              >
                {isSendingOtp ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
              </button>
            </div>

            <div>
              <label htmlFor="otp" className="mb-2 block text-xs font-medium text-slate-700">OTP / Token</label>
              <div className="relative">
                <svg aria-hidden="true" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none">
                  <path d="M5 8h2v8H5V8Zm4-3h2v14H9V5Zm4 2h2v10h-2V7Zm4 2h2v6h-2V9Z" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                <input
                  id="otp"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  disabled={!otpSent}
                  placeholder="6-digit code"
                  className="h-11 w-full rounded border border-slate-300 bg-white pl-10 pr-3 text-sm tracking-[0.3em] outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#4432db] focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="mb-2 block text-xs font-medium text-slate-700">New Password</label>
              <div className="relative">
                <svg aria-hidden="true" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="10" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                <input
                  id="newPassword"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={!otpSent}
                  placeholder="Min. 8 characters"
                  className="h-11 w-full rounded border border-slate-300 bg-white pl-10 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4432db] focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                >
                  <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
              </div>
            </div>

            {error && <div role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {message && <div role="status" className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}

            <button
              type="submit"
              disabled={!otpSent || isSubmitting}
              className="h-12 w-full rounded bg-[#3f2bd9] text-base font-semibold text-white shadow-md transition hover:bg-[#3522c7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Resetting Password..." : "Submit / Login"}
            </button>

            <Link href="/pages/login" className="block text-center text-sm text-slate-600 hover:text-[#4432db]">
              &larr; Back to Login
            </Link>
          </form>
        </div>
      </section>

      <footer className="flex shrink-0 flex-col gap-2 px-6 py-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <span>&copy; 2026 Kinetic Enterprise Edition</span>
          <span>Privacy Policy</span>
          <span>System Status: <strong className="text-emerald-600">Optimal</strong></span>
        </div>
        <span className="rounded-full bg-slate-200 px-3 py-1">V2.4.1-LTS</span>
      </footer>
    </main>
  )
}

export default ForgotPasswordPage