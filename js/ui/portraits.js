// Kahvehane karakterlerinin çizim portreleri (96×96 SVG). Fotoğraf değil, tip çizimi.
// a1 Sezai: kel, yanlarda kısa saç, gür kara bıyık, ciddi bakış, lacivert ceket.
// a2 Kartal: ense boyu gür kıvırcık kara saç, kalın sarkık bıyık, ince yüz, ciddi bakış, siyah tişört.
// a3 Hilmi: geriye taranmış parlak kara saç, geniş dolgun yüz, iri burun, ağır göz kapakları, kürk yakalı palto.
// a4 Şerif (yancı): kabarık kıvırcık bembeyaz saç, kocaman beyaz pala bıyık ve favori, ciddi bakış, haki kamuflaj ceket.
// Ortak iskelet face(); her karakter saçını, bıyığını, ağzını, giysisini kendisi verir.

const uid = (() => {
  let n = 0;
  return (k) => `${k}${++n}`;
})();

/** Ortak yüz iskeleti. o: { skin, shade, bg1, bg2, jaw (yüz genişliği), eyes, brows, mouth, nose, back, front, cloth, cheeks } */
function face(o) {
  const g = uid('p');
  const jaw = o.jaw ?? 0; // 0 normal, + geniş/dolgun, − ince
  const w = 20 + jaw;
  const head = `M${48 - w} 46 C${48 - w} 28 ${48 - w + 7} 19 48 19 C${48 + w - 7} 19 ${48 + w} 28 ${48 + w} 46 C${48 + w} 61 ${48 + w * 0.55} 73 48 74 C${48 - w * 0.55} 73 ${48 - w} 61 ${48 - w} 46 Z`;
  return `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs>
<radialGradient id="${g}b" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${o.bg1}"/><stop offset="1" stop-color="${o.bg2}"/></radialGradient>
<radialGradient id="${g}s" cx="42%" cy="40%" r="70%"><stop offset="0" stop-color="${o.skin}"/><stop offset=".75" stop-color="${o.skin}"/><stop offset="1" stop-color="${o.shade}"/></radialGradient>
</defs>
<rect width="96" height="96" fill="url(#${g}b)"/>
<g transform="translate(48 58) scale(1.14) translate(-48 -56)">
${o.back || ''}
<path d="M40 66 L56 66 L57 80 L39 80 Z" fill="${o.shade}"/>
${o.cloth}
<ellipse cx="${48 - w + 0.5}" cy="49" rx="4" ry="6.5" fill="${o.shade}"/><ellipse cx="${48 + w - 0.5}" cy="49" rx="4" ry="6.5" fill="${o.shade}"/>
<path d="${head}" fill="url(#${g}s)"/>
${o.cheeks ? `<ellipse cx="36" cy="57" rx="5" ry="3" fill="#d9776a" opacity=".28"/><ellipse cx="60" cy="57" rx="5" ry="3" fill="#d9776a" opacity=".28"/>` : ''}
${o.eyes}
${o.brows}
${o.nose ?? `<path d="M48 47 C46 52 44 55 45.5 57.5 C47 58.5 49 58.5 50.5 57.5" fill="none" stroke="${o.shade}" stroke-width="1.6" stroke-linecap="round"/>`}
${o.mouth}
${o.front || ''}
</g>
</svg>`;
}

/** Gözler: açıklık (h), iris rengi, göz kapağı ağırlığı (lid), bakış yönü (dx) */
function eyes({ y = 46, h = 3.2, iris = '#3a2416', lid = 0, dx = 0, squint = false, gap = 9 }) {
  const one = (cx) => squint
    ? `<path d="M${cx - 5} ${y + 0.5} Q${cx} ${y - 3.5} ${cx + 5} ${y + 0.5}" fill="none" stroke="#2a1a12" stroke-width="2" stroke-linecap="round"/>`
    : `<ellipse cx="${cx}" cy="${y}" rx="4.6" ry="${h}" fill="#fbf7f0"/><circle cx="${cx + dx}" cy="${y + 0.2}" r="${Math.min(2.6, h)}" fill="${iris}"/><circle cx="${cx + dx}" cy="${y + 0.2}" r="1.2" fill="#111"/><circle cx="${cx + dx + 0.9}" cy="${y - 0.8}" r=".7" fill="#fff"/>` +
      (lid ? `<path d="M${cx - 5} ${y - h + lid} Q${cx} ${y - h - 1.5 + lid} ${cx + 5} ${y - h + lid} L${cx + 5} ${y - h - 3} L${cx - 5} ${y - h - 3} Z" fill="var(--lid)"/>` : '') +
      `<path d="M${cx - 5} ${y - 0.3} Q${cx} ${y - h - 1.6} ${cx + 5} ${y - 0.3}" fill="none" stroke="#2a1a12" stroke-width="1.3"/>`;
  return one(48 - gap) + one(48 + gap);
}


