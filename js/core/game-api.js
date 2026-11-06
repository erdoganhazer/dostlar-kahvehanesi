/**
 * OYUN MODÜLÜ SÖZLEŞMESİ
 * ----------------------
 * Her oyun (King, Batak, Yanık, Teksas Poker...) bu arayüzü uygular. Bot sistemi, masa motoru ve
 * oyuncu listesi oyunun içini bilmez; yalnızca bu fonksiyonlarla konuşur.
 *
 * ZORUNLU
 *   id, name, minPlayers, maxPlayers
 *   createInitialState(config, rng)   -> state          config: { players, ...oyuna özel }
 *   currentActor(state)               -> seat (0..n-1)
 *   legalMoves(state, seat)           -> move[]         move: JSON'a çevrilebilir düz nesne
 *   viewFor(state, seat)              -> view           gizli bilgiyi (rakip eli) ÇIKARIR
 *   applyMove(state, seat, move)      -> yeni state     SAF fonksiyon: state'i değiştirmez
 *   isOver(state)                     -> boolean
 *   scores(state)                     -> number[]       koltuk başına; büyük = iyi
 *                                                       (ceza oyunlarında eksi puan döndür)
 *
 * İSTEĞE BAĞLI (botları güçlendirir)
 *   rateMove(view, move, {risk, memory, seat}) -> number   sezgisel puan; büyük = iyi
 *   determinize(view, seat, rng)               -> state    görünür bilgiyle uyumlu rastgele
 *                                                          tam durum üretir (Zor seviye için)
 *   rolloutMove(state, seat, moves, rng)       -> move     Zor seviyede simülasyon politikası
 *   utility(state, seat)                       -> number   Zor seviyede sonuç değeri
 *                                                          (varsayılan: kendi puanı - ortalama)
 *   publicEvent(before, seat, move, after)     -> event    herkesin gördüğü olay
 *   botObserve(memory, event, view)            -> void     botun hafızasını günceller
 *   winners(state)                             -> seat[]   (varsayılan: en yüksek puan)
 *   moveKey(move)                              -> string   (varsayılan: JSON.stringify)
 */
export const REQUIRED = [
  'id',
  'name',
  'minPlayers',
  'maxPlayers',
  'createInitialState',
  'currentActor',
  'legalMoves',
  'viewFor',
  'applyMove',
  'isOver',
  'scores',
];

export function validateGame(game) {
  const missing = REQUIRED.filter((key) => !(key in game));
  if (missing.length) {
    throw new Error(`Oyun modülü '${game.id ?? '?'}' eksik: ${missing.join(', ')}`);
  }
  return game;
}

export const defaultMoveKey = (move) => JSON.stringify(move);

export function winnersOf(game, state) {
  if (game.winners) return game.winners(state);
  const s = game.scores(state);
  const best = Math.max(...s);
  return s.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
}

export function defaultUtility(game, state, seat) {
  const s = game.scores(state);
  const others = s.filter((_, i) => i !== seat);
  const avg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : 0;
  return s[seat] - avg;
}
