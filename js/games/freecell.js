// FreeCell: 52 kart 8 sütuna açık dağıtılır (7,7,7,7,6,6,6,6). 4 boş hücre, 4 temel. Kurallar: docs/SOLITAIRE-KURALLARI.md
// Masada kırmızı-siyah sırayla azalan dizi; boş sütuna her kart. Birden çok kartı birlikte taşımak, boş hücre ve
// boş sütun sayısıyla sınırlı: (boş hücre + 1) × 2^(boş sütun). Bütün kartlar temele çıkınca kazanırsın.
import { makeDeck, suitOf, rankOf, red, withUndo } from './sol-common.js';

const top = (a) => a[a.length - 1];
const canStack = (c, onto) => red(c) !== red(onto) && rankOf(c) === rankOf(onto) - 1;
const canFound = (c, p) => (p.length ? suitOf(top(p)) === suitOf(c) && rankOf(c) === rankOf(top(p)) + 1 : rankOf(c) === 1);

/** Sütunun altındaki düzgün dizinin uzunluğu */
function runLen(col) {
  let n = col.length ? 1 : 0;
  for (let j = col.length - 1; j > 0 && canStack(col[j].c, col[j - 1].c); j--) n++;
  return n;
}

const base = {
  id: 'freecell',
  name: 'FreeCell',
  createInitialState(config, rng) {
    const deck = rng.shuffle(makeDeck());
    const t = Array.from({ length: 8 }, () => []);
    deck.forEach((c, k) => t[k % 8].push({ c, up: true }));
    return { t, c: [null, null, null, null], f: [[], [], [], []], won: false, moves: 0 };
  },
  legalMoves(s) {
    const out = [];
    const freeCells = s.c.filter((x) => !x).length;
    const emptyCols = s.t.filter((col) => !col.length).length;
    const firstFree = s.c.indexOf(null);
    const srcs = [];
    s.c.forEach((x, i) => x && srcs.push([`c${i}`, [x]]));
    s.t.forEach((col, i) => {
      const L = runLen(col);
      for (let n = 1; n <= L; n++) srcs.push([`t${i}`, col.slice(col.length - n).map((x) => x.c)]);
    });
    for (const [from, cards] of srcs) {
      const c = cards[0];
      if (cards.length === 1) {
        s.f.forEach((p, i) => canFound(c, p) && out.push({ t: 'mv', from, to: `f${i}`, n: 1 }));
        if (from[0] === 't' && firstFree >= 0) out.push({ t: 'mv', from, to: `c${firstFree}`, n: 1 });
      }
      let usedEmpty = false;
      s.t.forEach((col, i) => {
        const to = `t${i}`;
        if (to === from) return;
        if (col.length) {
          if (canStack(c, top(col).c) && cards.length <= (freeCells + 1) * 2 ** emptyCols) out.push({ t: 'mv', from, to, n: cards.length });
        } else if (!usedEmpty) {
          usedEmpty = true; // boş sütunların hepsi aynı: birine taşımak yeter
          const srcCol = from[0] === 't' ? s.t[+from.slice(1)] : null;
          if (srcCol && srcCol.length === cards.length) return; // bütün sütunu boş sütuna taşımak anlamsız
          if (cards.length <= (freeCells + 1) * 2 ** (emptyCols - 1)) out.push({ t: 'mv', from, to, n: cards.length });
        }
      });
    }
    return out;
  },
  viewFor: (s) => ({ ...s, hist: undefined }),
  applyMove(s0, seat, m) {
    const s = JSON.parse(JSON.stringify(s0));
    let cards;
    if (m.from[0] === 'c') {
      cards = [s.c[+m.from.slice(1)]];
      s.c[+m.from.slice(1)] = null;
    } else {
      const col = s.t[+m.from.slice(1)];
      cards = col.splice(col.length - m.n, m.n).map((x) => x.c);
    }
    const k = +m.to.slice(1);
    if (m.to[0] === 'f') s.f[k].push(cards[0]);
    else if (m.to[0] === 'c') s.c[k] = cards[0];
    else s.t[k].push(...cards.map((c) => ({ c, up: true })));
    s.won = s.f.every((p) => p.length === 13);
    return s;
  },
  scores: (s) => [s.f.reduce((t, p) => t + p.length, 0)],
  rateMove(v, m) {
    if (m.t === 'undo' || m.t === 'resign') return base.rate1(v, m);
    // bir adım ileri bak: bu hamleden sonra açılan en iyi hamlenin yarısı eklenir (kartlar açık, bilgi tam)
    const r = base.rate1(v, m);
    if (m.to[0] === 'f') return r;
    const nx = base.applyMove(v, 0, m);
    let best = 0;
    for (const m2 of base.legalMoves(nx)) {
      if (m2.from === m.to && m2.to === m.from) continue;
      best = Math.max(best, base.rate1(nx, m2));
    }
    return r + best * 0.5;
  },
  rate1(v, m) {
    if (m.t === 'undo') return -50;
    if (m.t === 'resign') return -100;
    const minF = Math.min(...v.f.map((p) => p.length));
    if (m.to[0] === 'f') {
      // küçük kartları hemen çıkar; büyükleri, karşı renkte daha küçükler masadayken bekletmek daha iyi olabilir
      return 40 - Math.max(0, v.f.reduce((a, p) => Math.max(a, p.length), 0) - minF);
    }
    let r = 0;
    const from = m.from[0] === 't' ? v.t[+m.from.slice(1)] : null;
    const to = m.to[0] === 't' ? v.t[+m.to.slice(1)] : null;
    if (m.from[0] === 'c') r += 14; // hücreyi boşalt
    if (from) {
      const rest = from.slice(0, from.length - m.n);
      if (!rest.length) r += 8; // sütun boşalır
      else {
        if (canStack(from[from.length - m.n].c, top(rest).c)) r -= 12; // zaten düzgün duruyordu
        // altta temele gidebilecek küçük kart açılıyor mu?
        const low = Math.min(...rest.map((x) => rankOf(x.c)));
        r += Math.max(0, 6 - (low - minF)) + (rest.length <= 2 ? 3 : 0);
      }
    }
    if (m.to[0] === 'c') r -= 8;
    if (to && !to.length) r -= 4;
    else if (to) r += 6;
    return r;
  },
};

export default withUndo(base);
