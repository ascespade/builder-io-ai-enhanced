import { ReactNode } from 'react'
import ThemeToggle from '../../components/ThemeToggle'
import LocaleToggle from '../../components/LocaleToggle'

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="text-lg font-semibold">Zen Builder</div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LocaleToggle />
        </div>
      </header>
      {children}
    </div>
  )
}

