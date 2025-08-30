import { NextRequest } from 'next/server'
import { API_BASE_URL } from '../../../../lib/env'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const key = req.headers.get('x-gemini-key') || ''
    const res = await fetch(`${API_BASE_URL}/api/ai/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-key': key } : {})
      },
      body
    })
    const text = await res.text()
    return new Response(text, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Proxy failed', details: e?.message || String(e) }), { status: 500 })
  }
}

