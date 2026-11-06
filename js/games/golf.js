// Golf solitaire: 7 sütun × 5 açık kart, kalan 17 kart deste (biri baştan açığa çevrilir). Kurallar: docs/SOLITAIRE-KURALLARI.md
// Sütunların en üstteki kartı, açık kartın bir büyüğü ya da bir küçüğüyse açığa gider (renk önemsiz, as–papaz arası döngü yok).
// Hamle kalmayınca desteden yeni kart açılır. Masa temizlenirse kazanırsın; puan = masada kalan kart (az olan iyi).
import { makeDeck, rankOf, withUndo } from './sol-common.js';

const top = (a) => a[a.length - 1];
const near = (a, b) => Math.abs(rankOf(a) - rankOf(b)) === 1;

const base = {
  id: 'golf',
  name: 'Golf',
  createInitialState(config, rng) {
    const deck = rng.shuffle(makeDeck());
    const t = [];
    for (let i = 0; i < 7; i++) t.push(deck.slice(i * 5, i * 5 + 5).map((c) => ({ c, up: true })));
    const rest = deck.slice(35);
    return { t, s: rest.slice(1), w: [rest[0]], won: false, moves: 0 };
  },
  legalMoves(s) {
    const out = [];
    const w = top(s.w);
    s.t.forEach((col, i) => col.length && near(top(col).c, w) && out.push({ t: 'mv', from: `t${i}`, to: 'w', n: 1 }));
    if (s.s.length) out.push({ t: 'draw' });
    return out;
  },
  viewFor(s) {
    return { ...s, s: s.s.map(() => null), hist: undefined };
  },
  applyMove(s0, seat, m) {
    const s = JSON.parse(JSON.stringify(s0));
    if (m.t === 'draw') s.w.push(s.s.shift());
    else s.w.push(s.t[+m.from.slice(1)].pop().c);
    s.won = s.t.every((col) => !col.length);
    return s;
  },
  scores: (s) => [-s.t.reduce((n, col) => n + col.length, 0)],
  rateMove(v, m) {
    if (m.t === 'undo') return -50;
    if (m.t === 'resign') return -100;
    if (m.t === 'draw') return 0;
    // bu kartı alınca zincir ne kadar uzar? (yeni açık kartla oynanabilecek üst kartlar)
    const col = v.t[+m.from.slice(1)];
    const c = top(col).c;
    const tops = v.t.map((cc, i) => (i === +m.from.slice(1) ? cc[cc.length - 2]?.c : top(cc)?.c)).filter(Boolean);
    const follow = tops.filter((x) => near(x, c)).length;
    return 10 + follow * 4 + col.length;
  },
};

export default withUndo(base);
