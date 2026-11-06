// Tek kişilik (solitaire) oyunların ortak parçaları.
// Kart kimliği: 'S14' (maça as) … çift destede 'S14a' / 'S14b'. Sayı: as 1, papaz 13 (sol sırası).
// Hamleler: {t:'mv', from, to, n} (n kart taşı), oyuna özel {t:'draw'|'deal'}, her oyunda {t:'undo'} ve {t:'resign'}.
// Yığın kimlikleri: t0.. (masa sütunları), f0.. (temel/bitiş), c0.. (boş hücre, FreeCell), s (deste), w (açık deste/atık).

export const SUITS = ['S', 'H', 'D', 'C'];
export const suitOf = (c) => c[0];
export const rankOf = (c) => {
  const r = parseInt(c.slice(1), 10);
  return r === 14 ? 1 : r;
};
export const red = (c) => c[0] === 'H' || c[0] === 'D';

export function makeDeck(copies = 1, suits = SUITS) {
  const out = [];
  const tag = copies > 1 ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : [''];
  for (let d = 0; d < copies; d++) for (const s of suits) for (let r = 2; r <= 14; r++) out.push(`${s}${r}${tag[d]}`);
  return out;
}

const clone = (s) => JSON.parse(JSON.stringify(s));

/**
 * Geri al ve pes et: oyunun hamlelerine {t:'undo'} ve {t:'resign'} ekler, her hamleden önce durumu saklar (en çok 300).
 * Oyun durumunda `won`, `resigned`, `moves` (hamle sayısı) alanları beklenir.
 */
export function withUndo(game) {
  const over = (s) => !!s.won || !!s.resigned; // kilitlenince (stuck) bitmez: geri alabilir ya da bitirir
  return {
    ...game,
    minPlayers: 1,
    maxPlayers: 1,
    currentActor: () => 0,
    legalMoves(s, seat) {
      if (seat !== 0 || over(s)) return [];
      const mv = game.legalMoves(s, seat);
      if (s.hist?.length) mv.push({ t: 'undo' });
      mv.push({ t: 'resign' });
      return mv;
    },
    applyMove(s, seat, m) {
      if (m.t === 'undo') {
        const prev = s.hist[s.hist.length - 1];
        return { ...prev, hist: s.hist.slice(0, -1), undos: (s.undos || 0) + 1, last: { t: 'undo' } };
      }
      if (m.t === 'resign') return { ...s, resigned: true, last: { t: 'resign' } };
      const { hist = [], ...snap } = s;
      const next = game.applyMove(snap, seat, m);
      const out = { ...next, hist: [...hist.slice(-299), clone(snap)], moves: (s.moves || 0) + 1, last: m };
      // hiç hamle kalmadıysa (geri al dışında) oyun kilitlenmiştir
      out.stuck = !out.won && !game.legalMoves(out, 0).length;
      return out;
    },
    isOver: over,
    winners: (s) => (s.won ? [0] : []),
    publicEvent: (before, seat, move, after) => ({ seat, move }),
    // İpucu puanı: az önce yapılan hamleyi geri çeviren hamle (gidip gelme) çok düşük
    rateMove(v, m, ctx) {
      const r = game.rateMove(v, m, ctx);
      const l = v.last;
      if (l && l.t === 'mv' && m.t === 'mv' && l.from === m.to && l.to === m.from && l.n === m.n) return r - 60;
      return r;
    },
    moveKey: (m) => `${m.t}:${m.from ?? ''}:${m.to ?? ''}:${m.n ?? ''}`,
  };
}
