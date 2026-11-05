import Link from "next/link"

const UnauthorizedPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
    <section className="w-full max-w-md border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-2xl font-bold text-red-600">!</div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">Access denied</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">This area is available only to contractor accounts.</p>
      <Link href="/pages/login" className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700">
        Go to login
      </Link>
    </section>
  </main>
)

export default UnauthorizedPage