/** Kıvırcık saç: her nokta bir bukle (daire + içinde kıvrım çizgisi) */
function curls(pts, fill, line) {
  return pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('') +
    pts.map(([x, y, r]) => `<path d="M${x - r * 0.55} ${y + r * 0.1} a${r * 0.5} ${r * 0.5} 0 1 1 ${r * 0.6} ${r * 0.45}" fill="none" stroke="${line}" stroke-width="${Math.max(0.8, r * 0.18)}" stroke-linecap="round"/>`).join('');
}
// başın çevresinde bukle halkası: merkez (cx,cy), yarıçap R, açı aralığı (derece), adet, bukle boyu
const ring = (cx, cy, R, a0, a1, n, r) => Array.from({ length: n }, (_, k) => {
  const a = ((a0 + ((a1 - a0) * k) / (n - 1)) * Math.PI) / 180;
  return [+(cx + R * Math.cos(a)).toFixed(1), +(cy + R * Math.sin(a)).toFixed(1), r + ((k * 7) % 3) * 0.6];
});

const brow = (d, color, wd = 2.8) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${wd}" stroke-linecap="round"/>`;

const LOOKS = {
  // Sezai
  a1: () => {
    const skin = '#e2a982';
    const shade = '#b97c58';
    const hair = '#2a1b14';
    return face({
      skin, shade, bg1: '#a3402c', bg2: '#5a160c', jaw: 1, cheeks: false,
      cloth: `<path d="M8 96 C10 80 24 72 40 70 L48 82 L56 70 C72 72 86 80 88 96 Z" fill="#1d2b48"/><path d="M40 70 L48 82 L44 96 L34 96 Z M56 70 L48 82 L52 96 L62 96 Z" fill="#162238"/><path d="M41 70 L48 80 L55 70 L52 69 L48 74 L44 69 Z" fill="#202020"/>`,
      back: '',
      eyes: eyes({ y: 46.5, h: 2.8, iris: '#2e1d12', gap: 9 }),
      brows: brow('M33 39 Q38 35.5 44 38', hair, 2.6) + brow('M52 38 Q58 35.5 63 39', hair, 2.6),
      mouth: `<path d="M42 63.5 Q48 62.8 54 63.5" stroke="#6b2f22" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
        `<path d="M32 58.5 C36 53 42 53 48 56 C54 53 60 53 64 58.5 C61 57.5 57 57.6 53 59 C51 59.5 49.5 59 48 58.2 C46.5 59 45 59.5 43 59 C39 57.6 35 57.5 32 58.5 Z" fill="${hair}"/>`,
      front: `<path d="M27.5 50 C26.5 44 27 38 29 34 C30 39 31 43 31.5 48 Z M68.5 50 C69.5 44 69 38 67 34 C66 39 65 43 64.5 48 Z" fill="#3a2e28"/><path d="M36 24 Q48 19 60 24" stroke="#f3c9a8" stroke-width="2" fill="none" opacity=".55"/>`,
    });
  },
  // Kartal
  a2: () => {
    const skin = '#d9a27c';
    const shade = '#a8704e';
    const hair = '#171010';
    return face({
      skin, shade, bg1: '#3c6b5a', bg2: '#163028', jaw: -2,
      // ense boyu gür kıvırcık saç (örgü yok)
      back: `<path d="M24 50 C18 32 26 14 47 14 C68 13 78 32 72 50 L70 64 L26 64 Z" fill="${hair}"/>` +
        curls([...ring(48, 40, 25, 150, 390, 15, 5.2), [25, 58, 5], [71, 58, 5], [27, 65, 4.5], [69, 65, 4.5]], hair, '#3d2b27'),
      cloth: `<path d="M10 96 C12 80 26 73 40 72 Q48 78 56 72 C70 73 84 80 86 96 Z" fill="#1c1c1e"/><path d="M40 72 Q48 79 56 72" stroke="#2e2e30" stroke-width="2" fill="none"/>`,
      eyes: eyes({ y: 46.5, h: 2.6, iris: '#3b2414', gap: 8.5 }),
      brows: brow('M33 41 Q38 38.5 44 40.5', hair, 3.2) + brow('M52 40.5 Q58 38.5 63 41', hair, 3.2),
      mouth: `<path d="M33 60 C34 68 40 73 48 73.5 C56 73 62 68 63 60 C60 66 55 69 48 69.5 C41 69 36 66 33 60 Z" fill="#2a1d18" opacity=".22"/><path d="M43 64.5 Q48 63.5 53 64.5" stroke="#6b2f22" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
        `<path d="M48 57 C44 56 38 56.5 36.5 60 C35.5 63 35.5 67 36.2 70 C37.8 66 39 63 41.5 61.5 C44 60.5 46 61 48 61.6 C50 61 52 60.5 54.5 61.5 C57 63 58.2 66 59.8 70 C60.5 67 60.5 63 59.5 60 C58 56.5 52 56 48 57 Z" fill="${hair}"/>` +
        `<circle cx="60" cy="51" r=".9" fill="#5a3322"/>`,
      front: `<path d="M28 42 C27 27 36 19 48 19 C60 19 69 27 68 42 C64 33 56 29 48 29 C40 29 32 33 28 42 Z" fill="${hair}"/>` + curls([[31, 34, 4.6], [36, 28.5, 5], [43, 25.5, 5.2], [50, 25, 5], [57, 26.5, 5.2], [63, 30.5, 4.8], [67, 37, 4.2], [29.5, 41, 3.6]], hair, '#3d2b27'),
    });
  },
  // Hilmi: geniş yuvarlak yüz, dolgun yanaklar, ağır göz kapakları, kalın kaşlar, iri burun, geriye taranmış
  // parlak kara saç (yanları kısa), çift çene; kahverengi kabarık kürk yaka, kırmızı çizgili gömlek
  a3: () => {
    const skin = '#dfa27c';
    const shade = '#b0714c';
    const hair = '#16130f';
    const fur = '#7b5636';
    const furL = '#a9805a';
    return face({
      skin, shade, bg1: '#d8d3c8', bg2: '#8f8a80', jaw: 4,
      back: `<path d="M24 46 C22 30 32 15 49 15 C65 15 75 28 72 46 L69 40 L27 40 Z" fill="${hair}"/>`,
      cloth: `<path d="M6 96 C8 82 22 74 38 72 L48 79 L58 72 C74 74 88 82 90 96 Z" fill="#7a2418"/>` +
        `<path d="M40 74 L46 96 M46 76 L50 96 M52 76 L54 96 M57 74 L59 96" stroke="#c0462e" stroke-width="1.6" opacity=".8"/><path d="M38 72 L48 80 L44 84 Z M58 72 L48 80 L52 84 Z" fill="#5e1a10"/>` +
        curls([[10, 92, 6], [14, 84, 6.5], [20, 78, 6.5], [27, 74, 6], [33, 73, 5], [18, 92, 5.5], [26, 86, 5.5], [32, 80, 5],
          [86, 92, 6], [82, 84, 6.5], [76, 78, 6.5], [69, 74, 6], [63, 73, 5], [78, 92, 5.5], [70, 86, 5.5], [64, 80, 5]], fur, furL),
      eyes: eyes({ y: 47.5, h: 2.4, iris: '#2b1b12', gap: 9.5 }) +
        `<path d="M33 46 Q38.5 42.8 44 46 L44 44.6 Q38.5 41.5 33 44.6 Z M52 46 Q57.5 42.8 63 46 L63 44.6 Q57.5 41.5 52 44.6 Z" fill="${shade}"/>` +
        `<path d="M35 51.5 Q38.5 52.8 42 51.8 M54 51.8 Q57.5 52.8 61 51.5" stroke="${shade}" stroke-width=".9" fill="none" opacity=".5"/>`,
      brows: brow('M31.5 41 Q37 37.6 44.5 39.8', hair, 3.8) + brow('M51.5 39.8 Q59 37.6 64.5 41', hair, 3.8),
      nose: `<path d="M48 46 C46.5 51 44.5 54.5 45 57 M48 46 C49.5 51 51.5 54.5 51 57" stroke="${shade}" stroke-width="1.4" fill="none" opacity=".7"/>` +
        `<path d="M42.5 57 C42.5 54 45 53 48 53.5 C51 53 53.5 54 53.5 57 C53.5 59.5 50.5 60 48 59.6 C45.5 60 42.5 59.5 42.5 57 Z" fill="${shade}" opacity=".35"/><path d="M44 58.6 Q45.5 59.6 47 59 M49 59 Q50.5 59.6 52 58.6" stroke="#7a4430" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
      mouth: `<path d="M38 56 C36 60 37 63 39.5 65 M58 56 C60 60 59 63 56.5 65" stroke="${shade}" stroke-width="1.3" fill="none" opacity=".75"/>` +
        `<path d="M42 64.2 Q48 63 54 64.2" stroke="#7a2e22" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
        `<path d="M38 72.5 Q48 77 58 72.5" stroke="${shade}" stroke-width="1.4" fill="none" opacity=".75"/><path d="M33 62 C35 69 41 73.5 48 74 C55 73.5 61 69 63 62 C60 67 55 70 48 70.5 C41 70 36 67 33 62 Z" fill="#2a1d18" opacity=".12"/>`,
      front: `<path d="M25 45 C23.5 30 33 18 49 18 C64 18 73.5 29 71.5 45 C70 38 68 33 64 31 C58 28 52 27.5 46 28 C38 29 31 34 28 40 C27 41.5 26 43 25 45 Z" fill="${hair}"/>` +
        `<path d="M31 33 C39 25 52 23 63 27 M30 37 C38 30 51 28.5 62 30.5 M33 30 C41 23.5 52 22 60 23.5" stroke="#55555e" stroke-width="1.2" fill="none" opacity=".85"/>` +
        `<path d="M25 45 C24.5 49 25 52 26 54 L27.5 46 Z M71.5 45 C72 49 71.5 52 70.5 54 L69 46 Z" fill="${hair}"/>`,
    });
  },
  // Şerif (yancı)
  a4: () => {
    const skin = '#eeb79a';
    const shade = '#c4876a';
    const white = '#f1eee8';
    const whiteS = '#cfc9bf';
    return face({
      skin, shade, bg1: '#8a5a24', bg2: '#3e260c', jaw: 1, cheeks: false,
      back: `<path d="M21 50 C14 32 24 12 48 12 C72 12 82 32 75 50 L26 50 Z" fill="${white}"/>` +
        curls([...ring(48, 36, 27, 160, 380, 15, 6), [21, 48, 5.5], [75, 48, 5.5]], white, whiteS),
      cloth: `<path d="M8 96 C10 81 24 73 40 71 L48 79 L56 71 C72 73 86 81 88 96 Z" fill="#6f6a3e"/>` +
        `<path d="M16 88 q5 -4 9 0 q-4 4 -9 0z M30 82 q6 -3 9 1 q-5 3 -9 -1z M60 84 q5 -4 10 0 q-5 3 -10 0z M74 90 q5 -3 8 1 q-4 3 -8 -1z M22 94 q4 -2 7 1 M66 94 q4 -3 8 0" fill="#4e4a2a" stroke="#4e4a2a" stroke-width="1"/>` +
        `<path d="M41 71 L48 79 L55 71 L52 70 L48 74 L44 70 Z" fill="#2c5a73"/><path d="M44 72 l4 3 l4 -3" stroke="#e8e0c8" stroke-width=".8" fill="none"/>`,
      eyes: eyes({ y: 45.5, h: 3, iris: '#4a3626', gap: 9 }),
      brows: brow('M32 37 Q37 33 44 36', whiteS, 3.6) + brow('M52 36 Q59 33 64 37', whiteS, 3.6),
      nose: `<path d="M48 45 C45.5 51 43 55 45 58 C47 59.5 49.5 59.5 51.5 58" fill="none" stroke="${shade}" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="48" cy="56" rx="4" ry="3" fill="#e79f86" opacity=".6"/>`,
      mouth: `<path d="M44 67 Q48 66.4 52 67" stroke="#6b2a1e" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
        `<path d="M48 58.5 C43 57 37 57.5 33 61 C29 64.5 27 70 28.5 76 C30 72 32 68.5 36 66.5 C40 64.5 44 64 48 63.5 C52 64 56 64.5 60 66.5 C64 68.5 66 72 67.5 76 C69 70 67 64.5 63 61 C59 57.5 53 57 48 58.5 Z" fill="${white}"/>` +
        `<path d="M34 63 C38 61 43 61 47 62 M62 63 C58 61 53 61 49 62" stroke="${whiteS}" stroke-width="1" fill="none"/>`,
      front: `<path d="M26 42 C24 50 25 60 29 66 C30.5 60 30 52 30 46 Z M70 42 C72 50 71 60 67 66 C65.5 60 66 52 66 46 Z" fill="${white}"/>` +
        curls([[31, 30, 4.6], [37, 25.5, 5], [44, 23.5, 5], [51, 23.5, 5], [58, 25, 5], [64, 29, 4.6], [27.5, 37, 4], [68.5, 37, 4]], white, whiteS),
    });
  },
};

export const PORTRAITS = Object.keys(LOOKS);
export const portraitSvg = (key) => (LOOKS[key] ? LOOKS[key]() : null);
