export default function ShellDashboard() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[1,2,3].map(n=> (
        <div key={n} className="card">
          <div className="text-sm text-slate-500">Widget {n}</div>
          <div className="mt-2 text-2xl font-semibold">—</div>
        </div>
      ))}
    </div>
  )
}

