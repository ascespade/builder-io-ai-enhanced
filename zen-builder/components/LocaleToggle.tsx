"use client"
import { useEffect, useState } from 'react'

export default function LocaleToggle() {
  const [locale, setLocale] = useState<'en'|'ar'>('en')
  useEffect(()=>{
    const saved = (localStorage.getItem('locale') as 'en'|'ar') || 'en'
    setLocale(saved)
    document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr'
    document.cookie = `locale=${saved}; path=/; max-age=31536000`
  },[])
  function toggle(){
    const next = locale === 'en' ? 'ar' : 'en'
    setLocale(next)
    localStorage.setItem('locale', next)
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
    document.cookie = `locale=${next}; path=/; max-age=31536000`
  }
  return (
    <button onClick={toggle} className="rounded-lg border px-3 py-1.5 text-sm dark:border-[#30363d]">
      {locale === 'ar' ? 'EN' : 'AR'}
    </button>
  )
}

