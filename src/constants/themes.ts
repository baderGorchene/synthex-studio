import { AccentColor, AccentSwatch, ThemeMode, ThemeTokens } from '@/types/canvas';

export const STUDIO_THEMES: Record<ThemeMode, ThemeTokens> = {
  light: {
    canvasBg: '#ffffff',
    dotColor: '#d9d9d9',
    cardBase: 'bg-white',
    cardBorder: 'border-[#d9d9d9] shadow-[0_1px_3px_rgba(53,53,53,0.04),0_8px_24px_-4px_rgba(53,53,53,0.05)]',
    cardBorderHover: 'hover:border-[#3c6e71] hover:shadow-[0_4px_16px_rgba(60,110,113,0.12)]',
    cardSelected: 'ring-2 ring-[#284b63] border-[#284b63] shadow-[0_8px_30px_rgba(40,75,99,0.16)]',
    headerText: 'text-[#353535]',
    bodyText: 'text-[#353535]',
    subText: 'text-[#353535]/60',
    panelBg: 'bg-white/95 backdrop-blur-md border-[#d9d9d9] shadow-[0_4px_20px_rgba(53,53,53,0.06)]',
    toolHover: 'hover:bg-[#3c6e71]/10 hover:text-[#284b63] text-[#353535]',
    tagBg: 'bg-[#3c6e71]/10 text-[#3c6e71]',
    connectorStroke: '#284b63',
    connectorActive: '#3c6e71'
  },
  dark: {
    canvasBg: '#353535',
    dotColor: '#525252',
    cardBase: 'bg-[#284b63]',
    cardBorder: 'border-[#3c6e71]/40 shadow-[0_2px_8px_rgba(0,0,0,0.4),0_12px_28px_rgba(0,0,0,0.5)]',
    cardBorderHover: 'hover:border-[#3c6e71] hover:shadow-[0_4px_20px_rgba(60,110,113,0.2)]',
    cardSelected: 'ring-2 ring-[#3c6e71] border-[#3c6e71] shadow-[0_8px_30px_rgba(60,110,113,0.25)]',
    headerText: 'text-white',
    bodyText: 'text-[#d9d9d9]',
    subText: 'text-[#d9d9d9]/60',
    panelBg: 'bg-[#353535]/95 backdrop-blur-md border-[#3c6e71]/30 shadow-[0_8px_32px_rgba(0,0,0,0.7)]',
    toolHover: 'hover:bg-[#3c6e71]/20 text-[#d9d9d9] hover:text-white',
    tagBg: 'bg-[#3c6e71]/20 text-[#3c6e71]',
    connectorStroke: '#d9d9d9',
    connectorActive: '#3c6e71'
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
