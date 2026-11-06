// Fanti: 2 veya 4 kişi, 52 kart. Kurallar: docs/FANTI-KURALLARI.md
// Yere 4 açık kart (vale çıkarsa desteye geri), herkese 4'er kart. Attığın kartla yerdeki kartlardan toplamı 11 edenleri alırsın
// (as 1). Kız yalnız kızları, papaz yalnız papazları alır. Vale (fanti) yerdeki kız ve papaz dışındaki her şeyi alır.
// Bir kart birden çok şekilde 11 yapabiliyorsa oyuncu hangi kartları alacağını seçer (hamle: { c, take }). Alabiliyorsan almak zorundasın.
// Dağıtım bitince puan: sinek 2 = 1, karo 10 = 1, sinek çoğunluğu = 1, kart çoğunluğu = 2 (beraberlikte paylaşılır).
// Hedef puana (2 kişide 21, 4 kişide 11) ilk ulaşan kazanır. Hamle: { c: 'H5' }
export const SUITS = ['S', 'H', 'D', 'C'];
export const suitOf = (c) => c[0];
export const rankOf = (c) => +c.slice(1);
export const isFace = (c) => rankOf(c) >= 11 && rankOf(c) <= 13;
export const num = (c) => (rankOf(c) === 14 ? 1 : rankOf(c));
export const TARGET = { 2: 21, 4: 11 };
const ALL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(s + r);

const special = (c) => (c === 'C2' || c === 'D10' ? 1 : 0);
/** Alınan kartların değeri (bot ve seçim için) */
export const grabValue = (cards) => cards.reduce((a, c) => a + special(c) * 3 + (suitOf(c) === 'C' ? 0.35 : 0) + 0.25, 0);

/** Bu kartla yapılabilecek bütün alma seçenekleri (her biri kart listesi; sıralı). Alamıyorsa []. */
export function captureOptions(table, c) {
  const r = rankOf(c);
  if (r >= 11 && r <= 13) {
    const t = captureOf(table, c);
    return t.length ? [t] : [];
  }
  const need = 11 - num(c);
  const nums = table.filter((x) => !isFace(x));
  const out = [];
  for (let m = 1; m < 1 << nums.length; m++) {
    let sum = 0;
    const pick = [];
    for (let i = 0; i < nums.length; i++) if (m & (1 << i)) {
      sum += num(nums[i]);
      pick.push(nums[i]);
    }
    if (sum === need) out.push(pick.sort());
  }
  return out;
}

/** Bu kartı atınca alınabilecek en değerli seçenek (bot/yönerge yardımcısı). Alamıyorsa []. */
export function captureOf(table, c) {
  const r = rankOf(c);
  if (r === 11) return table.filter((x) => rankOf(x) !== 12 && rankOf(x) !== 13);
  if (r === 12 || r === 13) return table.filter((x) => rankOf(x) === r);
  const need = 11 - num(c);
  const nums = table.filter((x) => !isFace(x));
  let best = [];
  let bv = -1;
  const n = nums.length;
  for (let m = 1; m < 1 << n; m++) {
    let sum = 0;
    const pick = [];
    for (let i = 0; i < n; i++) if (m & (1 << i)) {
      sum += num(nums[i]);
      pick.push(nums[i]);
    }
    if (sum !== need) continue;
    const v = grabValue(pick);
    if (v > bv) {
      bv = v;
      best = pick;
    }
  }
  return best;
}

function dealHands(s) {
  const hands = s.hands.map((_, p) => s.deck.slice(p * 4, p * 4 + 4));
  return { ...s, hands, deck: s.deck.slice(s.n * 4), deal: s.deal + 1 };
}

function newRound(s, rng, round) {
  let deck = rng.shuffle([...ALL]);
  // yere 4 kart; vale çıkarsa desteye geri konur, yerine yenisi açılır
  const table = [];
  while (table.length < 4) {
    const c = deck[0];
    deck = deck.slice(1);
    if (rankOf(c) === 11) deck.splice(10 + rng.int(deck.length - 10), 0, c);
    else table.push(c);
  }
  const st = {
    ...s, round, deck, table, hands: Array.from({ length: s.n }, () => []), caps: Array.from({ length: s.n }, () => []),
    lastCap: -1, deal: -1, seen: [...table], turn: round % s.n, lastEvent: null,
  };
  return dealHands(st);
}

export function roundPoints(caps) {
  const n = caps.length;
  const pts = Array(n).fill(0);
  caps.forEach((cs, i) => {
    if (cs.includes('C2')) pts[i] += 1;
    if (cs.includes('D10')) pts[i] += 1;
  });
  const award = (counts, total) => {
    const mx = Math.max(...counts);
    const top = counts.map((c, i) => (c === mx ? i : -1)).filter((i) => i >= 0);
    if (top.length === 1) pts[top[0]] += total;
    else if (total === 2 && top.length === 2) top.forEach((i) => (pts[i] += 1));
  };
  award(caps.map((c) => c.filter((x) => suitOf(x) === 'C').length), 1);
  award(caps.map((c) => c.length), 2);
  return pts;
}

