"use client"
import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/env'

type GitState = {
  status?: any
  branchSummary?: any
  log?: any
  error?: string
}

export default function GitPanel({ repoPath: initialPath }: { repoPath?: string }){
  const [repoPath, setRepoPath] = useState(initialPath || (typeof window!=='undefined' ? localStorage.getItem('gitRepoPath') || '' : ''))
  const [recents, setRecents] = useState<string[]>(typeof window!=='undefined' ? JSON.parse(localStorage.getItem('gitRecents')||'[]') : [])
  const [state, setState] = useState<GitState>({})
  const [message, setMessage] = useState('chore: update')
  const [branches, setBranches] = useState<{ current?: string, all?: string[] }>({})
  const [diffText, setDiffText] = useState('')
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : ''

  function remember(path: string){
    const next = Array.from(new Set([path, ...recents])).slice(0,8)
    setRecents(next)
    localStorage.setItem('gitRecents', JSON.stringify(next))
    localStorage.setItem('gitRepoPath', path)
  }

  async function load(){
    const res = await fetch(`${API_BASE_URL}/api/github/status`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: repoPath }) })
    const data = await res.json(); setState(data)
    const b = await fetch(`${API_BASE_URL}/api/github/branches`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: repoPath })}).then(r=>r.json())
    setBranches({ current: b.current, all: b.all })
  }
  async function commit(){
    await fetch(`${API_BASE_URL}/api/github/commit`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: repoPath, message }) })
    await load()
  }
  async function push(){
    await fetch(`${API_BASE_URL}/api/github/push`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: repoPath }) })
    await load()
  }
  async function pull(){
    await fetch(`${API_BASE_URL}/api/github/pull`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: repoPath }) })
    await load()
  }
  async function createBranch(name: string){
    await fetch(`${API_BASE_URL}/api/github/branch/create`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: repoPath, name }) })
    await load()
  }
  async function checkoutBranch(name: string){
    await fetch(`${API_BASE_URL}/api/github/branch/checkout`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: repoPath, name }) })
    await load()
  }
  async function showDiff(from?: string, to?: string){
    const txt = await fetch(`${API_BASE_URL}/api/github/diff`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: repoPath, from, to })}).then(r=>r.text())
    setDiffText(txt)
  }

  useEffect(()=>{ if(repoPath) { remember(repoPath); load() } },[repoPath])

  return (
    <div className="rounded-xl border p-3 dark:border-[#21262d]">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <div>Git</div>
        <div className="flex items-center gap-2">
          <input value={repoPath} onChange={e=>setRepoPath(e.target.value)} placeholder="/workspace/projects/my-repo" className="w-72 rounded border px-2 py-1 text-sm dark:border-[#30363d] bg-transparent" />
          {recents.length>0 && (
            <select onChange={e=> setRepoPath(e.target.value)} className="rounded border px-2 py-1 text-sm dark:border-[#30363d] bg-transparent">
              <option value="">Recent</option>
              {recents.map(r=> <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <button onClick={()=> repoPath && load()} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Open</button>
        </div>
      </div>
      <div className="mb-2 flex gap-2">
        <input className="flex-1 rounded border px-2 py-1 text-sm dark:border-[#30363d] bg-transparent" value={message} onChange={e=>setMessage(e.target.value)} />
        <button onClick={commit} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Commit</button>
        <button onClick={push} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Push</button>
        <button onClick={pull} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Pull</button>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs opacity-70">Branch:</span>
        <select value={branches.current} onChange={e=>checkoutBranch(e.target.value)} className="rounded border px-2 py-1 text-sm dark:border-[#30363d] bg-transparent">
          {(branches.all||[]).map(n=> <option key={n} value={n}>{n}</option>)}
        </select>
        <input placeholder="new-branch" id="__newBranch" className="w-40 rounded border px-2 py-1 text-sm dark:border-[#30363d] bg-transparent" />
        <button onClick={()=>{ const el=document.getElementById('__newBranch') as HTMLInputElement; el && el.value && createBranch(el.value) }} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Create</button>
        <button onClick={()=> showDiff()} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Diff</button>
      </div>
      <pre className="max-h-60 overflow-auto rounded border p-2 text-xs dark:border-[#30363d]">{JSON.stringify(state, null, 2)}</pre>
      {diffText && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm">Diff</summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border p-2 text-xs dark:border-[#30363d]">{diffText}</pre>
        </details>
      )}
    </div>
  )
}

