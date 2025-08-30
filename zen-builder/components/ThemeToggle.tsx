"use client"
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const initial = localStorage.getItem('theme') || 'dark'
    const isDark = initial === 'dark'
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
    document.cookie = `theme=${initial}; path=/; max-age=31536000`
  }, [])
  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.cookie = `theme=${next ? 'dark':'light'}; path=/; max-age=31536000`
  }
  return (
    <button onClick={toggle} className="rounded-lg border px-3 py-1.5 text-sm dark:border-[#30363d]">
      {dark ? 'Light' : 'Dark'}
    </button>
  )
}

