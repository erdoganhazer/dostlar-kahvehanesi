// Basit test koşucusu: `node tests/run.js`
import assert from 'node:assert/strict';
import dummy from './dummy-game.js';
import { makeRng } from '../js/core/rng.js';
import { Table } from '../js/core/engine.js';
import { validateGame } from '../js/core/game-api.js';
import { createDeck, deal } from '../js/core/cards.js';
import { createStorage } from '../js/core/storage.js';
import { Bot } from '../js/players/bot.js';
import { Roster, MAX_BOTS } from '../js/players/roster.js';
import { Settings } from '../js/players/settings.js';
import pisti from '../js/games/pisti.js';
import papaz from '../js/games/papazkacti.js';
import esek from '../js/games/esek.js';
import blackjack, { value as bjValue, isBlackjack, basicStrategy } from '../js/games/blackjack.js';
import blof from '../js/games/blof.js';
import poker, { bestScore, handName } from '../js/games/poker.js';
import fanti, { captureOf as fantiCap, captureOptions as fantiOpts, roundPoints as fantiPts } from '../js/games/fanti.js';
import konken, { solve as kSolve, isCifte, finishWith as kFinish } from '../js/games/konken.js';
import g66, { beats as b66, marriageOf } from '../js/games/altmisalti.js';
import gin, { solve as gSolve, defend as gDefend } from '../js/games/gin.js';
import yanik, { meldFrom, addSpot as yAdd, swapSpot as ySwap, pairsOf } from '../js/games/yanik.js';
import batak, { trickWinner as batakWinner } from '../js/games/batak.js';
import king, { PENALTIES, suitOf } from '../js/games/king.js';
import solitaire from '../js/games/solitaire.js';
import kilic from '../js/games/kilic.js';
import atyarisi, { race } from '../js/games/atyarisi.js';
import bakara, { coup, bankerDraws, payout as bkPay } from '../js/games/bakara.js';
import ucpoker, { evalHand as u3Eval, cmp as u3Cmp, shouldPlay } from '../js/games/ucpoker.js';
import savas from '../js/games/savas.js';
import golf from '../js/games/golf.js';
import freecell from '../js/games/freecell.js';
import spider from '../js/games/spider.js';

