import Link from 'next/link'

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow/10 dark:border-[#21262d] dark:bg-[#0d1117]">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Zen Builder</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Next.js 14 + Builder.io + Tailwind. Start editing content visually.</p>
        <div className="mt-6 flex gap-3">
          <Link className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" href="/builder/page/home">Open Builder Page</Link>
          <Link className="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-[#161b22]" href="/dashboard">Dashboard</Link>
          <Link className="rounded-lg border border-slate-400 px-4 py-2 hover:bg-slate-50 dark:hover:bg-[#161b22]" href="/ide">Open IDE</Link>
          <a className="rounded-lg border border-emerald-600 px-4 py-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-[#0d241a]" href="/api/auth/github/start">Login with GitHub</a>
        </div>
      </section>
    </main>
  )
}

