// Papaz Kaçtı (Papaz Kimde): 52'lik desteden 3 papaz çıkarılır, 49 kart dağıtılır. Aynı sayılı çiftler atılır.
// Sıran gelince sağındaki oyuncunun elinden (kapalı) bir kart çekersin; çift yaparsan atarsın.
// Sonunda papaz elinde kalan kaybeder. Hamle: { i: çekilecek kartın sırası }
const SUITS = ['S', 'H', 'D', 'C'];
export const rankOf = (c) => +c.slice(1);
export const suitOf = (c) => c[0];

function removePairs(hand) {
  const by = new Map();
  for (const c of hand) {
    const r = rankOf(c);
    if (!by.has(r)) by.set(r, []);
    by.get(r).push(c);
  }
  const keep = [];
  const dropped = [];
  for (const cs of by.values()) {
    const pairs = Math.floor(cs.length / 2);
    dropped.push(...cs.slice(0, pairs * 2));
    keep.push(...cs.slice(pairs * 2));
  }
  return { keep, dropped };
}

const nextWithCards = (hands, from) => {
  const n = hands.length;
  for (let k = 1; k < n; k++) {
    const t = (from + k) % n;
    if (hands[t].length) return t;
  }
  return -1;
};

const game = {
  id: 'papazkacti',
  name: 'Papaz Kaçtı',
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const n = Math.min(4, Math.max(2, config.players || 4));
    const keepKing = rng.pick(SUITS) + '13';
    const deck = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) if (r !== 13 || s + r === keepKing) deck.push(s + r);
    rng.shuffle(deck);
    let hands = Array.from({ length: n }, () => []);
    deck.forEach((c, i) => hands[i % n].push(c));
    const discards = Array(n).fill(0);
    const initial = hands.map((h) => [...h]); // dağıtılan ilk eller (açılış animasyonu için)
    const discarded = []; // yere açık atılan çiftler (herkese açık)
    hands = hands.map((h, i) => {
      const { keep, dropped } = removePairs(h);
      discards[i] += dropped.length;
      discarded.push(...dropped);
      return rng.shuffle(keep);
    });
    const out = [];
    hands.forEach((h, i) => h.length === 0 && out.push(i));
    return { n, hands, initial, discarded, discards, out, turn: 0, over: false, loser: -1, last: null, papaz: keepKing };
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.over || seat !== s.turn) return [];
    const t = nextWithCards(s.hands, seat);
    return t < 0 ? [] : s.hands[t].map((_, i) => ({ i }));
  },

  viewFor(s, seat) {
    const target = s.over ? -1 : nextWithCards(s.hands, s.turn);
    return {
      seat,
      n: s.n,
      hand: [...s.hands[seat]],
      handSizes: s.hands.map((h) => h.length),
      discards: s.discards,
      discarded: s.discarded,
      dealtHand: s.initial[seat],
      dealtSizes: s.initial.map((h) => h.length),
      out: s.out,
      turn: s.turn,
      target,
      last: s.last,
      over: s.over,
      loser: s.loser,
    };
  },

  applyMove(s, seat, move) {
    const t = nextWithCards(s.hands, seat);
    const hands = s.hands.map((h) => [...h]);
    const [card] = hands[t].splice(move.i, 1);
    hands[seat].push(card);
    const discards = [...s.discards];
    const pairWith = hands[seat].find((c) => c !== card && rankOf(c) === rankOf(card));
    let paired = null;
    let discarded = s.discarded;
    if (pairWith) {
      hands[seat] = hands[seat].filter((c) => c !== card && c !== pairWith);
      discards[seat] += 2;
      paired = rankOf(card);
      discarded = [...discarded, card, pairWith];
    }
    const out = [...s.out];
    if (hands[t].length === 0) out.push(t);
    if (hands[seat].length === 0) out.push(seat);
    const withCards = hands.map((h, i) => (h.length ? i : -1)).filter((i) => i >= 0);
    const last = { seat, from: t, paired, card, pairWith: pairWith || null, i: move.i };
    if (withCards.length <= 1) {
      return { ...s, hands, discards, discarded, out, over: true, loser: withCards[0] ?? -1, last };
    }
    // sıra: benden sonraki kartı olan oyuncu
    let turn = (seat + 1) % s.n;
    while (hands[turn].length === 0) turn = (turn + 1) % s.n;
    return { ...s, hands, discards, discarded, out, turn, last };
  },

  isOver: (s) => s.over,
  scores: (s) => s.hands.map((_, i) => (s.over && s.loser === i ? -1 : 0)),
  winners: (s) => s.hands.map((_, i) => i).filter((i) => i !== s.loser),
  // Çekilen kartın kendisi herkese açık değil; yalnızca kimden kim çekti, çift atıldı mı
  publicEvent: (before, seat, move, after) => ({
    seat,
    move,
    from: after.last.from,
    paired: after.last.paired,
    cardSeen: after.last.paired != null ? null : undefined,
    handLeft: after.hands[after.last.from].length,
  }),
  // Bot: kart sırası rastgele (şans oyunu); seviye farkı yok
  rateMove: () => 0,
};

export default game;
