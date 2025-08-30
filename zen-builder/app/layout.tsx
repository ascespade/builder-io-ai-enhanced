import './globals.css'
import { ReactNode } from 'react'
import { cookies } from 'next/headers'

export const metadata = {
  title: 'Zen Builder',
  description: 'Professional visual builder powered by Builder.io',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const theme = cookies().get('theme')?.value || 'dark'
  const locale = cookies().get('locale')?.value || 'en'
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0d1117] dark:text-slate-200 ${theme==='dark'?'dark':''}`}>
        {children}
      </body>
    </html>
  )
}

