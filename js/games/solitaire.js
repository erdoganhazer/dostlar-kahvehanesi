// Solitaire (Klondike): 7 sütun (1..7 kart, en üstteki açık), 4 temel, deste. Kurallar: docs/SOLITAIRE-KURALLARI.md
// Desteden 1 ya da 3 kart açılır (ayar), deste bitince açıklar ters çevrilip yeniden kullanılır (sınırsız).
// Masada: kırmızı-siyah sırayla azalan dizi; boş sütuna yalnız papaz. Temel: aynı renk, astan papaza.
import { makeDeck, suitOf, rankOf, red, withUndo } from './sol-common.js';

const top = (a) => a[a.length - 1];

function canStack(c, onto) {
  return red(c) !== red(onto) && rankOf(c) === rankOf(onto) - 1;
}
function canFound(c, pile) {
  return pile.length ? suitOf(top(pile)) === suitOf(c) && rankOf(c) === rankOf(top(pile)) + 1 : rankOf(c) === 1;
}

const base = {
  id: 'solitaire',
  name: 'Solitaire',
  createInitialState(config, rng) {
    const deck = rng.shuffle(makeDeck());
    const t = [];
    let k = 0;
    for (let i = 0; i < 7; i++) {
      const col = [];
      for (let j = 0; j <= i; j++) col.push({ c: deck[k++], up: j === i });
      t.push(col);
    }
    return { t, f: [[], [], [], []], s: deck.slice(k), w: [], draw: config.draw === 3 ? 3 : 1, passes: 0, won: false, moves: 0 };
  },
  legalMoves(s) {
    const out = [];
    if (s.s.length || s.w.length) out.push({ t: 'draw' });
    const srcs = [];
    if (s.w.length) srcs.push(['w', [top(s.w)]]);
    s.t.forEach((col, i) => {
      const first = col.findIndex((x) => x.up);
      if (first < 0) return;
      for (let j = first; j < col.length; j++) srcs.push([`t${i}`, col.slice(j).map((x) => x.c)]);
    });
    s.f.forEach((p, i) => p.length && srcs.push([`f${i}`, [top(p)]]));
    for (const [from, cards] of srcs) {
      const c = cards[0];
      if (cards.length === 1 && from[0] !== 'f') s.f.forEach((p, i) => canFound(c, p) && out.push({ t: 'mv', from, to: `f${i}`, n: 1 }));
      s.t.forEach((col, i) => {
        const to = `t${i}`;
        if (to === from) return;
        if (col.length ? canStack(c, top(col).c) : rankOf(c) === 13) {
          // boş sütundan boş sütuna papaz taşımak anlamsız
          if (!col.length && from[0] === 't' && s.t[+from.slice(1)].length === cards.length && !s.t[+from.slice(1)].some((x) => !x.up)) return;
          out.push({ t: 'mv', from, to, n: cards.length });
        }
      });
    }
    return out;
  },
  viewFor(s) {
    return { ...s, t: s.t.map((col) => col.map((x) => (x.up ? x : { c: null, up: false }))), s: s.s.map(() => null), hist: undefined };
  },
  applyMove(s0, seat, m) {
    const s = JSON.parse(JSON.stringify(s0));
    if (m.t === 'draw') {
      if (!s.s.length) {
        s.s = s.w.reverse();
        s.w = [];
        s.passes++;
      } else {
        const n = Math.min(s.draw, s.s.length);
        s.w.push(...s.s.splice(0, n));
      }
      return s;
    }
    let cards;
    if (m.from === 'w') cards = [s.w.pop()];
    else if (m.from[0] === 'f') cards = [s.f[+m.from.slice(1)].pop()];
    else {
      const col = s.t[+m.from.slice(1)];
      cards = col.splice(col.length - m.n, m.n).map((x) => x.c);
      if (col.length && !top(col).up) top(col).up = true;
    }
    if (m.to[0] === 'f') s.f[+m.to.slice(1)].push(...cards);
    else s.t[+m.to.slice(1)].push(...cards.map((c) => ({ c, up: true })));
    s.won = s.f.every((p) => p.length === 13);
    return s;
  },
  scores: (s) => [s.f.reduce((t, p) => t + p.length, 0)],
  // İpucu / öneri puanı
  rateMove(v, m) {
    if (m.t === 'undo') return -50;
    if (m.t === 'resign') return -100;
    if (m.t === 'draw') return v.s.length ? 1 : v.w.length ? -2 : -9;
    if (m.to[0] === 'f') return 30 - (m.from === 'w' ? 0 : 1) + (m.from[0] === 't' ? revealGain(v, m) : 0);
    if (m.from[0] === 'f') return -20;
    let r = 5;
    if (m.from[0] === 't') {
      r += revealGain(v, m);
      const col = v.t[+m.from.slice(1)];
      // tüm açık diziyi taşıyıp altındaki kapalıyı açmak iyi; aynı yerde gidip gelmek kötü
      if (col.length === m.n && !v.t[+m.to.slice(1)].length) r -= 15;
      if (col.length - m.n > 0 && col[col.length - m.n - 1].up) r -= 6;
    }
    if (m.from === 'w') r += 4;
    return r;
  },
};
function revealGain(v, m) {
  if (m.from[0] !== 't') return 0;
  const col = v.t[+m.from.slice(1)];
  const rest = col.length - m.n;
  if (rest === 0) return 4;
  return col[rest - 1].up ? 0 : 12 + col.slice(0, rest).filter((x) => !x.up).length;
}

export default withUndo(base);
