// Kart çizimi: renk işaretleri ve resimli kart amblemleri SVG (her cihazda aynı görünür, emojiye dönüşmez).
// Kart yüzü: sol üstte büyük sayı/harf ve hemen altında küçük renk (üst üste binince ikisi birlikte görünür),
// ortada büyük renk ya da resimli kartta amblem (papaz: sivri taç, kız: incili taç, vale: kalkan).
// Renkler CSS'te (.card.face, .four ile dört renkli deste). Arkalık: bordo-altın desen ve "KS" amblemi.

const V = 'viewBox="0 0 100 100" aria-hidden="true" focusable="false"';
export const SUIT_SVG = {
  H: `<svg ${V}><path fill="currentColor" d="M50 90C22 68 5 52 5 31 5 16 16 6 29 6c9 0 16 5 21 13 5-8 12-13 21-13 13 0 24 10 24 25 0 21-17 37-45 59z"/></svg>`,
  D: `<svg ${V}><path fill="currentColor" d="M50 3C60 20 74 37 90 50 74 63 60 80 50 97 40 80 26 63 10 50 26 37 40 20 50 3z"/></svg>`,
  S: `<svg ${V}><path fill="currentColor" d="M50 4C62 24 94 38 94 61c0 14-10 23-22 23-8 0-15-4-19-10 1 9 5 16 13 22H34c8-6 12-13 13-22-4 6-11 10-19 10C16 84 6 75 6 61 6 38 38 24 50 4z"/></svg>`,
  C: `<svg ${V}><g fill="currentColor"><circle cx="50" cy="28" r="20"/><circle cx="27" cy="60" r="20"/><circle cx="73" cy="60" r="20"/><path d="M44 50h12c0 20 4 34 13 46H31c9-12 13-26 13-46z"/></g></svg>`,
};
const EMBLEM = {
  13: `<svg ${V}><g fill="currentColor"><path d="M10 80 18 32l18 22 14-34 14 34 18-22 8 48z"/><rect x="10" y="83" width="80" height="10" rx="2"/><circle cx="18" cy="28" r="5"/><circle cx="82" cy="28" r="5"/><path d="M47 4h6v8h7v6h-7v6h-6v-6h-7v-6h7z"/></g></svg>`,
  12: `<svg ${V}><g fill="currentColor"><path d="M12 82c4-16 6-30 6-44l16 20 16-30 16 30 16-20c0 14 2 28 6 44z"/><rect x="12" y="85" width="76" height="8" rx="4"/><circle cx="18" cy="32" r="6"/><circle cx="50" cy="22" r="7"/><circle cx="82" cy="32" r="6"/></g></svg>`,
  11: `<svg ${V}><g fill="currentColor"><path d="M50 6 88 18v30c0 24-17 40-38 48C29 88 12 72 12 48V18z"/></g><path d="M50 22v60M30 40h40" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"/></svg>`,
};
const RANK_TXT = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J' };

function span(cls, html) {
  const s = document.createElement('span');
  s.className = cls;
  if (html) s.innerHTML = html;
  return s;
}

/** Kart yüzü öğesi. opts.four: dört renkli deste */
export function cardFace(card, { four = false } = {}) {
  const r = RANK_TXT[card.rank] ?? String(card.rank);
  const red = card.suit === 'H' || card.suit === 'D';
  const face = card.rank >= 11 && card.rank <= 13;
  const el = span(`card face s-${card.suit}${red ? ' red' : ''}${four ? ' four' : ''}${face ? ' court' : ''}`);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${{ S: '♠', H: '♥', D: '♦', C: '♣' }[card.suit]}${r}`);
  const idx = span('ix');
  const rank = span(`fr${r.length > 1 ? ' two' : ''}`);
  rank.textContent = r;
  idx.append(rank, span('fs', SUIT_SVG[card.suit]));
  el.append(idx, span(face ? 'fc em' : 'fc', face ? EMBLEM[card.rank] : SUIT_SVG[card.suit]));
  if (face) el.append(span('fsm', SUIT_SVG[card.suit]));
  return el;
}

/** Kart arkası. photo: veri adresi verilirse fotoğraf arkalık (krem çerçeveli) */
export function cardBack(photo = '') {
  if (photo) {
    const el = span('card back photo');
    el.style.backgroundImage = `url("${photo}")`;
    return el;
  }
  const el = span('card back');
  const m = span('bk');
  m.textContent = 'KS';
  el.append(m);
  return el;
}

/** Joker */
export function cardJoker() {
  const el = span('card face joker');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Joker');
  const t = span('jk');
  t.textContent = 'JOKER';
  el.append(t, span('fc em', EMBLEM[13]));
  return el;
}
