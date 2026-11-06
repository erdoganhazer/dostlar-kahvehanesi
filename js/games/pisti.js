// Pişti: 2 veya 4 kişi, 52 kart. Yerde 4 kart (3 kapalı, üstteki açık), herkese 4'er kart.
// Yerdeki üst kartla aynı sayı ya da vale atan bütün yığını alır. Yerde tek kart varken aynı sayıyı atmak "pişti" (10),
// valeyle vale pişti 20. Puanlar: vale 1, as 1, sinek 2 → 2, karo 10 → 3, en çok kart (27+ / en fazla) → 3.
// Hamle: { c: 'H13' }

export const SUITS = ['S', 'H', 'D', 'C'];
export const suitOf = (c) => c[0];
export const rankOf = (c) => +c.slice(1);
const ALL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(s + r);

export function cardValue(c) {
  if (c === 'C2') return 2;
  if (c === 'D10') return 3;
  const r = rankOf(c);
  return r === 11 || r === 14 ? 1 : 0;
}

function deal(s) {
  const n = s.n;
  const hands = s.hands.map((h) => [...h]);
  let deck = s.deck;
  for (let p = 0; p < n; p++) {
    hands[p] = deck.slice(p * 4, p * 4 + 4);
  }
  deck = deck.slice(n * 4);
  return { ...s, hands, deck, round: s.round + 1 };
}

function pointsOf(s, withMajority) {
  const pts = s.caps.map((cs, p) => s.pisti[p] + cs.reduce((a, c) => a + cardValue(c), 0));
  if (withMajority) {
    const counts = s.caps.map((c) => c.length);
    const mx = Math.max(...counts);
    const top = counts.map((c, i) => (c === mx ? i : -1)).filter((i) => i >= 0);
    if (top.length === 1) pts[top[0]] += 3;
  }
  return pts;
}

const game = {
  id: 'pisti',
  name: 'Pişti',
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const n = config.players === 4 ? 4 : config.players === 3 ? 3 : 2;
    let deck;
    let pile;
    do {
      deck = rng.shuffle([...ALL]);
      pile = deck.slice(0, 4);
    } while (rankOf(pile[3]) === 11);
    deck = deck.slice(4);
    let s = {
      n,
      deck,
      hands: Array.from({ length: n }, () => []),
      pile,
      hid: 3, // alttaki 3 kart kapalı
      seen: [pile[3]],
      caps: Array.from({ length: n }, () => []),
      pisti: Array(n).fill(0),
      lastCap: -1,
      turn: 0,
      round: -1,
      over: false,
      lastEvent: null,
    };
    s = deal(s);
    return s;
  },

  currentActor: (s) => s.turn,
  legalMoves: (s, seat) => (s.over || seat !== s.turn ? [] : s.hands[seat].map((c) => ({ c }))),

  viewFor(s, seat) {
    return {
      seat,
      n: s.n,
      hand: [...s.hands[seat]],
      handSizes: s.hands.map((h) => h.length),
      pile: s.pile.slice(s.hid),
      pileSize: s.pile.length,
      seen: s.seen,
      capCounts: s.caps.map((c) => c.length),
      points: pointsOf(s, false),
      deckLeft: s.deck.length,
      turn: s.turn,
      round: s.round,
      lastEvent: s.lastEvent,
      over: s.over,
    };
  },

  applyMove(s, seat, move) {
    const c = move.c;
    const hands = s.hands.map((h, i) => (i === seat ? h.filter((x) => x !== c) : h));
    const top = s.pile.length ? s.pile[s.pile.length - 1] : null;
    const r = rankOf(c);
    const captures = top && (r === rankOf(top) || r === 11);
    const seen = [...s.seen, c];
    let next = { ...s, hands, seen, turn: (seat + 1) % s.n };
    if (captures) {
      const taken = [...s.pile, c];
      let bonus = 0;
      if (s.pile.length === 1 && r === rankOf(top)) bonus = r === 11 ? 20 : 10;
      const caps = s.caps.map((x, i) => (i === seat ? [...x, ...taken] : x));
      const pisti = s.pisti.map((x, i) => (i === seat ? x + bonus : x));
      next = { ...next, pile: [], hid: 0, caps, pisti, lastCap: seat, lastEvent: { seat, card: c, capture: taken.length, bonus } };
    } else {
      next = { ...next, pile: [...s.pile, c], lastEvent: { seat, card: c, capture: 0, bonus: 0 } };
    }
    if (next.hands.every((h) => h.length === 0)) {
      if (next.deck.length) next = deal(next);
      else {
        // oyun bitti: yerde kalan kartlar son alana
        const who = next.lastCap >= 0 ? next.lastCap : seat;
        const caps = next.caps.map((x, i) => (i === who ? [...x, ...next.pile] : x));
        next = { ...next, caps, pile: [], hid: 0, over: true };
      }
    }
    return next;
  },

  isOver: (s) => s.over,
  scores: (s) => pointsOf(s, s.over),
  publicEvent: (before, seat, move, after) => ({ seat, move, ...after.lastEvent, dealt: after.round !== before.round }),

  // ---- Bot ----
  rateMove(view, move, ctx = {}) {
    const c = move.c;
    const r = rankOf(c);
    const top = view.pile.length ? view.pile[view.pile.length - 1] : null;
    const risk = ctx.risk ?? 0.5;
    const val = cardValue(c);
    const pileVal = view.pile.reduce((a, x) => a + cardValue(x), 0);
    const captures = top && view.pileSize > 0 && (r === rankOf(top) || r === 11);
    if (captures) {
      let g = pileVal + val + 0.3 * (view.pileSize + 1);
      if (view.pileSize === 1 && r === rankOf(top)) g += r === 11 ? 20 : 10;
      if (r === 11 && r !== rankOf(top)) g -= 2.2 - risk * 1.5; // valeyi boşa harcama
      return 10 + g;
    }
    // Kart atıyorum: rakibin sonraki hamlede alma/pişti ihtimalini tahmin et
    const un = unseenCount(view);
    const sameLeft = Math.max(0, 4 - view.seen.filter((x) => rankOf(x) === r).length - view.hand.filter((x) => rankOf(x) === r && x !== c).length);
    const nextHand = view.handSizes[(view.seat + 1) % view.n];
    const pMatch = un > 0 ? 1 - Math.pow(1 - Math.min(1, sameLeft / un), nextHand) : 0;
    const pJack = un > 0 ? 1 - Math.pow(1 - Math.min(1, (4 - view.seen.filter((x) => rankOf(x) === 11).length - view.hand.filter((x) => rankOf(x) === 11).length) / un), nextHand) : 0;
    const newSize = view.pileSize + 1;
    const give = (pileVal + val) * pMatch * 0.8 + (pileVal + val) * pJack * 0.5;
    let pen = give + (newSize === 1 ? 0 : 0);
    if (view.pileSize === 0 && r !== 11) pen += 10 * pMatch; // boş yere tek kart bırakırsam pişti yerim
    if (r === 11) pen += 1.5; // vale esnek, kolay harcama
    pen += val * 0.6; // değerli kartı sakla
    return -pen;
  },
};

function unseenCount(view) {
  return Math.max(1, 52 - view.seen.length - view.hand.length);
}

export default game;