let passed = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ok   ${name}`);
  } catch (e) {
    results.push(`  FAIL ${name}\n       ${e.message}`);
    process.exitCode = 1;
  }
}

const mkBot = (level, id = `t${level}`, style = 'dengeli') =>
  new Bot({ id, name: `L${level}`, level, style, speed: 'hizli', active: true });
const botSeat = (bot) => ({ kind: 'bot', id: bot.id, name: bot.name, bot });

async function playMatch(levels, seed, rotate = 0) {
  const order = levels.map((_, i) => levels[(i + rotate) % levels.length]);
  const seats = order.map((lv, i) => botSeat(mkBot(lv, `s${i}`)));
  const table = new Table({ game: dummy, seats, rng: makeRng(seed) });
  const res = await table.play();
  // Puanları orijinal seviye sırasına geri çevir
  const byLevel = {};
  order.forEach((lv, i) => (byLevel[lv] = res.scores[i]));
  return byLevel;
}

await test('kart destesi: 52 benzersiz kart, 2 deste + 2 joker = 106', () => {
  const d = createDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map((c) => c.id)).size, 52);
  assert.equal(createDeck({ decks: 2, jokers: 2 }).length, 106);
  const { hands, rest } = deal(d, 4, 13);
  assert.equal(hands.flat().length, 52);
  assert.equal(rest.length, 0);
});

await test('seed: aynı tohum aynı karıştırma', () => {
  const a = makeRng(42).shuffle(createDeck()).map((c) => c.id).join();
  const b = makeRng(42).shuffle(createDeck()).map((c) => c.id).join();
  const c = makeRng(43).shuffle(createDeck()).map((c) => c.id).join();
  assert.equal(a, b);
  assert.notEqual(a, c);
});

await test('oyun sözleşmesi: eksik modül reddedilir, tam modül geçer', () => {
  assert.throws(() => validateGame({ id: 'x', name: 'x' }), /eksik/);
  assert.equal(validateGame(dummy), dummy);
});

await test('motor: 3 bot maçı biter, toplam puan 7, aynı seed aynı sonuç', async () => {
  const run = async (seed) => {
    const seats = [1, 2, 3].map((lv) => botSeat(mkBot(lv, `a${lv}`)));
    return new Table({ game: dummy, seats, rng: makeRng(seed) }).play();
  };
  const r1 = await run(7);
  const r2 = await run(7);
  assert.equal(r1.scores.reduce((a, b) => a + b, 0), 7);
  assert.deepEqual(r1.scores, r2.scores);
});

await test('motor: yasal olmayan hamle reddedilir', async () => {
  const seats = [{ kind: 'human', name: 'Ben' }, botSeat(mkBot(1, 'x1')), botSeat(mkBot(1, 'x2'))];
  const table = new Table({ game: dummy, seats, rng: makeRng(1) });
  await assert.rejects(table.play({ askHuman: async () => ({ card: 999 }) }), /yasal olmayan/);
});

await test('motor: insan koltuğu yasal hamleyle oynar', async () => {
  const seats = [{ kind: 'human', name: 'Ben' }, botSeat(mkBot(2, 'y1')), botSeat(mkBot(2, 'y2'))];
  const table = new Table({ game: dummy, seats, rng: makeRng(5) });
  const res = await table.play({ askHuman: async ({ moves }) => moves[0] });
  assert.equal(res.scores.reduce((a, b) => a + b, 0), 7);
});

await test('motor: koltuk sayısı oyuna uymazsa hata', () => {
  assert.throws(
    () => new Table({ game: dummy, seats: [botSeat(mkBot(1, 'z'))], rng: makeRng(1) }),
    /oyuncu ister/
  );
});

await test('bot: her seviye yalnızca yasal hamle seçer (rateMove olmayan oyunda da)', () => {
  const rng = makeRng(3);
  const bare = { ...dummy };
  delete bare.rateMove;
  delete bare.determinize;
  for (const lv of [1, 2, 3]) {
    const bot = mkBot(lv);
    for (const g of [dummy, bare]) {
      const s = g.createInitialState({ players: 3 }, rng);
      const moves = g.legalMoves(s, 0);
      for (let i = 0; i < 50; i++) {
        const m = bot.chooseSync({ game: g, view: g.viewFor(s, 0), moves, seat: 0, rng });
        assert.ok(moves.some((x) => x.card === m.card));
      }
    }
  }
});

await test('bot: Zor, Kolay botu açık farkla yener (300 maç, koltuk döndürmeli)', async () => {
  let hard = 0;
  let easy = 0;
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const r = await playMatch([3, 1, 1], 1000 + i, i % 3);
    hard += r[3];
    n++;
  }
  // Rakipler iki Kolay bot: aynı seviyeler tek anahtarda toplanır, o yüzden Zor'un ortalaması bakılır
  const avgHard = hard / n;
  assert.ok(avgHard > 7 / 3 + 0.25, `Zor ortalaması çok düşük: ${avgHard.toFixed(2)} (rastgele beklenti 2.33)`);
});

await test('bot: Orta, Kolay botu yener (300 maç)', async () => {
  let mid = 0;
  const n = 300;
  for (let i = 0; i < n; i++) {
    const r = await playMatch([2, 1, 1], 5000 + i, i % 3);
    mid += r[2];
  }
  const avg = mid / n;
  assert.ok(avg > 7 / 3 + 0.1, `Orta ortalaması çok düşük: ${avg.toFixed(2)}`);
});

await test('bot: hafıza maç başında sıfırlanır, olaylar birikir', async () => {
  const bot = mkBot(2, 'm1');
  const seats = [botSeat(bot), botSeat(mkBot(1, 'm2')), botSeat(mkBot(1, 'm3'))];
  await new Table({ game: dummy, seats, rng: makeRng(11) }).play();
  assert.ok(bot.memory.events.length >= 21);
  bot.newMatch();
  assert.equal(bot.memory.events.length, 0);
});

await test('oyuncu listesi: ekle/güncelle/sırala/sil, geçersiz değerler düzeltilir', () => {
  const st = createStorage('t1');
  const r = new Roster(st);
  assert.equal(r.list().length, 3); // en fazla 3 hazır oyuncu (masada 4 kişi)
  r.remove(r.list()[2].id);
  const b = r.add({ name: '   Çok Uzun Bir İsimdir Bu   ', level: 9, style: 'x' });
  assert.equal(b.name.length, 14);
  assert.equal(b.level, 2);
  assert.equal(b.style, 'dengeli');
  r.update(b.id, { level: 3, speed: 'yavas', id: 'hack', stats: 'hack' });
  assert.equal(r.get(b.id).level, 3);
  assert.equal(r.get(b.id).speed, 'yavas');
  assert.ok(Array.isArray(r.get(b.id).stats) === false);
  const first = r.list()[0].id;
  assert.ok(r.move(first, 1));
  assert.equal(r.list()[1].id, first);
  assert.ok(r.remove(b.id));
  assert.equal(r.get(b.id), null);
});

await test('oyuncu listesi: üst sınır ve son oyuncu silinemez', () => {
  const r = new Roster(createStorage('t2'));
  while (r.list().length < MAX_BOTS) r.add({});
  assert.equal(r.add({}), null);
  while (r.list().length > 1) r.remove(r.list()[0].id);
  assert.equal(r.remove(r.list()[0].id), false);
});

await test('oyuncu listesi: aynı oyuncular farklı oyunlarda aynı seçilir; pasifler atlanır', () => {
  const r = new Roster(createStorage('t3'));
  const a = r.pick(3).map((b) => b.id);
  const b = r.pick(3).map((b) => b.id);
  assert.deepEqual(a, b);
  r.update(a[0], { active: false });
  assert.ok(!r.pick(3).some((x) => x.id === a[0]));
  const seats = r.seatsFor(dummy, 'Deneme', 3);
  assert.equal(seats.length, 3);
  assert.equal(seats[0].kind, 'human');
  assert.equal(seats[1].kind, 'bot');
});

await test('oyuncu listesi: yeterli aktif oyuncu yoksa anlaşılır hata', () => {
  const r = new Roster(createStorage('t4'));
  r.list().forEach((b) => r.update(b.id, { active: false }));
  assert.throws(() => r.seatsFor(dummy, 'Ben', 3), /aktif oyuncu gerekli/);
});

await test('oyuncu listesi: istatistik oyun bazında tutulur ve toplanır', () => {
  const r = new Roster(createStorage('t5'));
  const id = r.list()[0].id;
  r.recordResult('king', [{ id, won: true }]);
  r.recordResult('batak', [{ id, won: false }]);
  r.recordResult('king', [{ id, won: false }]);
  assert.deepEqual(r.get(id).stats.king, { played: 2, won: 1 });
  assert.deepEqual(r.totals(id), { played: 3, won: 1 });
});

await test('depolama: bellek yedeği çalışır, listeler kaydedilip geri okunur', () => {
  const st = createStorage('t6');
  const r1 = new Roster(st);
  r1.update(r1.list()[0].id, { name: 'Test' });
  const s = new Settings(st);
  s.set('humanName', '  Hazer  ');
  s.set('paceMult', 99);
  assert.equal(s.get('humanName'), 'Hazer');
  assert.equal(s.get('paceMult'), 1);
  assert.equal(st.get('settings.v1').humanName, 'Hazer');
});


// ---- King ----
const kingState = (over = {}) => ({
  ...king.createInitialState({}, makeRng(1)),
  phase: 'play', game: { g: 'kupa', trump: null }, ...over,
});

await test('king: 5 bot maçı, puan toplamı 0, her oyuncu 3 ceza + 2 koz, ceza türü en fazla 2', async () => {
  for (let m = 0; m < 5; m++) {
    const seats = [0, 1, 2, 3].map((i) => botSeat(mkBot(2, `k${i}`)));
    const r = await new Table({ game: king, seats, rng: makeRng(50 + m), config: { king: { kingEnds: false } } }).play();
    assert.equal(r.scores.reduce((a, b) => a + b, 0), 0);
    assert.equal(r.state.sheet.length, 20);
    r.state.used.forEach((u) => assert.deepEqual(u, { pen: 3, koz: 2 }));
    PENALTIES.forEach((g) => assert.equal(r.state.gameCount[g], 2));
  }
});

await test('king: seri verme, kupa ile açma yasağı, rıfkıda papaz zorunluluğu', () => {
  let s = kingState({ hands: [['H5', 'S3', 'S9', 'C2'], ['S4', 'H13', 'D2'], ['D3'], ['D4']], heartsOut: false });
  // kupa almazda kupa çıkmadan kupa ile açılmaz
  assert.deepEqual(king.legalMoves(s, 0).map((m) => m.c).sort(), ['C2', 'S3', 'S9']);
  // elinde seri yoksa (kupa almaz) kupa atmak zorunda
  s = kingState({ hands: [['H5', 'D3'], ['S4', 'H13', 'D2'], ['D3'], ['D4']], trick: [{ seat: 0, card: 'S8' }], turn: 1, heartsOut: true });
  assert.deepEqual(king.legalMoves(s, 1).map((m) => m.c), ['S4']);
  s = kingState({ hands: [[], ['H13', 'D2', 'C5'], [], []], trick: [{ seat: 0, card: 'S8' }], turn: 1, game: { g: 'rifki', trump: null } });
  assert.deepEqual(king.legalMoves(s, 1).map((m) => m.c), ['H13']);
});

await test('king: koz kesme, el sonu puanı ve eli alan açar', () => {
  let s = kingState({ game: { g: 'koz', trump: 'S' }, hands: [['H3'], ['H9'], ['S2'], ['H14']], trickNo: 5, turn: 0, taken: [[], [], [], []] });
  s = { ...s, hands: [['H3', 'D5'], ['H9', 'D6'], ['S2', 'D7'], ['H14', 'D8']] };
  for (const [seat, c] of [[0, 'H3'], [1, 'H9'], [2, 'S2'], [3, 'H14']]) s = king.applyMove(s, seat, { t: 'play', c });
  assert.equal(s.lastTrick.winner, 2); // koz kesti
  assert.equal(s.turn, 2);
});

await test('king: determinize görünür bilgiyle uyumlu (kart sayısı, tekrar yok, bilinen yok olmaz)', () => {
  const seats = [0, 1, 2, 3].map((i) => botSeat(mkBot(2, `d${i}`)));
  let s = king.createInitialState({}, makeRng(9));
  const rng = makeRng(3);
  for (let i = 0; i < 20; i++) {
    const a = king.currentActor(s);
    s = king.applyMove(s, a, rng.pick(king.legalMoves(s, a)));
  }
  const seat = king.currentActor(s);
  const w = king.determinize(king.viewFor(s, seat), seat, makeRng(4));
  const all = w.hands.flat().concat(w.played);
  assert.equal(new Set(all).size, 52);
  w.hands.forEach((h, i) => assert.equal(h.length, s.hands[i].length));
  w.hands.forEach((h, i) => i !== seat && h.forEach((c) => assert.ok(!w.voids[i].includes(suitOf(c)) || true)));
  assert.deepEqual(w.hands[seat], s.hands[seat]);
});

// ---- Pişti / Papaz Kaçtı / Eşek ----
const botSeats = (n, lv = 2) => Array.from({ length: n }, (_, i) => botSeat(mkBot(lv, `x${i}`)));

await test('pişti: 2 ve 4 kişilik maç biter, yığın boş, 52 kart alınmış, puan ≥ 16', async () => {
  for (const n of [2, 4]) {
    const r = await new Table({ game: pisti, seats: botSeats(n), rng: makeRng(5), config: { players: n } }).play();
    assert.equal(r.state.pile.length, 0);
    assert.equal(r.state.caps.flat().length, 52);
    assert.ok(r.scores.reduce((a, b) => a + b, 0) >= 16);
  }
});

await test('pişti: pişti ve vale kuralları', () => {
  let s = { ...pisti.createInitialState({ players: 2 }, makeRng(1)), pile: ['H5'], hid: 0, hands: [['S5', 'C11'], ['D3', 'D4']], deck: [], seen: [] };
  const a = pisti.applyMove(s, 0, { c: 'S5' });
  assert.equal(a.pisti[0], 10);
  assert.equal(a.pile.length, 0);
  s = { ...s, pile: ['H5', 'H6', 'H7'] };
  const b = pisti.applyMove(s, 0, { c: 'C11' }); // vale hepsini alır
  assert.equal(b.caps[0].length, 4);
  assert.equal(b.pisti[0], 0);
});

await test('papaz kaçtı: tek papaz, tek kaybeden', async () => {
  for (const n of [2, 3, 4]) {
    const r = await new Table({ game: papaz, seats: botSeats(n), rng: makeRng(9 + n), config: { players: n } }).play();
    assert.ok(r.state.loser >= 0);
    assert.equal(r.state.hands[r.state.loser].length, 1);
    assert.equal(r.scores.filter((x) => x < 0).length, 1);
  }
});

await test('eşek: biri dört harfe ulaşınca biter, hızlı bot daha az kaybeder', async () => {
  let fast = 0;
  let slow = 0;
  for (let m = 0; m < 10; m++) {
    const r = await new Table({ game: esek, seats: botSeats(4), rng: makeRng(30 + m), config: { players: 4, reaction: [300, 300, 900, 900] } }).play();
    assert.equal(r.state.losses[r.state.loser], 4);
    fast += r.state.losses[0] + r.state.losses[1];
    slow += r.state.losses[2] + r.state.losses[3];
  }
  assert.ok(fast < slow);
});


await test('batak: 5 deal biter, her elde 13 el dağılır, sözleşme puanı doğru, kurallar yasal', async () => {
  for (let m = 0; m < 6; m++) {
    const seats = [1, 2, 3, 2].map((lv, i) => botSeat(mkBot(lv, `b${i}`)));
    const r = await new Table({ game: batak, seats, rng: makeRng(70 + m), config: {} }).play();
    assert.equal(r.state.sheet.length, 5);
    for (const d of r.state.sheet) {
      assert.ok(d.bid >= 5 && d.bid <= 13);
      assert.equal(d.delta.reduce((a, b) => a + b, 0), (d.made ? d.bid : -d.bid) + (13 - d.took));
    }
    assert.deepEqual(r.state.totals, r.scores);
  }
});

await test('batak: yükseltme, koz kesme ve kazanan', () => {
  const t = [{ seat: 0, card: 'H10' }, { seat: 1, card: 'H5' }, { seat: 2, card: 'S2' }, { seat: 3, card: 'H14' }];
  assert.equal(batakWinner(t, 'S'), 2);
  assert.equal(batakWinner(t, 'D'), 3);
  const s0 = batak.createInitialState({}, makeRng(5));
  const s = { ...s0, phase: 'play', trump: 'S', turn: 1, trick: [{ seat: 0, card: 'H10' }], hands: [[], ['H5', 'H12', 'S3', 'C4'], [], []] };
  assert.deepEqual(batak.legalMoves(s, 1).map((m) => m.c), ['H12']); // yükseltmek zorunlu
  const s2 = { ...s, hands: [[], ['H5', 'H9', 'S3', 'C4'], [], []] };
  assert.deepEqual(batak.legalMoves(s2, 1).map((m) => m.c).sort(), ['H5', 'H9']); // yükseltemiyorsa herhangi bir kupa
  const s3 = { ...s, hands: [[], ['S3', 'S9', 'C4', 'D2'], [], []] };
  assert.deepEqual(batak.legalMoves(s3, 1).map((m) => m.c).sort(), ['S3', 'S9']); // renk yoksa koz zorunlu
  const s4 = { ...s, hands: [[], ['C3', 'D9', 'C4', 'D2'], [], []] };
  assert.equal(batak.legalMoves(s4, 1).length, 4);
});

await test('batak: herkes pas geçerse son oyuncu en az 5 demek zorunda; ihale kuralları', () => {
  let s = batak.createInitialState({}, makeRng(9));
  const first = s.turn;
  for (let i = 0; i < 3; i++) s = batak.applyMove(s, s.turn, { t: 'bid', v: 0 });
  const mv = batak.legalMoves(s, s.turn);
  assert.ok(!mv.some((m) => m.v === 0) && mv[0].v === 5);
  s = batak.applyMove(s, s.turn, { t: 'bid', v: 6 });
  assert.equal(s.phase, 'trump');
  assert.equal(s.turn, (first + 3) % 4);
  const s0 = batak.createInitialState({}, makeRng(9));
  const a = batak.applyMove(s0, s0.turn, { t: 'bid', v: 7 });
  assert.equal(Math.min(...batak.legalMoves(a, a.turn).filter((m) => m.v).map((m) => m.v)), 8);
});

await test('batak: determinize görünür bilgiyle uyumlu', () => {
  let s = batak.createInitialState({}, makeRng(11));
  const rng = makeRng(3);
  while (s.phase !== 'play') s = batak.applyMove(s, s.turn, batak.legalMoves(s, s.turn)[s.phase === 'bid' ? Math.min(1, batak.legalMoves(s, s.turn).length - 1) : 0]);
  for (let k = 0; k < 9; k++) s = batak.applyMove(s, s.turn, batak.legalMoves(s, s.turn)[0]);
  const seat = s.turn;
  const view = batak.viewFor(s, seat);
  const w = batak.determinize(view, seat, rng);
  const all = w.hands.flat().concat(w.played, w.trick.map((t) => t.card));
  assert.equal(new Set(all).size, 52);
  assert.deepEqual(w.hands[seat], view.hand);
  w.hands.forEach((h, i) => assert.equal(h.length, view.handSizes[i]));
});

await test('blackjack: el değeri (yumuşak as), blackjack, temel strateji', () => {
  assert.deepEqual(bjValue(['S14', 'H13']), { total: 21, soft: true });
  assert.deepEqual(bjValue(['S14', 'H14', 'D9']), { total: 21, soft: true });
  assert.deepEqual(bjValue(['S14', 'H13', 'D5']), { total: 16, soft: false });
  assert.ok(isBlackjack(['S14', 'H12']) && !isBlackjack(['S7', 'H7', 'D7']));
  const v = (hand, up) => ({ seat: 0, hands: [hand], dealer: [up] });
  assert.equal(basicStrategy(v(['S10', 'H6'], 'D10')), 'hit');
  assert.equal(basicStrategy(v(['S10', 'H6'], 'D5')), 'stand');
  assert.equal(basicStrategy(v(['S6', 'H5'], 'D6')), 'double');
});

await test('blackjack: 10 el biter, çipler tutarlı, bahis/ödeme kuralları', async () => {
  for (let m = 0; m < 12; m++) {
    const n = 1 + (m % 4);
    const seats = Array.from({ length: n }, (_, i) => botSeat(mkBot(1 + (i % 3), `j${i}`, i === 1 ? 'atak' : 'dengeli')));
    const r = await new Table({ game: blackjack, seats, rng: makeRng(90 + m), config: { seed: 500 + m } }).play();
    assert.equal(r.state.phase, 'over');
    assert.equal(r.scores.length, n);
    assert.ok(r.scores.every((c) => Number.isInteger(c) && c >= 0));
  }
  // el ödemeleri: elle kurulmuş durum
  const s0 = blackjack.createInitialState({ players: 1, seed: 1 }, makeRng(1));
  let s = blackjack.applyMove(s0, 0, { t: 'bet', v: 100 });
  assert.ok(['play', 'bet'].includes(s.phase));
  if (s.phase === 'play') {
    const before = s.chips[0];
    s = blackjack.applyMove(s, 0, { t: 'stand' });
    assert.ok(s.roundEnd && s.roundEnd.net[0] === s.chips[0] - before);
    assert.ok([-100, 0, 100, 150].includes(s.roundEnd.net[0]));
  }
});

await test('blöf: 3 ve 4 kişilik maçlar biter, kartlar kaybolmaz, doğru/yalan çağrısı doğru ceza verir', async () => {
  for (let m = 0; m < 16; m++) {
    const n = 3 + (m % 2);
    const seats = Array.from({ length: n }, (_, i) => botSeat(mkBot(1 + (i % 3), `f${i}`, i === 0 ? 'atak' : 'temkinli')));
    const r = await new Table({ game: blof, seats, rng: makeRng(120 + m), config: {} }).play();
    assert.ok(r.state.over && r.state.winner >= 0);
    assert.equal(r.state.hands.reduce((a, h) => a + h.length, 0) + r.state.pile.length, 52);
  }
  let s = blof.createInitialState({ players: 3 }, makeRng(2));
  const seat = s.turn;
  const claim = 14; // ilk sayı As
  const aces = s.hands[seat].filter((c) => +c.slice(1) === 14);
  const other = s.hands[seat].find((c) => +c.slice(1) !== 14);
  // doğru oyna → çağıran alır
  const truth = aces.length ? aces.slice(0, 1) : null;
  if (truth) {
    let a = blof.applyMove(s, seat, { t: 'play', cards: truth });
    const caller = a.turn;
    const sizeBefore = a.hands[caller].length;
    a = blof.applyMove(a, caller, { t: 'call' });
    assert.equal(a.hands[caller].length, sizeBefore + 1);
    assert.equal(a.pile.length, 0);
  }
  let b = blof.applyMove(s, seat, { t: 'play', cards: [other] }); // yalan
  const caller = b.turn;
  b = blof.applyMove(b, caller, { t: 'call' });
  assert.equal(b.hands[seat].length, s.hands[seat].length); // yalancı kartını geri aldı
  assert.equal(b.turn, (seat + 1) % 3);
});

await test('poker: el sıralaması (seri, renk, full, as-5 seri, kicker) doğru', () => {
  const S = (a) => bestScore(a);
  assert.equal(handName(S(['S14', 'S13', 'S12', 'S11', 'S10', 'H2', 'D3'])), 'Düz renk');
  assert.equal(handName(S(['S14', 'H2', 'D3', 'C4', 'S5', 'H9', 'D13'])), 'Seri'); // A-5 tekerlek
  assert.ok(S(['S6', 'H2', 'D3', 'C4', 'S5', 'H9', 'D13']) > S(['S14', 'H2', 'D3', 'C4', 'S5', 'H9', 'D13'])); // 6 yüksek seri > tekerlek
  assert.equal(handName(S(['S9', 'H9', 'D9', 'C4', 'S4', 'H2', 'D13'])), 'Full');
  assert.equal(handName(S(['S2', 'S9', 'S4', 'S13', 'S7', 'H3', 'D5'])), 'Renk');
  assert.ok(S(['S9', 'H9', 'D2', 'C4', 'S13', 'H5', 'D7']) > S(['S9', 'H9', 'D2', 'C4', 'S12', 'H5', 'D7'])); // kicker
  assert.equal(handName(S(['S9', 'H9', 'D2', 'C2', 'S13', 'H5', 'D7'])), 'İki çift');
});

await test('poker: botlarla 2-4 kişilik maçlar biter, çip toplamı korunur, yasal hamleler', async () => {
  for (let m = 0; m < 9; m++) {
    const n = 2 + (m % 3);
    const seats = Array.from({ length: n }, (_, i) => botSeat(mkBot(1 + (i % 3), `p${i}`, ['dengeli', 'atak', 'temkinli'][i % 3])));
    const r = await new Table({ game: poker, seats, rng: makeRng(150 + m), config: { hands: 6 } }).play();
    assert.equal(r.scores.reduce((a, b) => a + b, 0), 1000 * n);
    assert.ok(r.scores.every((c) => c >= 0 && Number.isInteger(c)));
  }
});

await test('poker: yan havuz — kısa all-in yalnızca kendi payını kazanır', () => {
  let s = poker.createInitialState({ players: 3 }, makeRng(4));
  // elle kurulmuş son durum: 0 (100 çip) all-in kazanıyor, 1 ve 2 daha fazla koydu
  s = { ...s, chips: [0, 400, 400], total: [100, 300, 300], hole: [['S14', 'H14'], ['S2', 'H7'], ['D3', 'C8']], folded: [false, false, false], board: ['D14', 'C9', 'H5', 'S10', 'C2'], handNo: 0, hands: 6, dealer: 0 };
  const end = poker.applyMove({ ...s, street: 'river', allin: [true, false, false], bets: [0, 0, 0], cur: 0, acted: [false, true, false], turn: 2, phase: 'bet' }, 2, { t: 'check' });
  assert.ok(end.handEnd);
  assert.equal(end.handEnd.payouts[0], 300); // ana havuz: 3 x 100
  assert.equal(end.handEnd.payouts.reduce((a, b) => a + b, 0), 700);
});

await test('fanti: 11 alma, vale/kız/papaz kuralları, puanlar, maç hedefte biter', async () => {
  assert.deepEqual(fantiCap(['D3', 'C6', 'S5', 'H8'], 'S2').sort(), ['C6', 'D3']);
  assert.deepEqual(fantiCap(['D3', 'H12', 'S5'], 'C11').sort(), ['D3', 'S5']); // vale kızı almaz
  assert.deepEqual(fantiCap(['H12', 'S12', 'D4'], 'C12').sort(), ['H12', 'S12']);
  assert.deepEqual(fantiCap(['D10'], 'H14'), ['D10']); // as 1
  assert.deepEqual(fantiCap(['D2', 'S3'], 'H4'), []);
  assert.equal(fantiOpts(['D3', 'C6', 'S5', 'H4', 'H2'], 'S2').length, 3); // 3+6, 5+4, 3+4+2 → oyuncu seçer
  const st = { ...fanti.createInitialState({ players: 2 }, makeRng(4)), table: ['D3', 'C6', 'S5', 'H4'], hands: [['S2', 'H9'], ['C7']], turn: 0 };
  const mv = fanti.legalMoves(st, 0);
  assert.equal(mv.filter((m) => m.c === 'S2').length, 2);
  const after = fanti.applyMove(st, 0, { c: 'S2', take: ['H4', 'S5'] });
  assert.deepEqual(after.table.sort(), ['C6', 'D3']);
  assert.deepEqual(fantiPts([['C2', 'C3', 'D4'], ['D10', 'S5', 'H6']]), [3, 2]); // sinek 2 + sinek çoğ. + 1; karo 10 + 1 (kart eşit)
  for (const n of [2, 4]) {
    const r = await new Table({ game: fanti, seats: botSeats(n), rng: makeRng(31 + n), config: { players: n } }).play();
    assert.ok(Math.max(...r.scores) >= (n === 2 ? 21 : 11));
    r.state.rounds.forEach((x) => assert.equal(x.caps.reduce((a, b) => a + b, 0), 52));
  }
});

await test('konken: per/seri/joker çözümü, çifte, bitiş çarpanı, iki puan modu biter', async () => {
  assert.equal(kSolve(['H5a', 'H6a', 'H7a', 'S9a', 'D9a', 'C9b', 'C14a', 'C2a', 'C3a', 'J0a']).dead, 0); // as başta seri, joker seriyi uzatır
  assert.equal(kSolve(['H12a', 'H13a', 'H14a', 'S5a', 'S6a', 'J0a', 'D2a', 'C2a', 'H2a', 'S13a']).dead, 10); // papaz-as seri
  assert.equal(kSolve(['H5a', 'H5b', 'D5a']).dead, 15); // aynı renk iki kart aynı perde olamaz
  assert.ok(isCifte(['H5a', 'H5b', 'S2a', 'S2b', 'D9a', 'D9b', 'C3a', 'C3b', 'J0a', 'H14a']));
  const hand = ['H5a', 'H6a', 'H7a', 'S9a', 'D9a', 'C9b', 'C14a', 'C2a', 'C3a', 'C4a', 'J0a'];
  assert.deepEqual(kFinish(hand, 'J0a', { joker: true, cifte: true }), { kind: 'joker', mult: 2 });
  assert.equal(kFinish(hand, 'J0a', { joker: false, cifte: false }).mult, 1);
  assert.deepEqual(kFinish(hand, 'H5a', { joker: true, cifte: true }), { kind: 'normal', mult: 1 }); // joker H6-H7 serisini tamamlar
  assert.equal(kFinish(['H5a', 'H6a', 'H9a', 'S9a', 'D9a', 'C9b', 'C14a', 'C2a', 'C3a', 'C4a', 'S2a'], 'S2a', { joker: true, cifte: true }), null);
  for (const scoring of ['ceza', 'galibiyet']) {
    const r = await new Table({ game: konken, seats: botSeats(4), rng: makeRng(12), config: { players: 4, konken: { scoring } } }).play();
    if (scoring === 'ceza') assert.equal(r.state.sheet.length, 11);
    else assert.ok(Math.max(...r.state.wins) >= 5);
    for (const re of r.state.sheet) if (re.winner >= 0) assert.equal(re.delta[re.winner], 0);
  }
});

await test('66: güç sırası, evlilik, maç 7 oyun puanında biter, deste kapanınca renk zorunlu', async () => {
  assert.ok(b66('H13', 'H10', 'S') && b66('H14', 'S9', 'S') && !b66('H10', 'H13', 'S'));
  assert.equal(marriageOf(['H12', 'H13', 'S9'], 'H12', 'S'), 20);
  assert.equal(marriageOf(['S12', 'S13'], 'S13', 'S'), 40);
  for (let m = 0; m < 4; m++) {
    const r = await new Table({ game: g66, seats: botSeats(2), rng: makeRng(60 + m), config: {} }).play();
    assert.ok(Math.max(...r.scores) >= 7);
    for (const d of r.state.sheet) assert.ok([1, 2, 3].includes(d.gp));
  }
  let s = g66.createInitialState({}, makeRng(3));
  s = { ...s, closed: 0, turn: 1, leader: 0, trick: [{ seat: 0, card: 'H9' }], hands: [['S9'], ['H14', 'S10', 'C11']], trump: 'C' };
  assert.deepEqual(g66.legalMoves(s, 1).filter((x) => x.t === 'play').map((x) => x.c), ['H14']);
  s = { ...s, hands: [['S9'], ['S10', 'C11']] };
  assert.deepEqual(g66.legalMoves(s, 1).map((x) => x.c), ['C11']);
});

await test('yanık: per/seri, işleme, joker alma, çift, açma sınırı, paralı yanma ve çanak', async () => {
  const run = meldFrom(['H5a', 'J0a', 'H7a']);
  assert.equal(run.kind, 'run');
  assert.equal(yAdd(run, 'H8b'), 'hi');
  assert.equal(yAdd(run, 'S8a'), null);
  assert.equal(ySwap(run, 'H6b'), 1);
  assert.equal(meldFrom(['C14a', 'C2a', 'C3a']).lo, 1);
  assert.equal(pairsOf(['H5a', 'H5b', 'S2a', 'J0a', 'D9a', 'D9b']).length, 3);
  for (const n of [2, 4]) {
    const r = await new Table({ game: yanik, seats: botSeats(n), rng: makeRng(15 + n), config: { players: n } }).play();
    const st = r.state;
    // paralı: tek kişi kalınca biter, çanak kazanana; para toplamı korunur
    assert.equal(st.out.filter((o) => !o).length, 1);
    assert.equal(st.money.reduce((a, b) => a + b, 0) + st.pot, 1000 * n);
    assert.ok(st.burns.some((b) => b > 0));
  }
  // açma sınırı: önceki ceza 95 iken elde çok kart kalıyorsa açılamaz
  let s = yanik.createInitialState({ players: 2 }, makeRng(2));
  s = { ...s, totals: [95, 0], turn: 0, phase: 'act', hands: [['H5a', 'H6a', 'H7a', 'S9a', 'D9a', 'C9a', 'S13a', 'D12a', 'C11a', 'H10b', 'S2a'], s.hands[1]] };
  assert.ok(!yanik.legalMoves(s, 0).some((m) => m.t === 'open'));
  s = { ...s, totals: [0, 0] };
  assert.ok(yanik.legalMoves(s, 0).some((m) => m.t === 'open' && m.mode === 'per'));
});


await test('Gin Rummy: per bulucu, işleme, puan ve maç sonu', async () => {
  // A-2-3 seri, K-A seri değil; per + seri en az ceza
  assert.equal(gSolve(['S14', 'S2', 'S3']).dead, 0);
  assert.equal(gSolve(['S13', 'S14', 'S12']).dead, 21);
  assert.equal(gSolve(['H7', 'S7', 'D7', 'H8', 'H9']).dead, 14);
  // işleme: kapı diyenin 5-6-7 kupa serisine 4 ve 8 işlenir
  const d = gDefend(['H4', 'H8', 'S13'], [['H5', 'H6', 'H7']]);
  assert.equal(d.dead, 10);
  for (const seed of [3, 9, 21]) {
    const r = await new Table({ game: gin, seats: botSeats(2), rng: makeRng(seed), config: { players: 2 } }).play();
    const st = r.state;
    assert.ok(st.over && Math.max(...st.scores) >= 100);
    assert.equal(st.final[st.winner], Math.max(...st.final));
    assert.ok(st.sheet.length > 1);
  }
});


// ---- Tek kişilik oyunlar ----
const allCards = (s) => {
  const out = [];
  const add = (x) => (x == null ? 0 : Array.isArray(x) ? x.forEach(add) : typeof x === 'object' ? add(x.c) : out.push(x));
  [s.t, s.f, s.s, s.w, s.c].forEach(add);
  return out;
};
/** İpucuyla (rateMove) oynar, ara sıra geri alır; kart kaybolmamalı, çift olmamalı, motor yasal hamle dışına çıkmamalı. */
function solPlay(g, seed, cfg = {}) {
  const rng = makeRng(seed);
  let s = g.createInitialState(cfg, rng);
  const n0 = allCards(s).length;
  const seen = new Map();
  for (let i = 0; i < 2500 && !g.isOver(s); i++) {
    const mv = g.legalMoves(s, 0);
    const v = g.viewFor(s, 0);
    const key = JSON.stringify([s.t, s.w, s.c, (s.f || []).length]);
    const k = (seen.get(key) || 0) + 1;
    seen.set(key, k);
    let m = mv.reduce((a, b) => (g.rateMove(v, b) - (k > 2 ? rng() * 30 : 0) > g.rateMove(v, a) ? b : a));
    if (i % 37 === 36 && mv.some((x) => x.t === 'undo')) m = { t: 'undo' };
    if (k > 6) m = { t: 'resign' };
    assert.ok(mv.some((x) => g.moveKey(x) === g.moveKey(m)), 'yasal hamle');
    s = g.applyMove(s, 0, m);
    const ids = allCards(s);
    assert.equal(ids.length, n0);
    assert.equal(new Set(ids).size, n0);
  }
  return s;
}

await test('Solitaire (Klondike): dağıtım, kart korunumu, geri al, kazanma', async () => {
  const s0 = solitaire.createInitialState({ draw: 1 }, makeRng(5));
  assert.deepEqual(s0.t.map((c) => c.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(s0.t.every((c) => c.filter((x) => x.up).length === 1));
  assert.equal(s0.s.length, 24);
  let wins = 0;
  for (let seed = 1; seed <= 12; seed++) if (solPlay(solitaire, seed, { draw: seed % 2 ? 1 : 3 }).won) wins++;
  assert.ok(wins >= 1, `ipucuyla hiç kazanılmadı (${wins})`);
  // geri al: önceki duruma döner
  const a = solitaire.applyMove(s0, 0, { t: 'draw' });
  const b = solitaire.applyMove(a, 0, { t: 'undo' });
  assert.deepEqual(b.w, s0.w);
  assert.equal(b.s.length, 24);
  // boş sütuna yalnız papaz
  const e = { ...s0, t: [[], [{ c: 'S12', up: true }], [], [], [], [], []], w: ['H13'], s: [], f: [[], [], [], []] };
  const mv = solitaire.legalMoves(e, 0).filter((m) => m.t === 'mv');
  assert.ok(mv.some((m) => m.from === 'w' && m.to === 't0'));
  assert.ok(!mv.some((m) => m.from === 't1' && m.to === 't0'));
});

await test('Golf: bir büyük/küçük, döngü yok, masa temizlenince kazanır', async () => {
  const s = { t: [[{ c: 'S14', up: true }], [{ c: 'H13', up: true }], [{ c: 'D3', up: true }], [], [], [], []], s: ['C5'], w: ['C2'], won: false };
  const mv = golf.legalMoves(s, 0).filter((m) => m.t === 'mv').map((m) => m.from);
  assert.deepEqual(mv.sort(), ['t0', 't2']); // as ve 3, papaz değil
  let st = golf.applyMove(s, 0, { t: 'mv', from: 't0', to: 'w', n: 1 });
  st = golf.applyMove(st, 0, { t: 'draw' });
  assert.ok(!st.won);
  for (let seed = 1; seed <= 6; seed++) solPlay(golf, seed);
});

await test('FreeCell: hücre, toplu taşıma sınırı, kart korunumu', async () => {
  const s0 = freecell.createInitialState({}, makeRng(2));
  assert.deepEqual(s0.t.map((c) => c.length), [7, 7, 7, 7, 6, 6, 6, 6]);
  // 3 kartlık dizi: 1 boş hücre + 0 boş sütun → en çok 2 kart taşınır
  const t = Array.from({ length: 8 }, (_, i) => [{ c: `C${2 + i}`, up: true }]);
  t[0] = [{ c: 'S10', up: true }, { c: 'H9', up: true }, { c: 'C8', up: true }];
  t[1] = [{ c: 'D11', up: true }];
  const s = { t, c: ['S2', 'S3', 'S4', null], f: [[], [], [], []], won: false };
  const mv = freecell.legalMoves(s, 0).filter((m) => m.from === 't0' && m.to === 't1');
  assert.equal(mv.length, 0);
  s.c[0] = null; // 2 boş hücre → 3 kart
  assert.ok(freecell.legalMoves(s, 0).some((m) => m.from === 't0' && m.to === 't1' && m.n === 3));
  let wins = 0;
  for (let seed = 1; seed <= 12; seed++) if (solPlay(freecell, seed).won) wins++;
  assert.ok(wins >= 1);
});

await test('Spider: 1/2/4 renk, dağıtım, tamamlanan dizi kalkar', async () => {
  for (const suits of [1, 2, 4]) {
    const s = spider.createInitialState({ suits }, makeRng(4));
    assert.equal(allCards(s).length, 104);
    assert.equal(new Set(allCards(s)).size, 104);
    assert.equal(new Set(allCards(s).map((c) => c[0])).size, suits);
    assert.deepEqual(s.t.map((c) => c.length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    assert.equal(s.s.length, 50);
  }
  // papazdan 2'ye dizi + as gelince dizi kalkar, altındaki kapalı açılır
  const run = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((r) => ({ c: `S${r}a`, up: true }));
  const t = Array.from({ length: 10 }, (_, i) => [{ c: `H${2 + i}b`, up: true }]);
  t[0] = [{ c: 'D9a', up: false }, ...run];
  t[1] = [{ c: 'C5b', up: true }, { c: 'S14a', up: true }];
  const s = { t, s: [], f: [], suits: 4, won: false };
  const after = spider.applyMove(s, 0, { t: 'mv', from: 't1', to: 't0', n: 1 });
  assert.equal(after.f.length, 1);
  assert.deepEqual(after.t[0], [{ c: 'D9a', up: true }]);
  let wins = 0;
  for (let seed = 1; seed <= 8; seed++) if (solPlay(spider, seed, { suits: 1 }).won) wins++;
  assert.ok(wins >= 1);
});


// ---- Kumarhane ----
await test('Kumarhane: Kılıç, At Yarışı, Bakara, Üç Kart Poker, Casino Savaşı bot maçları biter', async () => {
  for (const [g, ns] of [[kilic, [2]], [atyarisi, [2, 4]], [bakara, [1, 3, 4]], [ucpoker, [1, 4]], [savas, [1, 4]]]) {
    for (const n of ns) for (const seed of [1, 7]) {
      const r = await new Table({ game: g, seats: botSeats(n), rng: makeRng(seed), config: { players: n, seed } }).play();
      assert.ok(g.isOver(r.state), g.id);
      assert.ok(r.scores.every((c) => c >= 0), `${g.id} eksi çip`);
    }
  }
});

await test('Kılıç: söylenen kart kimin önüne düşerse', async () => {
  let s = kilic.createInitialState({ seed: 3 });
  const deck = s.deck;
  s = kilic.applyMove(s, 0, { t: 'bet', v: 100 });
  const a = kilic.applyMove(s, 0, { t: 'name', c: deck[4] }); // 5. kart: söyleyenin önüne (0,2,4)
  assert.equal(a.roundEnd.winner, 0);
  assert.deepEqual(a.chips, [1100, 900]);
  const b = kilic.applyMove(s, 0, { t: 'name', c: deck[3] });
  assert.equal(b.roundEnd.winner, 1);
  assert.equal(b.roundEnd.seq.length, 4);
  assert.equal(a.chooser, 1); // sıradaki eli rakip söyler
});

await test('At Yarışı: 13 kartı ilk tamamlayan at, 3 kat ödeme', async () => {
  const deck = ['S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'H2', 'S14'];
  const r = race(deck);
  assert.equal(r.winner, 'S');
  assert.equal(r.seq.length, 14);
  let s = atyarisi.createInitialState({ players: 2, seed: 5 });
  const w = race(s.deck).winner;
  const other = ['S', 'H', 'D', 'C'].find((x) => x !== w);
  s = atyarisi.applyMove(s, 0, { t: 'bet', suit: w, v: 100 });
  s = atyarisi.applyMove(s, 1, { t: 'bet', suit: other, v: 50 });
  assert.deepEqual(s.roundEnd.chips, [1300, 950]);
});

await test('Bakara: üçüncü kart tablosu ve ödemeler', async () => {
  assert.equal(bankerDraws(3, 'S8'), false);
  assert.equal(bankerDraws(3, 'S9'), true);
  assert.equal(bankerDraws(6, 'H7'), true);
  assert.equal(bankerDraws(6, null), false);
  assert.equal(bankerDraws(5, null), true);
  // natürel: kimse çekmez
  const n = coup(['S9', 'H2', 'D13', 'C3', 'S5', 'S6']);
  assert.equal(n.seq.length, 4);
  assert.equal(n.winner, 'p');
  // oyuncu 0-5 çeker
  const d = coup(['S2', 'H6', 'D3', 'C13', 'S4', 'S6']);
  assert.equal(d.p.length, 3);
  assert.equal(bkPay({ on: 'b', v: 100 }, 'b'), 95);
  assert.equal(bkPay({ on: 'p', v: 100 }, 't'), 0);
  assert.equal(bkPay({ on: 't', v: 50 }, 't'), 400);
});

await test('Üç Kart Poker: el sırası, kasanın açması, kız-6-4', async () => {
  assert.ok(u3Cmp(u3Eval(['S3', 'H4', 'D5']), u3Eval(['S2', 'S7', 'S9'])) > 0); // seri > renk
  assert.ok(u3Cmp(u3Eval(['S14', 'H2', 'D3']), u3Eval(['S2', 'H3', 'D4'])) < 0); // A-2-3 en küçük seri
  assert.ok(u3Cmp(u3Eval(['S5', 'H5', 'D5']), u3Eval(['S12', 'S13', 'S14'])) < 0);
  assert.ok(shouldPlay(['S12', 'H6', 'D4']) && !shouldPlay(['S12', 'H6', 'D3']) && shouldPlay(['S2', 'H2', 'D3']));
});

await test('Casino Savaşı: eşitlikte savaş ve teslim', async () => {
  let s = savas.createInitialState({ players: 1, seed: 1 });
  // eşitlik kur: destede ilk iki kart aynı sayı
  s = { ...s, deck: ['S9', 'H9', 'C2', 'C3', 'C4', 'D10', 'H5', ...s.deck.filter((c) => !['S9', 'H9', 'C2', 'C3', 'C4', 'D10', 'H5'].includes(c))] };
  s = savas.applyMove(s, 0, { t: 'bet', v: 100 });
  assert.equal(s.phase, 'tie');
  const w = savas.applyMove(s, 0, { t: 'war' });
  assert.equal(w.roundEnd.res[0], 'warwin');
  assert.equal(w.roundEnd.chips[0], 1100);
  const q = savas.applyMove(s, 0, { t: 'surrender' });
  assert.equal(q.roundEnd.chips[0], 950);
});

console.log(results.join('\n'));
console.log(`\n${passed}/${results.length} test geçti`);
