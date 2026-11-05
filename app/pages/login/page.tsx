"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { apiUrl } from "@/lib/api"
import { useToast } from "@/app/components/toast-provider"

type LoginResponse = {
  success: boolean
  message?: string
}

const LoginPage = () => {
  const router = useRouter()
  const { showToast } = useToast()
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password, rememberMe }),
      })
      const result = (await response.json()) as LoginResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Login failed. Please try again.")
      }

      showToast(result.message ?? "Login successful.", "success")
      router.push("/")
      router.refresh()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Login failed. Please try again."
      setError(message)
      showToast(message, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#5042e8] px-12 text-white lg:flex lg:items-center lg:justify-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "repeating-linear-gradient(58deg, transparent 0, transparent 78px, rgba(255,255,255,.75) 79px, transparent 81px)",
          }}
        />
        <div className="pointer-events-none absolute left-[23%] top-[49%] h-48 w-64 border border-white/20" />

        <div className="relative z-10 -mt-32 max-w-md text-center">
          <div className="mx-auto mb-5 flex h-10 w-12 items-center justify-center bg-white/10">
            <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none">
              <path d="M4 21V3h11v18M15 9h5v12M2 21h20M7 7h2m2 0h2M7 11h2m2 0h2M7 15h2m2 0h2m5-2h1m-1 4h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Kinetic Enterprise</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-indigo-100">
            Streamlining workforce management through intelligence and precision. Welcome back to your dashboard.
          </p>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-6 py-14 sm:px-10">
        <span className="absolute right-7 top-6 text-[10px] font-medium tracking-[0.22em] text-gray-700">
          AUTHENTICATION
        </span>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-[#5042e8] text-white">
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path d="M4 21V3h11v18M15 9h5v12M2 21h20M7 7h2m2 0h2M7 11h2m2 0h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-bold text-gray-900">Kinetic Enterprise</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-[#202124]">Login</h2>
            <p className="mt-2 text-sm text-gray-500">Access the Labour Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="loginId" className="mb-2 block text-[11px] font-semibold tracking-wide text-gray-600">
                EMAIL / MOBILE
              </label>
              <div className="relative">
                <svg aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M8.5 10.5a3.5 3.5 0 1 1 7 0c0 2.5-3.5 2-3.5 4M12 18h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <input
                  id="loginId"
                  name="loginId"
                  type="text"
                  autoComplete="username"
                  required
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  placeholder="name@company.com"
                  className="h-11 w-full rounded border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#5042e8] focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-[11px] font-semibold tracking-wide text-gray-600">
                  PASSWORD
                </label>
                <Link href="/pages/forgot-password" className="text-[11px] font-medium text-[#4b3ee8] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <svg aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" viewBox="0 0 24 24" fill="none">
                  <rect x="6" y="10" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M9 10V7a3 3 0 0 1 6 0v3M12 14v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded border border-gray-300 bg-white pl-10 pr-11 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#5042e8] focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                </button>
              </div>
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-3 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-[#5042e8]"
              />
              Keep me logged in
            </label>

            {error && (
              <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 bg-[#5042e8] text-xs font-bold tracking-[0.16em] text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4335dc] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "SIGNING IN..." : "SIGN IN"}
              {!isSubmitting && <span className="text-lg font-normal">→</span>}
            </button>
          </form>

          <div className="mt-7 border-t border-gray-300 pt-7 text-center text-[11px] text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/pages/register" className="font-medium text-[#4b3ee8] hover:underline">
              Register
            </Link>
          </div>
        </div>

        <div className="absolute bottom-6 left-6 right-6 flex justify-between text-[10px] text-gray-400">
          <span>© 2026 LMS Kinetic Enterprise</span>
          <span>v2.4.0</span>
        </div>
      </section>
    </main>
  )
}

export default LoginPage