"use client"
export default function GlobalError({ error }: { error: Error & { digest?: string } }){
  return (
    <html>
      <body className="grid min-h-screen place-items-center">
        <div className="rounded border p-6 text-sm dark:border-[#21262d]">
          <div className="mb-2 font-semibold">Something went wrong</div>
          <pre className="max-w-[70vw] overflow-auto text-xs opacity-80">{error?.message}</pre>
        </div>
      </body>
    </html>
  )
}

