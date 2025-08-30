"use client"
import useSWR from 'swr'
import { API_BASE_URL } from '../../lib/env'

const fetcher = (url: string, token?: string) => fetch(url, { headers: token? { Authorization: `Bearer ${token}` } : undefined }).then(r=>r.json())

export default function Stats(){
  const token = typeof window!=='undefined' ? localStorage.getItem('authToken') || '' : ''
  const { data } = useSWR([`${API_BASE_URL}/api/stats`, token], ([url,t]) => fetcher(url,t), { refreshInterval: 10000 })
  const s = data || { projects: 0, pages: 0, components: 0, media: 0 }
  const items = [
    { k:'Projects', v: s.projects },
    { k:'Pages', v: s.pages },
    { k:'Components', v: s.components },
    { k:'Media', v: s.media },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map(i=> (
        <div key={i.k} className="card">
          <div className="text-sm text-slate-500 dark:text-slate-400">{i.k}</div>
          <div className="mt-2 text-2xl font-semibold">{i.v}</div>
        </div>
      ))}
    </div>
  )
}

