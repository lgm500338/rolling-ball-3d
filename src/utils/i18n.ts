export type Lang = 'ko' | 'en' | 'es';

export const LANGS: { id: Lang; label: string; title: string }[] = [
  { id: 'ko', label: '한국어', title: '한국어' },
  { id: 'en', label: 'EN', title: 'English' },
  { id: 'es', label: 'ES', title: 'Español' },
];

const KEY = 'rolling-ball-3d:lang';

export function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ko' || saved === 'en' || saved === 'es') return saved;
  } catch {
    // storage unavailable
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  const n = nav.toLowerCase();
  if (n.startsWith('es')) return 'es';
  return n.startsWith('en') ? 'en' : 'ko';
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // ignore
  }
}
