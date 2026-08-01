"use client"

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'
import * as React from 'react'

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = (newLocale: 'fr' | 'en') => {
    if (newLocale !== locale) {
      router.replace(pathname, { locale: newLocale })
    }
  }

  return (
    <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs font-mono text-xs font-black">
      <button
        type="button"
        onClick={() => switchLocale('fr')}
        className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
          locale === 'fr' 
            ? 'bg-blue-600 text-white shadow-xs font-black' 
            : 'text-slate-600 hover:text-slate-900 font-bold'
        }`}
        aria-label="Passer en Français"
      >
        FR
      </button>

      <span className="text-slate-300 px-0.5">|</span>

      <button
        type="button"
        onClick={() => switchLocale('en')}
        className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
          locale === 'en' 
            ? 'bg-blue-600 text-white shadow-xs font-black' 
            : 'text-slate-600 hover:text-slate-900 font-bold'
        }`}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  )
}
