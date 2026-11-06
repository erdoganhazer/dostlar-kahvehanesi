// Spider: iki deste (104 kart), 10 sütun (4'ü 6, 6'sı 5 kart; en üstteki açık), kalan 50 kart 5 dağıtım. Kurallar: docs/SOLITAIRE-KURALLARI.md
// Renk sayısı ayardan: 1 (hep maça), 2 (maça+kupa), 4. Bir kart, renk fark etmeksizin bir büyüğünün üstüne konur;
// birlikte taşınacak dizi ise aynı renkten sıralı olmalı. Boş sütuna her kart. Papazdan asa aynı renkten tamamlanan
// dizi masadan kalkar. Desteden dağıtım her sütuna birer kart verir (boş sütun varken dağıtılmaz). 8 dizi tamamlanınca kazanırsın.
import { makeDeck, suitOf, rankOf, withUndo } from './sol-common.js';

const top = (a) => a[a.length - 1];
const SUITSETS = { 1: ['S'], 2: ['S', 'H'], 4: ['S', 'H', 'D', 'C'] };

function runLen(col) {
  let n = col.length && col[col.length - 1].up ? 1 : 0;
  for (let j = col.length - 1; j > 0 && col[j - 1].up && suitOf(col[j].c) === suitOf(col[j - 1].c) && rankOf(col[j].c) === rankOf(col[j - 1].c) - 1; j--) n++;
  return n;
}

const base = {
  id: 'spider',
  name: 'Spider',
  createInitialState(config, rng) {
    const suits = SUITSETS[config.suits] || SUITSETS[1];
    const deck = rng.shuffle(makeDeck(8 / suits.length, suits));
    const t = [];
    let k = 0;
    for (let i = 0; i < 10; i++) {
      const n = i < 4 ? 6 : 5;
      t.push(deck.slice(k, k + n).map((c, j) => ({ c, up: j === n - 1 })));
      k += n;
    }
    return { t, s: deck.slice(k), f: [], suits: suits.length, won: false, moves: 0 };
  },
  legalMoves(s) {
    const out = [];
    let usedEmpty = false;
    s.t.forEach((col, i) => {
      const L = runLen(col);
      for (let n = 1; n <= L; n++) {
        const c = col[col.length - n].c;
        usedEmpty = false;
        s.t.forEach((dst, j) => {
          if (i === j) return;
          if (dst.length) {
            if (rankOf(top(dst).c) === rankOf(c) + 1) out.push({ t: 'mv', from: `t${i}`, to: `t${j}`, n });
          } else if (!usedEmpty && n < col.length) {
            usedEmpty = true;
            out.push({ t: 'mv', from: `t${i}`, to: `t${j}`, n });
          }
        });
      }
    });
    if (s.s.length && s.t.every((col) => col.length)) out.push({ t: 'deal' });
    return out;
  },
  viewFor(s) {
    return { ...s, t: s.t.map((col) => col.map((x) => (x.up ? x : { c: null, up: false }))), s: s.s.map(() => null), hist: undefined };
  },
  applyMove(s0, seat, m) {
    const s = JSON.parse(JSON.stringify(s0));
    const touched = [];
    if (m.t === 'deal') {
      s.t.forEach((col, i) => {
        col.push({ c: s.s.shift(), up: true });
        touched.push(i);
      });
    } else {
      const a = +m.from.slice(1);
      const b = +m.to.slice(1);
      const col = s.t[a];
      s.t[b].push(...col.splice(col.length - m.n, m.n));
      if (col.length && !top(col).up) top(col).up = true;
      touched.push(b);
    }
    // tamamlanan diziler kalkar
    for (const i of touched) {
      const col = s.t[i];
      if (runLen(col) >= 13 && rankOf(top(col).c) === 1) {
        const run = col.splice(col.length - 13, 13).map((x) => x.c);
        s.f.push(run);
        if (col.length && !top(col).up) top(col).up = true;
      }
    }
    s.won = s.f.length === 8;
    return s;
  },
  scores: (s) => [s.f.length],
  rateMove(v, m) {
    if (m.t === 'undo') return -50;
    if (m.t === 'resign') return -100;
    if (m.t === 'deal') return 0;
    const from = v.t[+m.from.slice(1)];
    const to = v.t[+m.to.slice(1)];
    const moving = from[from.length - m.n];
    const rest = from.slice(0, from.length - m.n);
    let r = 2;
    if (to.length) r += suitOf(top(to).c) === suitOf(moving.c) ? 14 + runLen(to) : 4;
    else r -= 6;
    if (!rest.length) r += 8;
    else if (!top(rest).up) r += 12;
    else if (rankOf(top(rest).c) === rankOf(moving.c) + 1) r -= suitOf(top(rest).c) === suitOf(moving.c) ? 30 : 6; // zaten yerindeydi
    // dizinin tamamı değil de bir parçası taşınıyorsa ve aynı renge gitmiyorsa kötü
    if (m.n < runLen(from) && !(to.length && suitOf(top(to).c) === suitOf(moving.c))) r -= 10;
    return r;
  },
};

export default withUndo(base);
