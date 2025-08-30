"use client"
import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import AIPanel from '../../components/AIPanel'
import GitPanel from '../../components/GitPanel'

export default function IDEPage(){
  const container = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(()=>{
    if(!container.current || (window as any).monaco) return
  },[])

  function setupMonaco(){
    if (editorRef.current) return
    ;(window as any).require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs' } })
    ;(window as any).require(['vs/editor/editor.main'], function(){
      const monaco = (window as any).monaco
      editorRef.current = monaco.editor.create(container.current!, {
        value: '<!-- Start coding here -->',
        language: 'html',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true }
      })
      setReady(true)
    })
  }

  return (
    <main className="grid h-[calc(100vh-2rem)] grid-cols-1 gap-3 p-3 md:grid-cols-[1.1fr_0.9fr_360px]">
      <div className="rounded-xl border dark:border-[#21262d]">
        <div className="border-b p-2 text-sm dark:border-[#21262d]">Monaco Editor</div>
        <div ref={container} className="h-[calc(100vh-6.5rem)]" />
      </div>
      <div className="rounded-xl border dark:border-[#21262d]">
        <div className="flex items-center justify-between border-b p-2 text-sm dark:border-[#21262d]">
          <div>Preview</div>
          <button onClick={()=>{
            const html = editorRef.current?.getValue?.() || ''
            const doc = (document.getElementById('preview-frame') as HTMLIFrameElement).contentDocument!
            doc.open(); doc.write(html); doc.close();
          }} className="rounded border px-2 py-1 text-xs dark:border-[#30363d]">Refresh</button>
        </div>
        <iframe id="preview-frame" className="h-[calc(100vh-6.5rem)] w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <GitPanel />
        <AIPanel getEditor={()=> editorRef.current?.getValue?.() || ''} />
      </div>
      <Script id="monaco-env">{`
        window.MonacoEnvironment={getWorkerUrl:() => URL.createObjectURL(new Blob([
          "self.MonacoEnvironment={baseUrl:'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/'};\n"+
          "importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs/base/worker/workerMain.js');"
        ],{type:'text/javascript'}))}
      `}</Script>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs/loader.min.js" onLoad={setupMonaco} />
    </main>
  )
}