const game = {
  id: 'fanti',
  name: 'Fanti',
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const n = config.players === 4 ? 4 : 2;
    const s = { n, target: config.target || TARGET[n], seed: rng.int(2 ** 31), totals: Array(n).fill(0), over: false, roundEnd: null, rounds: [] };
    return newRound(s, rng.fork(), 0);
  },

  currentActor: (s) => s.turn,
  legalMoves(s, seat) {
    if (s.over || seat !== s.turn) return [];
    return s.hands[seat].flatMap((c) => {
      const opts = captureOptions(s.table, c);
      return opts.length ? opts.map((take) => ({ c, take })) : [{ c, take: [] }];
    });
  },
  moveKey: (m) => `${m.c}:${[...(m.take || [])].sort().join(',')}`,

  viewFor(s, seat) {
    return {
      seat, n: s.n, hand: [...s.hands[seat]], handSizes: s.hands.map((h) => h.length), table: [...s.table], seen: s.seen,
      capCounts: s.caps.map((c) => c.length), clubCounts: s.caps.map((c) => c.filter((x) => suitOf(x) === 'C').length),
      deckLeft: s.deck.length, turn: s.turn, round: s.round, deal: s.deal, totals: s.totals, target: s.target, over: s.over,
      lastEvent: s.lastEvent, specials: s.caps.map((c) => c.filter((x) => special(x))),
    };
  },

  applyMove(s, seat, move) {
    const c = move.c;
    const hands = s.hands.map((h, i) => (i === seat ? h.filter((x) => x !== c) : h));
    const take = move.take ? [...move.take] : captureOf(s.table, c);
    const seen = [...s.seen, c];
    let next;
    if (take.length) {
      const set = new Set(take);
      const caps = s.caps.map((x, i) => (i === seat ? [...x, c, ...take] : x));
      next = { ...s, hands, seen, table: s.table.filter((x) => !set.has(x)), caps, lastCap: seat, lastEvent: { seat, card: c, take } };
    } else next = { ...s, hands, seen, table: [...s.table, c], lastEvent: { seat, card: c, take: [] } };
    next.turn = (seat + 1) % s.n;
    if (!next.hands.every((h) => h.length === 0)) return next;
    if (next.deck.length) return dealHands(next);
    // dağıtım (deste) bitti: yerde kalanlar son alana, puanlar yazılır
    const who = next.lastCap >= 0 ? next.lastCap : seat;
    const caps = next.caps.map((x, i) => (i === who ? [...x, ...next.table] : x));
    const pts = roundPoints(caps);
    const totals = s.totals.map((t, i) => t + pts[i]);
    const roundEnd = { round: s.round, rest: next.table, restTo: who, pts, totals, caps: caps.map((c) => c.length), clubs: caps.map((c) => c.filter((x) => suitOf(x) === 'C').length), specials: caps.map((c) => c.filter((x) => special(x))) };
    const mx = Math.max(...totals);
    const leaders = totals.filter((t) => t === mx).length;
    const base = { ...next, caps, table: [], totals, roundEnd, rounds: [...s.rounds, roundEnd] };
    if (mx >= s.target && leaders === 1) return { ...base, over: true };
    if (s.round >= 40) return { ...base, over: true };
    const rng = (() => {
      let x = (s.seed + (s.round + 1) * 7919) >>> 0;
      return { shuffle: shuffleWith(() => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296), int: (k) => Math.floor(((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296) * k) };
    })();
    return { ...newRound(base, rng, s.round + 1), roundEnd, lastEvent: next.lastEvent };
  },

  isOver: (s) => s.over,
  scores: (s) => s.totals,
  publicEvent: (before, seat, move, after) => ({
    seat, move, ...after.lastEvent, dealt: after.deal !== before.deal || after.round !== before.round,
    roundEnd: after.roundEnd && after.roundEnd !== before.roundEnd ? after.roundEnd : null,
  }),

  // ---- Bot: alacağının değeri, bıraktığının rakibe verdiği fırsat ----
  rateMove(view, move, ctx = {}) {
    const c = move.c;
    const risk = ctx.risk ?? 0.5;
    const take = move.take ?? captureOf(view.table, c);
    if (take.length) {
      let g = grabValue([c, ...take]);
      if (rankOf(c) === 11) g -= 1.2 - risk * 0.8; // valeyi küçük alış için harcama
      if (take.length === view.table.length) g += 0.4; // yeri boşaltmak rakibi zorlar
      return 10 + g;
    }
    // kart bırakıyorum: sıradaki oyuncu yeni masadan ne alabilir?
    const after = [...view.table, c];
    const un = unseen(view);
    let risky = 0;
    for (const r of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      const probe = r === 11 ? 'S11' : r === 1 ? 'S14' : `S${r}`;
      const got = captureOf(after, probe);
      if (!got.length) continue;
      const left = un.filter((x) => (r === 1 ? rankOf(x) === 14 : rankOf(x) === r)).length;
      const p = Math.min(1, (left / Math.max(1, un.length)) * view.handSizes[(view.seat + 1) % view.n]);
      risky = Math.max(risky, p * grabValue(got));
    }
    return -risky - grabValue([c]) * 0.6 - (rankOf(c) === 11 ? 2 : 0);
  },
};

function unseen(view) {
  const have = new Set([...view.seen, ...view.hand]);
  return ALL.filter((c) => !have.has(c));
}

function shuffleWith(f) {
  return (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(f() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
}

export default game;
