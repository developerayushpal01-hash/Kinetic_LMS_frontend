"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type User = {
  _id: string
  employeeCode?: string
  name: string
  email: string
  mobile: string
  role: "SUPERVISOR" | "ACCOUNTANT"
  isActive: boolean
  status?: "ACTIVE" | "INACTIVE" | "BLOCKED"
  createdAt: string
}

type UsersResponse = {
  success: boolean
  count?: number
  data?: User[]
  message?: string
}

const PAGE_SIZE = 8

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("")

const UsersPage = () => {
  const { showToast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()

    const loadUsers = async () => {
      try {
        const response = await fetch(apiUrl("/users/get-users"), {
          credentials: "include",
          signal: controller.signal,
        })
        const result = (await response.json()) as UsersResponse

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? "Users load nahi ho sake.")
        }

        setUsers(result.data)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name !== "AbortError") {
          showToast(requestError.message, "error")
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadUsers()
  
  return () => controller.abort()
  }, [showToast])

  const handleDeleteUser = async (user: User) => {


    setDeletingUserId(user._id)
    try {
      const response = await fetch(apiUrl("/users/delete/" + user._id), {
        method: "DELETE",
        credentials: "include",
      })
      const result = (await response.json()) as UsersResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "User delete nahi ho saka.")
      }

      setUsers((current) => current.filter((item) => item._id !== user._id))
      setUserToDelete(null)
      if (selectedUser?._id === user._id) setSelectedUser(null)
      showToast(result.message ?? "User deleted successfully.", "success")
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "Delete failed.", "error")
    } finally {
      setDeletingUserId(null)
    }
  }

  const filteredUsers = useMemo(() => {
    if (activeFilter === "ALL") return users
    return users.filter((user) => (activeFilter === "ACTIVE" ? user.isActive : !user.isActive))
  }, [activeFilter, users])

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const paginationItems = useMemo<(number | string)[]>(() => {
    if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)
    if (currentPage <= 3) return [1, 2, 3, "ellipsis-right", pageCount]
    if (currentPage >= pageCount - 2) return [1, "ellipsis-left", pageCount - 2, pageCount - 1, pageCount]
    return [1, "ellipsis-left", currentPage, "ellipsis-right", pageCount]
  }, [currentPage, pageCount])
  const visibleUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const supervisorCount = users.filter((user) => user.role === "SUPERVISOR").length
  const accountantCount = users.filter((user) => user.role === "ACCOUNTANT").length
  const activeCount = users.filter((user) => user.isActive).length
  const complianceRate = users.length ? Math.round((activeCount / users.length) * 100) : 0

  const changeFilter = (filter: "ALL" | "ACTIVE" | "INACTIVE") => {
    setActiveFilter(filter)
    setCurrentPage(1)
  }

  const exportCsv = () => {
    const rows = [
      ["Employee Code", "Name", "Role", "Email", "Mobile", "Status"],
      ...filteredUsers.map((user) => [
        user.employeeCode ?? "",
        user.name,
        user.role,
        user.email,
        user.mobile,
        user.isActive ? "ACTIVE" : "INACTIVE",
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => JSON.stringify(cell)).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "user-directory.csv"
    anchor.click()
    URL.revokeObjectURL(url)
    showToast("User directory exported.", "success")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7fb]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />

        <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">Dashboard / User Management / <strong className="text-slate-700">Users</strong></p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">User Directory</h1>
              <p className="mt-1 text-sm text-slate-500">Manage supervisors and accountants across your organization.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportCsv} type="button" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                &#8681; Export CSV
              </button>
              <Link href="/pages/contractorpages/users/create" className="rounded-md bg-[#4938df] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3e2fc8]">
                + Add User
              </Link>
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Users", value: users.length, note: "Supervisors and accountants", color: "text-indigo-600", icon: "♙" },
              { label: "Supervisors", value: supervisorCount, note: "Team supervisors", color: "text-slate-700", icon: "▦" },
              { label: "Accountants", value: accountantCount, note: "Finance team members", color: "text-sky-600", icon: "▣" },
              { label: "Active Rate", value: `${complianceRate}%`, note: `${activeCount} active accounts`, color: "text-emerald-600", icon: "✓" },
            ].map((card) => (
              <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded bg-slate-100 text-lg ${card.color}`}>{card.icon}</div>
                <strong className="text-3xl font-bold text-slate-900">{isLoading ? "—" : card.value}</strong>
                <p className="mt-1 text-sm font-semibold text-slate-700">{card.label}</p>
                <p className="mt-1 text-xs text-slate-400">{card.note}</p>
              </article>
            ))}
          </section>

          <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-2 font-bold text-slate-800">Users List</h2>
                {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => changeFilter(filter)}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold ${activeFilter === filter ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-400">{filteredUsers.length} records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Employee Code</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Mobile / Email</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleUsers.map((user, index) => (
                    <tr key={user._id} className="text-sm hover:bg-slate-50">
                      <td className="px-5 py-4 text-xs text-slate-500">{String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">{user.employeeCode ?? "-"}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700">{initials(user.name)}</span>
                          <div>
                            <p className="font-semibold text-slate-800">{user.name}</p>
                            <p className="text-xs text-slate-400">Added {new Date(user.createdAt).toLocaleDateString("en-IN")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded px-2 py-1 text-[10px] font-bold ${user.role === "SUPERVISOR" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700"}`}>{user.role}</span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-medium text-slate-700">{user.mobile}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          ● {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label="View user"
                            title="View user"
                            onClick={() => setSelectedUser(user)}
                            className="flex h-9 w-9 items-center justify-center rounded text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8" />
                              <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                            </svg>
                          </button>
                          <Link
                            href={"/pages/contractorpages/users/" + user._id + "/edit"}
                            aria-label="Edit user"
                            title="Edit user"
                            className="flex h-9 w-9 items-center justify-center rounded text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <path d="M14.5 5.5l4 4M4 20l3.8-.8L19 8a1.8 1.8 0 000-2.5l-.5-.5A1.8 1.8 0 0016 5L4.8 16.2 4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            aria-label="Delete user"
                            title="Delete user"
                            disabled={deletingUserId === user._id}
                            onClick={() => setUserToDelete(user)}
                            className="flex h-9 w-9 items-center justify-center rounded text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                          >
                            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!isLoading && visibleUsers.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-slate-500">No users found.</div>
              )}
              {isLoading && <div className="px-5 py-12 text-center text-sm text-slate-500">Loading users...</div>}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
              <span>Showing {visibleUsers.length} of {filteredUsers.length} users</span>
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label="First page" title="First page" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-sm hover:bg-slate-50 disabled:opacity-40">|&lt;</button>
                <button type="button" aria-label="Previous page" title="Previous page" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-base hover:bg-slate-50 disabled:opacity-40">&lt;</button>
                {paginationItems.map((item) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      aria-label={`Page ${item}`}
                      aria-current={item === currentPage ? "page" : undefined}
                      onClick={() => setCurrentPage(item)}
                      className={`flex h-8 min-w-8 items-center justify-center rounded px-2 font-medium ${item === currentPage ? "bg-indigo-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} className="flex h-8 min-w-6 items-center justify-center text-slate-500">...</span>
                  ),
                )}
                <button type="button" aria-label="Next page" title="Next page" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-base hover:bg-slate-50 disabled:opacity-40">&gt;</button>
                <button type="button" aria-label="Last page" title="Last page" disabled={currentPage === pageCount} onClick={() => setCurrentPage(pageCount)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-sm hover:bg-slate-50 disabled:opacity-40">&gt;|</button>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">Role Distribution</h2>
              <p className="mt-1 text-xs text-slate-500">Current staff distribution across your organization.</p>
              <div className="mt-5 flex h-44 items-end justify-center gap-16 rounded-md border border-slate-200 bg-slate-50 p-5">
                <div className="flex w-24 flex-col items-center gap-2">
                  <strong>{supervisorCount}</strong>
                  <div className="w-full rounded-t bg-indigo-500" style={{ height: `${Math.max(12, supervisorCount * 12)}px` }} />
                  <span className="text-xs text-slate-500">Supervisors</span>
                </div>
                <div className="flex w-24 flex-col items-center gap-2">
                  <strong>{accountantCount}</strong>
                  <div className="w-full rounded-t bg-sky-500" style={{ height: `${Math.max(12, accountantCount * 12)}px` }} />
                  <span className="text-xs text-slate-500">Accountants</span>
                </div>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">Recent Activities</h2>
              <p className="mt-1 text-xs text-slate-500">Latest users added to the system.</p>
              <div className="mt-5 space-y-4">
                {users.slice(0, 4).map((user) => (
                  <div key={user._id} className="border-l-2 border-indigo-500 pl-3">
                    <p className="text-xs font-semibold text-slate-700">{user.name} joined as {user.role.toLowerCase()}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{new Date(user.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                ))}
                {!isLoading && users.length === 0 && <p className="text-xs text-slate-400">No recent activity.</p>}
              </div>
            </article>
          </section>

          {userToDelete && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deletingUserId) setUserToDelete(null)
              }}
            >
              <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                        <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <h2 id="delete-user-title" className="text-lg font-bold text-slate-900">Delete user?</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Are you sure you want to delete <strong className="text-slate-800">{userToDelete.name}</strong>?
                        This user will lose access to the system.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
                    This action will deactivate the account and remove it from the active user directory.
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    disabled={Boolean(deletingUserId)}
                    onClick={() => setUserToDelete(null)}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(deletingUserId)}
                    onClick={() => handleDeleteUser(userToDelete)}
                    className="flex min-w-28 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingUserId ? "Deleting..." : "Delete User"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {selectedUser && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-details-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setSelectedUser(null)
              }}
            >
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 font-bold text-indigo-700">
                      {initials(selectedUser.name)}
                    </span>
                    <div>
                      <h2 id="user-details-title" className="text-lg font-bold text-slate-900">{selectedUser.name}</h2>
                      <p className="text-xs font-semibold text-indigo-600">{selectedUser.role}</p>
                    </div>
                  </div>
                  <button type="button" aria-label="Close" onClick={() => setSelectedUser(null)} className="text-2xl text-slate-400 hover:text-slate-700">×</button>
                </div>

                <dl className="mt-6 grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
                  <dt className="text-slate-500">Employee Code</dt>
                  <dd className="font-medium text-slate-800">{selectedUser.employeeCode ?? "—"}</dd>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="break-all font-medium text-slate-800">{selectedUser.email}</dd>
                  <dt className="text-slate-500">Mobile</dt>
                  <dd className="font-medium text-slate-800">{selectedUser.mobile}</dd>
                  <dt className="text-slate-500">Status</dt>
                  <dd className={selectedUser.isActive ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                    {selectedUser.isActive ? "Active" : "Inactive"}
                  </dd>
                </dl>

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setSelectedUser(null)} className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
                  <Link href={"/pages/contractorpages/users/" + selectedUser._id + "/edit"} className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700">Edit User</Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default UsersPage