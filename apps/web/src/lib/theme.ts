export type ThemeId = 'deep-space' | 'ocean' | 'light';

export const THEMES: ReadonlyArray<{
  id: ThemeId;
  name: string;
  description: string;
  gradient: string;
  accent: string;
  surface: string;
  border: string;
}> = [
  {
    id: 'deep-space',
    name: 'Deep Space',
    description: 'Classic dark purple',
    gradient: 'linear-gradient(135deg,#0e0529,#1c0b42,#2a1165)',
    accent: '#a78bfa',
    surface: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.09)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep navy & cyan',
    gradient: 'linear-gradient(135deg,#061525,#0b1e3d,#061828)',
    accent: '#38bdf8',
    surface: 'rgba(255,255,255,0.07)',
    border: 'rgba(56,189,248,0.12)',
  },
  {
    id: 'light',
    name: 'Daylight',
    description: 'Clean soft lavender',
    gradient: 'linear-gradient(135deg,#faf9ff,#ede9fe,#f5f3ff)',
    accent: '#7c3aed',
    surface: 'rgba(255,255,255,0.82)',
    border: 'rgba(124,58,237,0.12)',
  },
];

export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return 'deep-space';
  try {
    const v = localStorage.getItem('pss-theme') as ThemeId;
    if (v === 'ocean' || v === 'light') return v;
  } catch {}
  return 'deep-space';
}

export function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', id);
  try { localStorage.setItem('pss-theme', id); } catch {}
}
