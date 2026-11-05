"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type UserRole = "SUPERVISOR" | "ACCOUNTANT"
type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED"

type UserData = {
  _id: string
  employeeCode?: string
  name: string
  email: string
  mobile: string
  role: UserRole
  isActive: boolean
  status?: UserStatus
}

type ApiResponse = {
  success: boolean
  message?: string
  data?: UserData
}

type UserFormProps = {
  mode: "create" | "edit"
  userId?: string
}

const UserForm = ({ mode, userId }: UserFormProps) => {
  const router = useRouter()
  const { showToast } = useToast()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [mobile, setMobile] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("SUPERVISOR")
  const [status, setStatus] = useState<UserStatus>("ACTIVE")
  const [employeeCode, setEmployeeCode] = useState("")
  const [isLoading, setIsLoading] = useState(mode === "edit")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (mode !== "edit" || !userId) return

    const controller = new AbortController()

    const loadUser = async () => {
      try {
        const response = await fetch(apiUrl(`/users/${userId}`), {
          credentials: "include",
          signal: controller.signal,
        })
        const result = (await response.json()) as ApiResponse

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? "User details load nahi ho sake.")
        }

        setName(result.data.name)
        setEmail(result.data.email)
        setMobile(result.data.mobile)
        setRole(result.data.role)
        setStatus(result.data.status ?? (result.data.isActive ? "ACTIVE" : "INACTIVE"))
        setEmployeeCode(result.data.employeeCode ?? "")
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name !== "AbortError") {
          setError(requestError.message)
          showToast(requestError.message, "error")
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
    return () => controller.abort()
  }, [mode, showToast, userId])

  const parseResponse = async (response: Response) => {
    const result = (await response.json()) as ApiResponse
    if (!response.ok || !result.success) {
      throw new Error(result.message ?? "Request failed. Please try again.")
    }
    return result
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const endpoint = mode === "create" ? "/users/create-user" : `/users/update/${userId}`
      const body =
        mode === "create"
          ? { name: name.trim(), email: email.trim(), mobile: mobile.trim(), password, role }
          : { name: name.trim(), email: email.trim(), mobile: mobile.trim() }

      const response = await fetch(apiUrl(endpoint), {
        method: mode === "create" ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await parseResponse(response)
      showToast(result.message ?? `User ${mode === "create" ? "created" : "updated"} successfully.`, "success")
      router.push("/pages/contractorpages/users")
      router.refresh()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Request failed."
      setError(message)
      showToast(message, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (nextStatus: UserStatus) => {
    if (!userId || nextStatus === status) return

    try {
      const response = await fetch(apiUrl(`/users/${userId}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const result = await parseResponse(response)
      setStatus(nextStatus)
      showToast(result.message ?? "User status updated.", "success")
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "Status update failed.", "error")
    }
  }

  const handleDelete = async () => {
    if (!userId || !window.confirm("Kya aap is user ko delete karna chahte hain?")) return

    setIsDeleting(true)
    try {
      const response = await fetch(apiUrl(`/users/delete/${userId}`), {
        method: "DELETE",
        credentials: "include",
      })
      const result = await parseResponse(response)
      showToast(result.message ?? "User deleted successfully.", "success")
      router.push("/pages/contractorpages/users")
      router.refresh()
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "Delete failed.", "error")
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f6f7fb]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="mx-auto max-w-5xl p-5 lg:p-7">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">Users &gt; {mode === "create" ? "Add User" : "Edit User"}</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{mode === "create" ? "Add New User" : "Edit User"}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {mode === "create" ? "Onboard a supervisor or accountant to manage operations." : "Update account details, access status, or remove this user."}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/pages/contractorpages/users" className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                × Cancel
              </Link>
              <button form="user-form" type="submit" disabled={isSubmitting || isLoading} className="rounded-md bg-[#4938df] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3d2fc5] disabled:opacity-60">
                {isSubmitting ? "Saving..." : mode === "create" ? "Save User" : "Save Changes"}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading user details...</div>
          ) : (
            <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-indigo-100 text-indigo-700">♙</span>
                  <h2 className="font-bold text-slate-800">Identity Details</h2>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="role" className="mb-2 block text-xs font-medium text-slate-600">User Role</label>
                    <select id="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)} disabled={mode === "edit"} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-100">
                      <option value="SUPERVISOR">Supervisor</option>
                      <option value="ACCOUNTANT">Accountant</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="name" className="mb-2 block text-xs font-medium text-slate-600">Full Name</label>
                    <input id="name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="e.g. Robert Smith" className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label htmlFor="mobile" className="mb-2 block text-xs font-medium text-slate-600">Mobile Number</label>
                    <input id="mobile" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))} required inputMode="numeric" pattern="[0-9]{10}" placeholder="9876543210" className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-xs font-medium text-slate-600">Email Address</label>
                    <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} required type="email" placeholder="user@example.com" className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500" />
                  </div>
                  {mode === "create" && (
                    <div className="sm:col-span-2">
                      <label htmlFor="password" className="mb-2 block text-xs font-medium text-slate-600">Temporary Password</label>
                      <input id="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} type="password" autoComplete="new-password" placeholder="Minimum 8 characters" className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500" />
                      <p className="mt-2 text-xs text-slate-400">Share this temporary password securely with the new user.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-sky-100 text-sky-700">▣</span>
                  <div>
                    <h2 className="font-bold text-slate-800">Account & Access</h2>
                    <p className="text-xs text-slate-400">Manage account access and identification.</p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600">Employee Code</label>
                    <input value={mode === "create" ? "Generated automatically" : employeeCode || "—"} readOnly className="h-11 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600">Account Status</label>
                    {mode === "edit" ? (
                      <div className="grid grid-cols-3 gap-2">
                        {(["ACTIVE", "INACTIVE", "BLOCKED"] as const).map((item) => (
                          <button key={item} type="button" onClick={() => handleStatusChange(item)} className={`h-11 rounded-md border text-xs font-semibold ${status === item ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
                            {item === "BLOCKED" ? "Blocked" : item === "ACTIVE" ? "Active" : "Inactive"}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-11 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">● Active on creation</div>
                    )}
                  </div>
                </div>
              </section>

              {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {mode === "edit" && (
                  <button type="button" onClick={handleDelete} disabled={isDeleting} className="rounded-md border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
                    {isDeleting ? "Deleting..." : "Delete User"}
                  </button>
                )}
                <Link href="/pages/contractorpages/users" className="rounded-md border border-slate-300 bg-white px-6 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</Link>
                <button type="submit" disabled={isSubmitting} className="rounded-md bg-[#4938df] px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#3d2fc5] disabled:opacity-60">
                  {isSubmitting ? "Saving..." : mode === "create" ? "Create User" : "Update User"}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}

export default UserForm