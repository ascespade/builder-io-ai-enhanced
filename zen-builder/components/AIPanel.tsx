"use client"
import { useRef, useState } from 'react'
import { GEMINI_MODEL } from '../lib/env'

type Msg = { role: 'user'|'assistant'; html: string }

const SYSTEM_PROMPT = `You are Builder IDE Agent.
- Act like a senior full‑stack engineer in a visual IDE.
- Be decisive, avoid asking for confirmation unless blocking.
- When asked to fix or generate code, reply with a single fenced code block containing COMPLETE code for the file. Do not add commentary outside the block.
- Prefer accessibility, performance, and i18n (ar/en). Add semantic HTML, ARIA, and RTL‑safe styles.
- For Next.js 14 App Router, follow best practices: server components by default, client where needed, revalidate appropriately.
- For Tailwind, keep classes concise and consistent.
- If intent = explain, provide a short, high‑signal explanation.
- If intent = test, generate runnable unit tests.
`

function mdToHtml(text: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!))
  let html = esc(text).replace(/\n/g,'<br>')
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre class="rounded-lg border p-3 bg-[#0b1220] text-slate-100 overflow-auto"><code>${esc(code)}</code></pre>`)
  return html
}

export default function AIPanel({ getEditor }: { getEditor: () => string }){
  const [messages, setMessages] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)

  async function send(intent: 'ask'|'fix'|'explain'|'test'){
    if (busy) return
    const prompt = input.current?.value?.trim(); if(!prompt) return
    input.current!.value = ''
    setMessages(m => [...m, { role:'user', html: mdToHtml(prompt) }])
    setBusy(true)
    const sys = SYSTEM_PROMPT
    const payload = {
      system: sys,
      messages: [ { role: 'user', content: `Intent: ${intent}\nCurrent file content below:\n\n${getEditor() || ''}\n\nUser request:\n${prompt}` } ],
      model: GEMINI_MODEL
    }
    const res = await fetch('/api/ai/proxy', { method:'POST', headers: { 'Content-Type':'application/json', ...(keyRef.current?.value ? { 'x-gemini-key': keyRef.current.value } : {}) }, body: JSON.stringify(payload) })
    const data = await res.json().catch(()=>({ text: 'Invalid response' }))
    const text = data.text || JSON.stringify(data)
    setMessages(m => [...m, { role:'assistant', html: mdToHtml(text) }])
    setBusy(false)
  }

  return (
    <div className="flex h-full flex-col border-l dark:border-[#21262d]">
      <div className="flex items-center justify-between gap-3 border-b p-2 dark:border-[#21262d]">
        <div className="text-sm">AI</div>
        <input ref={keyRef} placeholder="Gemini API Key" className="w-60 rounded border px-2 py-1 text-sm dark:border-[#30363d] bg-transparent" type="password" />
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-3">
        {messages.map((m,i)=> (
          <div key={i} className={m.role==='user'? 'text-right' : ''}>
            <div className={`inline-block max-w-[85%] rounded-lg border px-3 py-2 text-sm ${m.role==='user'? 'bg-blue-600 text-white border-blue-600' : 'dark:border-[#21262d]'}`} dangerouslySetInnerHTML={{ __html: m.html }} />
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 border-t p-2 dark:border-[#21262d]">
        <textarea ref={input} className="h-16 flex-1 resize-none rounded border p-2 text-sm dark:border-[#30363d] bg-transparent" placeholder="Ask the IDE agent..." />
        <div className="flex flex-col gap-2">
          <button disabled={busy} onClick={()=>send('ask')} className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-60">Send</button>
          <div className="flex gap-2">
            <button disabled={busy} onClick={()=>send('fix')} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Fix</button>
            <button disabled={busy} onClick={()=>send('explain')} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Explain</button>
            <button disabled={busy} onClick={()=>send('test')} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Tests</button>
          </div>
        </div>
      </div>
    </div>
  )
}

