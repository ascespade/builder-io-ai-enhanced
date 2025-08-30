import Link from 'next/link'
import dynamic from 'next/dynamic'
const Stats = dynamic(() => import('./Stats'), { ssr: false })

export default function Dashboard() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <Stats />
      <div className="card">
        <h2 className="text-xl font-semibold">Get Started</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Create your first visual page in Builder and render it here.
        </p>
        <div className="mt-4 flex gap-3">
          <Link className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" href="/builder/page/home">Preview builder page</Link>
          <Link className="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-[#161b22]" href="https://www.builder.io" target="_blank">Open Builder.io</Link>
        </div>
      </div>
    </main>
  )
}

