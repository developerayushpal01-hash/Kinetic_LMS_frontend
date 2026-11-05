"use client"

import Link from "next/link"
import { ChangeEvent, FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { apiUrl } from "@/lib/api"
import { useToast } from "@/app/components/toast-provider"

type RegisterForm = {
  companyName: string
  ownerName: string
  email: string
  mobile: string
  password: string
  gstNumber: string
  street: string
  city: string
  state: string
  pincode: string
  country: string
}

type RegisterResponse = {
  success: boolean
  message?: string
}

const initialForm: RegisterForm = {
  companyName: "",
  ownerName: "",
  email: "",
  mobile: "",
  password: "",
  gstNumber: "",
  street: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
}

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5547ee] focus:ring-2 focus:ring-indigo-100"

const RegisterPage = () => {
  const router = useRouter()
  const { showToast } = useToast()
  const [form, setForm] = useState<RegisterForm>(initialForm)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    const payload = {
      companyName: form.companyName.trim(),
      ownerName: form.ownerName.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim(),
      password: form.password,
      gstNumber: form.gstNumber.trim(),
      address: {
        street: form.street.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        country: form.country.trim() || "India",
      },
    }

    try {
      const response = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as RegisterResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Registration failed. Please try again.")
      }

      showToast(result.message ?? "Registration successful.", "success")
      router.push("/")
      router.refresh()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Registration failed. Please try again."
      setError(message)
      showToast(message, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-4 text-slate-900 sm:px-6 lg:flex lg:h-[100dvh] lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <header className="mb-3 shrink-0 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight text-[#4938e8]">
          Kinetic LMS
        </Link>
      </header>

      <section className="mx-auto w-full max-w-5xl shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="h-1 w-2/3 bg-[#5647ee]" />

        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Company Registration</h1>
              <p className="mt-1 text-sm text-slate-500">
                Provide the details below to register your organization in the system.
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              &#10003; Secure Form
            </span>
          </div>

          <div className="mt-5 grid gap-7 lg:grid-cols-[270px_1fr]">
            <aside>
              <div className="flex h-40 flex-col justify-end rounded-md border border-indigo-200 bg-gradient-to-br from-white via-indigo-100 to-[#7868df] p-4 text-white">
                <span className="text-xs text-indigo-100">Corporate Onboarding</span>
                <strong className="text-xl">Organization Hub</strong>
              </div>

              <div className="mt-4">
                <h2 className="text-xl font-bold">Registration Requirements</h2>
                <ul className="mt-3 space-y-3 text-sm leading-5 text-slate-600">
                  <li className="flex gap-3">
                    <span className="font-bold text-[#5547ee]">&#9671;</span>
                    <span>Ensure your Tax Identification Number is valid for compliance verification.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-[#5547ee]">&#9633;</span>
                    <span>A primary administrator will be assigned based on the Owner Name and Email provided.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-[#5547ee]">&#9783;</span>
                    <span>Registered addresses are used for generating official invoices and labor reports.</span>
                  </li>
                </ul>
              </div>
            </aside>

            <form onSubmit={handleSubmit} className="space-y-2">
              <div>
                <label htmlFor="companyName" className="mb-1 block text-sm font-semibold">COMPANY NAME</label>
                <input id="companyName" name="companyName" required value={form.companyName} onChange={updateField} placeholder="e.g. Kinetic Enterprises Ltd" className={inputClass} />
              </div>

              <div>
                <label htmlFor="ownerName" className="mb-1 block text-sm font-semibold">OWNER NAME</label>
                <input id="ownerName" name="ownerName" required value={form.ownerName} onChange={updateField} placeholder="Full name of organization head" className={inputClass} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-semibold">EMAIL ADDRESS</label>
                  <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={updateField} placeholder="admin@company.com" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="mobile" className="mb-1 block text-sm font-semibold">MOBILE NUMBER</label>
                  <input id="mobile" name="mobile" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required value={form.mobile} onChange={updateField} placeholder="9876543210" className={inputClass} />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-semibold">PASSWORD</label>
                <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={updateField} placeholder="Minimum 8 characters" className={inputClass} />
              </div>

              <fieldset>
                <legend className="mb-1 text-sm font-semibold">REGISTERED ADDRESS</legend>
                <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3">
                  <input aria-label="Street" name="street" required value={form.street} onChange={updateField} placeholder="Street / Area" className={inputClass} />
                  <input aria-label="City" name="city" required value={form.city} onChange={updateField} placeholder="City" className={inputClass} />
                  <input aria-label="State" name="state" required value={form.state} onChange={updateField} placeholder="State" className={inputClass} />
                  <input aria-label="Pincode" name="pincode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={form.pincode} onChange={updateField} placeholder="Pincode" className={inputClass} />
                  <input aria-label="Country" name="country" required value={form.country} onChange={updateField} placeholder="Country" className={`${inputClass} sm:col-span-2`} />
                </div>
              </fieldset>

              <div>
                <label htmlFor="gstNumber" className="mb-1 block text-sm font-semibold">GST / TAX IDENTIFICATION NUMBER</label>
                <input id="gstNumber" name="gstNumber" value={form.gstNumber} onChange={updateField} placeholder="Enter tax registration ID" className={inputClass} />
              </div>

              {error && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Link href="/pages/login" className="flex h-10 flex-1 items-center justify-center rounded-md border border-slate-400 px-7 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                  Login
                </Link>
                <button type="submit" disabled={isSubmitting} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-[#5547ee] px-6 text-sm font-semibold text-white transition hover:bg-[#4638d8] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? "Registering..." : "Register Company"} <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-2 flex w-full max-w-5xl shrink-0 flex-col gap-3 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong>Need help with registration?</strong>
          <p className="text-xs text-slate-500">Our onboarding team is available 24/7.</p>
        </div>
        <a href="mailto:support@kinetic.example" className="text-xs font-semibold text-[#5547ee] hover:underline">
          Contact Support Specialists
        </a>
      </section>

      <footer className="shrink-0 py-1 text-center text-xs text-slate-500">
        &copy; 2026 Kinetic Enterprise. All rights reserved.
      </footer>
    </main>
  )
}

export default RegisterPage