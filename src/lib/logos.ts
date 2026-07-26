// Remote team logo utilities
// Set VITE_TEAM_LOGO_BASE to a public CDN base (e.g., Cloudinary folder, GitHub raw, S3)
// Example: VITE_TEAM_LOGO_BASE=https://raw.githubusercontent.com/<user>/<repo>/main/premier-logos

const BASE = (import.meta as any).env?.VITE_TEAM_LOGO_BASE || '';

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const aliases: Record<string, string[]> = {
  'Manchester City': ['manchester-city', 'man-city', 'mancity', 'manchester_city'],
  'Manchester United': ['manchester-united', 'manutd', 'man-united'],
  'Tottenham Hotspur': ['tottenham-hotspur', 'tottenham', 'spurs'],
  'Newcastle United': ['newcastle-united', 'newcastle'],
  'Brighton & Hove Albion': ['brighton-and-hove-albion', 'brighton'],
  'Wolverhampton Wanderers': ['wolverhampton-wanderers', 'wolverhampton', 'wolves'],
  'AFC Bournemouth': ['afc-bournemouth', 'bournemouth'],
  'Leeds United': ['leeds-united', 'leeds'],
  'West Ham United': ['west-ham-united', 'west-ham'],
};

const exts = ['.png', '.svg', '.webp', '.jpg', '.jpeg'];

// Explicit overrides (highest priority) provided by the user
const TEAM_URLS: Record<string, string[]> = {
  'Arsenal': [
    'https://brandlogos.net/wp-content/uploads/2015/10/arsenal_fc-logo_brandlogos.net_kae1j.png',
  ],
  'Chelsea': [
    'https://brandlogos.net/wp-content/uploads/2025/02/chelsea_fc-logo_brandlogos.net_jrklu.png',
  ],
  'Manchester United': [
    'https://brandlogos.net/wp-content/uploads/2014/12/manchester_united_f.c.-logo_brandlogos.net_6znjs-1509x1536.png',
  ],
  'Tottenham Hotspur': [
    'https://upload.wikimedia.org/wikipedia/fr/7/7b/Logo_Tottenham_Hotspur_Football_Club_2024.svg',
  ],
  'Newcastle United': [
    'https://brandlogos.net/wp-content/uploads/2025/02/newcastle_united_fc-logo_brandlogos.net_ypslm.png',
  ],
  'Crystal Palace': [
    'https://brandlogos.net/wp-content/uploads/2016/05/crystal_palace_fc-logo_brandlogos.net_asddi.png',
  ],
  'AFC Bournemouth': [
    'https://brandlogos.net/wp-content/uploads/2016/02/AFC-Bournemouth-crest.png',
  ],
  'West Ham United': [
    'https://brandlogos.net/wp-content/uploads/2016/11/west_ham_united_fc-logo_brandlogos.net_9umrl.png',
  ],
  'Liverpool': [
    'https://brandlogos.net/wp-content/uploads/2025/02/liverpool_f.c.-logo_brandlogos.net_vr9dx.png',
  ],
  'Sunderland': [
    'https://brandlogos.net/wp-content/uploads/2014/10/sunderland_afc-logo_brandlogos.net_ddmyr.png',
  ],
  'Brighton & Hove Albion': [
    'https://brandlogos.net/wp-content/uploads/2021/11/Brighton-fc-logo.png',
  ],
  'Leeds United': [
    'https://brandlogos.net/wp-content/uploads/2020/11/Leeds-United-FC-logo-1.png',
  ],
  'Wolverhampton Wanderers': [
    'https://brandlogos.net/wp-content/uploads/2014/11/Wolverhampton-Wanderers-FC-crest.png',
  ],
  'Nottingham Forest': [
    'https://brandlogos.net/wp-content/uploads/2022/03/Nottingham-Forest-FC-crest.png',
  ],
  'Aston Villa': [
    'https://brandlogos.net/wp-content/uploads/2025/02/aston_villa_fc-logo_brandlogos.net_9duqy.png',
  ],
  'Burnley': [
    'https://brandlogos.net/wp-content/uploads/2023/07/burnley_fc-logo_brandlogos.net_vh9ys.png',
  ],
  'Manchester City': [
    'https://brandlogos.net/wp-content/uploads/2017/05/Manchester-City-FC-logo-1.png',
  ],
  'Fulham': [
    'https://brandlogos.net/wp-content/uploads/2014/10/fulham-fc-logo.png',
  ],
  'Everton': [
    'https://brandlogos.net/wp-content/uploads/2016/11/everton_fc-logo_brandlogos.net_wuxl3.png',
  ],
  'Brentford': [
    'https://brandlogos.net/wp-content/uploads/2021/08/Brentford-FC.png',
  ],
  'Coventry City': [
    '/logos/coventry.png',
  ],
  'Ipswich Town': [
    '/logos/ipswich.png',
  ],
  'Hull City': [
    '/logos/hull.png',
  ],
};

export const remoteLogoCandidates = (team?: string): string[] => {
  if (!team) return [];
  const s = slugify(team);
  const a = aliases[team] || [];
  const bases = Array.from(new Set([...a, s]));
  const urls: string[] = [];

  // 0) Explicit user-provided URLs first
  if (TEAM_URLS[team]) urls.push(...TEAM_URLS[team]);

  // 1) User-provided CDN base
  if (BASE) {
    for (const b of bases) for (const ext of exts) urls.push(`${BASE.replace(/\/$/, '')}/${b}${ext}`);
  }

  return urls;
};

export const getCachedLogo = (team: string) => {
  try {
    // If explicit TEAM_URLS exist, ignore any old broken localStorage cache
    if (TEAM_URLS[team]) return undefined;
    const k = `teamlogo:${team}`;
    return localStorage.getItem(k) || undefined;
  } catch { return undefined; }
};

export const setCachedLogo = (team: string, url: string) => {
  try {
    const k = `teamlogo:${team}`;
    localStorage.setItem(k, url);
  } catch {}
};
