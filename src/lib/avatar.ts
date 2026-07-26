export const getInitials = (name: string) => {
  return (name || '')
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Fixed palette from user's image (6x6 grid, left-to-right, top-to-bottom)
export const AVATAR_PALETTE: string[] = [
  '#FFFFFF', '#FFFFCC', '#FFFF99', '#FFFF66', '#FFFF33', '#FFFF00',
  '#FFCCFF', '#FFCCCC', '#FFCC99', '#FFCC66', '#FFCC33', '#FFCC00',
  '#FF99FF', '#FF99CC', '#FF9999', '#FF9966', '#FF9933', '#FF9900',
  '#FF66FF', '#FF66CC', '#FF6699', '#FF6666', '#FF6633', '#FF6600',
  '#FF33FF', '#FF33CC', '#FF3399', '#FF3366', '#FF3333', '#FF3300',
  '#FF00FF', '#FF00CC', '#FF0099', '#FF0066', '#FF0033', '#FF0000',
  // Pastel palette 1
  '#E3EFD2', '#D6ECE8', '#D6F7F7', '#EED2E5', '#FBD8D4',
  // Teal palette
  '#C8E6E2', '#9ED5D1', '#63C1BB', '#3A9295', '#105F68',
  // Light teal palette
  '#DFF1F5', '#C5E6EF', '#A7DAE2', '#76C8CA', '#54A8AE',
  // Warm palette
  '#F5CEC7', '#E79796', '#FFC98B', '#FFB284', '#C6C09C',
  // Purple palette
  '#F0EEF7', '#E1D8EB', '#C8B8DC', '#A193C6', '#7C71B2',
  // Pastel #1 extras
  '#CDB4DB', '#FFC8DD', '#FFAFCC', '#BDE0FE', '#A2D2FF',
  // Green palette
  '#D9E8D8', '#CDE5CB', '#B7DBB4', '#A7D5AA', '#79C175',
];

// Allow runtime override (e.g., to add more palettes later without code changes)
const DEFAULT_EXCLUDED = new Set<string>([
  // Magenta/Pink family
  '#FF33FF','#FF33CC','#FF3399','#FF00FF','#FF00CC','#FF0099',
  '#FFCCCC','#FF99CC','#FFCCFF',
  // Purple set
  '#F0EEF7','#E1D8EB','#C8B8DC','#A193C6','#7C71B2',
  // Pastel extras with pink/purple
  '#CDB4DB','#FFC8DD','#FFAFCC',
]);

let currentPalette: string[] = AVATAR_PALETTE.filter(c => !DEFAULT_EXCLUDED.has(c.toUpperCase()));
export const setAvatarPalette = (palette: string[]) => {
  if (Array.isArray(palette) && palette.length > 0) {
    const uniq = Array.from(new Set(palette.map((c) => c.toUpperCase())));
    currentPalette = uniq.filter(c => !DEFAULT_EXCLUDED.has(c));
    try { localStorage.setItem('avatar_palette', JSON.stringify(currentPalette)); } catch {}
  }
};
export const setAvatarExclusions = (hexList: string[]) => {
  const ex = new Set(hexList.map(h => h.toUpperCase()));
  currentPalette = AVATAR_PALETTE.filter(c => !ex.has(c.toUpperCase()));
  try { localStorage.setItem('avatar_palette', JSON.stringify(currentPalette)); } catch {}
};
// Load saved custom palette if present
try {
  const saved = localStorage.getItem('avatar_palette');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) currentPalette = parsed;
  }
} catch {}

const hexToRgb = (hex: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
};

const contrastText = (bgHex: string) => {
  const { r, g, b } = hexToRgb(bgHex);
  // Perceived luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance > 186 ? '#1f2937' /* slate-800 */ : '#ffffff';
};

const clamp = (n: number, min = 0, max = 255) => Math.max(min, Math.min(max, n));
const adjustHex = (hex: string, amt: number) => {
  const { r, g, b } = hexToRgb(hex);
  const rr = clamp(r + amt);
  const gg = clamp(g + amt);
  const bb = clamp(b + amt);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`.toUpperCase();
};

const colorFromPaletteIndex = (idx: number) => {
  const bg = currentPalette[((idx % currentPalette.length) + currentPalette.length) % currentPalette.length];
  const fg = contrastText(bg);
  // subtle top-to-bottom gradient: lighter -> base
  const light = adjustHex(bg, 18);
  const bgCss = `linear-gradient(180deg, ${light} 0%, ${bg} 100%)`;
  return { bg, fg, bgCss } as { bg: string; fg: string; bgCss: string };
};

const indexFromSeed = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash);
};

export const avatarColors = (userId?: string | null, name?: string | null) => {
  const seed = userId && userId.length > 0 ? userId : (name || 'U');
  const idx = indexFromSeed(seed) % currentPalette.length;
  return colorFromPaletteIndex(idx);
};

// Stable per-group color: ensures the same member has the same color within a group
export const avatarColorsGroup = (
  groupId?: string | null,
  userId?: string | null,
  name?: string | null
) => {
  const part = userId && userId.length > 0 ? userId : (name || 'U');
  const seed = `${groupId || 'G'}|${part}`;
  const idx = indexFromSeed(seed) % currentPalette.length;
  return colorFromPaletteIndex(idx);
};

// Build a unique color map for a set of user IDs within a group.
// Deterministic: sort userIds, then assign hues by hashing each id.
// If a collision occurs (same hue), advance by golden-angle until free.
export const buildGroupColorMap = (userIds: string[]) => {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const proposals = new Map<string, number>();
  const buckets = new Map<number, string[]>();
  ids.forEach((uid) => {
    const idx = indexFromSeed(uid) % currentPalette.length;
    proposals.set(uid, idx);
    const arr = buckets.get(idx) || [];
    arr.push(uid);
    buckets.set(idx, arr);
  });
  // resolve collisions deterministically on the palette indices
  const used = new Set<number>();
  const map: Record<string, { bg: string; fg: string }> = {};
  Array.from(buckets.entries()).forEach(([idx, uids]) => {
    uids.sort();
    let probe = 0;
    uids.forEach((uid) => {
      let slot = (idx + probe) % currentPalette.length;
      // linear probing to find a free palette index
      let guard = 0;
      while (used.has(slot) && guard < currentPalette.length) {
        slot = (slot + 1) % currentPalette.length;
        guard++;
      }
      used.add(slot);
      map[uid] = colorFromPaletteIndex(slot);
      probe++;
    });
  });
  return map;
};
