import { AccentColor, AccentSwatch, ThemeMode, ThemeTokens } from '@/types/canvas';

export const STUDIO_THEMES: Record<ThemeMode, ThemeTokens> = {
  light: {
    canvasBg: '#f9f9fb',
    dotColor: '#cbd5e1',
    cardBase: 'bg-white',
    cardBorder: 'border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.05)]',
    cardBorderHover: 'hover:border-indigo-400/50 hover:shadow-[0_4px_16px_rgba(99,102,241,0.08)]',
    cardSelected: 'ring-2 ring-indigo-600 border-indigo-600 shadow-[0_8px_30px_rgba(79,70,229,0.12)]',
    headerText: 'text-slate-900',
    bodyText: 'text-slate-700',
    subText: 'text-slate-400',
    panelBg: 'bg-white/95 backdrop-blur-md border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.06)]',
    toolHover: 'hover:bg-indigo-50 hover:text-indigo-600 text-slate-600',
    tagBg: 'bg-slate-100 text-slate-600',
    connectorStroke: '#64748b',
    connectorActive: '#4f46e5'
  },
  dark: {
    canvasBg: '#0c0d10',
    dotColor: '#27272a',
    cardBase: 'bg-[#141519]',
    cardBorder: 'border-zinc-800/90 shadow-[0_2px_8px_rgba(0,0,0,0.4),0_12px_28px_rgba(0,0,0,0.5)]',
    cardBorderHover: 'hover:border-indigo-500/40 hover:shadow-[0_4px_20px_rgba(99,102,241,0.15)]',
    cardSelected: 'ring-2 ring-indigo-500 border-indigo-500 shadow-[0_8px_30px_rgba(99,102,241,0.2)]',
    headerText: 'text-zinc-100',
    bodyText: 'text-zinc-300',
    subText: 'text-zinc-500',
    panelBg: 'bg-[#141519]/95 backdrop-blur-md border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.7)]',
    toolHover: 'hover:bg-indigo-500/15 text-zinc-400 hover:text-indigo-300',
    tagBg: 'bg-zinc-800/80 text-zinc-300',
    connectorStroke: '#52525b',
    connectorActive: '#818cf8'
  }
};

/* Tactile editorial studio accent swatches */
export const ACCENT_SWATCHES: Record<AccentColor, AccentSwatch> = {
  neutral: {
    name: 'Neutral',
    badge: 'bg-slate-500',
    lightBorder: 'border-slate-200',
    darkBorder: 'border-zinc-700',
    lightHeader: 'bg-slate-50/80 border-b border-slate-100',
    darkHeader: 'bg-zinc-900/50 border-b border-zinc-800'
  },
  terracotta: {
    name: 'Terracotta',
    badge: 'bg-amber-600',
    lightBorder: 'border-amber-200',
    darkBorder: 'border-amber-900/60',
    lightHeader: 'bg-amber-50/70 border-b border-amber-100 text-amber-900',
    darkHeader: 'bg-amber-950/30 border-b border-amber-900/30 text-amber-200'
  },
  sage: {
    name: 'Sage',
    badge: 'bg-emerald-600',
    lightBorder: 'border-emerald-200',
    darkBorder: 'border-emerald-900/60',
    lightHeader: 'bg-emerald-50/70 border-b border-emerald-100 text-emerald-900',
    darkHeader: 'bg-emerald-950/30 border-b border-emerald-900/30 text-emerald-200'
  },
  cobalt: {
    name: 'Cobalt',
    badge: 'bg-sky-600',
    lightBorder: 'border-sky-200',
    darkBorder: 'border-sky-900/60',
    lightHeader: 'bg-sky-50/70 border-b border-sky-100 text-sky-900',
    darkHeader: 'bg-sky-950/30 border-b border-sky-900/30 text-sky-200'
  },
  lavender: {
    name: 'Lavender',
    badge: 'bg-indigo-500',
    lightBorder: 'border-indigo-200',
    darkBorder: 'border-indigo-900/60',
    lightHeader: 'bg-indigo-50/70 border-b border-indigo-100 text-indigo-900',
    darkHeader: 'bg-indigo-950/30 border-b border-indigo-900/30 text-indigo-200'
  },
  rose: {
    name: 'Rose',
    badge: 'bg-rose-500',
    lightBorder: 'border-rose-200',
    darkBorder: 'border-rose-900/60',
    lightHeader: 'bg-rose-50/70 border-b border-rose-100 text-rose-900',
    darkHeader: 'bg-rose-950/30 border-b border-rose-900/30 text-rose-200'
  }
};
