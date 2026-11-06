// Blackjack masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (desteden sırayla; krupiyenin ikinci kartı kapalı) → her çekilen kart desteden yerine uçar →
// krupiye kapalı kartını çevirir, 17'ye kadar çeker → sonuçlar okunur → bütün kartlar desteye toplanır.
import bj, { value, isBlackjack, BETS, ROUNDS } from '../games/blackjack.js';
import { createMatchScreen } from './table-kit.js';

const OUT = { bj: 'Blackjack', win: 'Kazandı', lose: 'Kaybetti', bust: 'Battı', push: 'Berabere' };
const money = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export function createBlackjackScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { hands, dealer, bets, chips, round, res, left }

  const fromState = (ctx) => {
    const v = ctx.view(0);
    return { hands: v.hands, dealer: v.holeHidden ? [...v.dealer, 'hole'] : v.dealer, bets: v.bets, chips: v.chips, round: v.round, res: null, left: v.left };
  };
  const snap = (re, before, extra = {}) => ({ hands: re.hands, dealer: [re.dealer[0], 'hole'], bets: re.bets, chips: before.chips, round: before.round, res: null, left: 52, ...extra });

  const resText = (res, i) => (res && res.outcomes[i] ? `${OUT[res.outcomes[i]]} ${res.net[i] ? money(res.net[i]) : ''}`.trim() : '');

  async function flyIn(ctx, id, delay = 0) {
    const { A } = ctx;
    const from = ctx.deckBox();
    const to = ctx.cardBox(id);
    const face = id !== 'hole';
    await A.fly(ctx.cardEl(null), from, to, { duration: A.dur('deal'), easing: A.EASE.land, delay, flipTo: face ? ctx.cardEl(ctx.parseCard(id)) : null });
  }
  const land = (ctx, id) => {
    ctx.reveal(id);
    ctx.render();
  };

  return createMatchScreen(deps, {
    yazboz: false,
    wonByScore: (res) => res.scores[0] > 1000,
    title: 'Blackjack',
    game: bj,
    players: () => settings.get('blackjackPlayers'),
    maxThink: 450,
    reset() {
      disp = null;
    },

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const mv = e.move;
      const ev = e.event;
      const re = ev.roundEnd;
      // 1) dağıtım ya da çekilen kart
      if (ev.dealLog) {
        if (re) disp = snap(re, before);
        const ids = ev.dealLog.map((x) => x.card ?? 'hole');
        ids.forEach((id) => ctx.pend.add(id));
        ctx.render();
        const gap = A.dur('deal') * 0.55;
        await Promise.all(ids.map((id, k) => flyIn(ctx, id, k * gap).then(() => land(ctx, id))));
        await ctx.wait('pause');
      } else if (mv.t === 'hit' || mv.t === 'double') {
        const hands = re ? re.hands : e.state.hands;
        const id = hands[e.seat][hands[e.seat].length - 1];
        if (re) disp = snap(re, before);
        ctx.pend.add(id);
        ctx.render();
        await flyIn(ctx, id);
        land(ctx, id);
        await ctx.wait('pause');
      } else if (re) disp = snap(re, before);
      if (!re) {
        disp = null;
        return;
      }
      // 2) krupiye: kapalı kartı çevir, 17'ye kadar çek
      ctx.render();
      await ctx.wait('pause');
      const hole = ctx.body.querySelector('[data-card="hole"]');
      await A.flipInPlace(hole, ctx.cardEl(ctx.parseCard(re.dealer[1])));
      guardFlip(ctx);
      disp.dealer = [re.dealer[0], re.dealer[1]];
      ctx.render();
      for (const c of re.draws) {
        await ctx.wait('pause');
        disp.dealer = [...disp.dealer, c];
        ctx.pend.add(c);
        ctx.render();
        await flyIn(ctx, c);
        land(ctx, c);
      }
      // 3) sonuçlar
      await ctx.wait('pause');
      disp = { ...disp, dealer: re.dealer, chips: re.chips, res: re };
      ctx.render();
      await ctx.wait(1900);
      // 4) kartlar desteye toplanır
      const ids = [...re.hands.flat(), ...re.dealer];
      const to = ctx.deckBox();
      await Promise.all(ids.map((id, k) => {
        const from = ctx.cardBox(id);
        ctx.hide(id);
        return A.fly(ctx.cardEl(ctx.parseCard(id)), from, to, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * A.dur('collectStagger') * 0.6, fadeEnd: true });
      }));
      disp = { hands: re.hands.map(() => []), dealer: [], bets: re.bets.map(() => 0), chips: re.chips, round: Math.min(re.round + 1, ROUNDS - 1), res: null, left: 52 };
      ctx.render();
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const sc = disp || fromState(ctx);
      const seen = (ids) => ids.filter((c) => c !== 'hole' && !ctx.pend.has(c));
      const tot = (ids) => {
        const sh = seen(ids);
        if (!sh.length) return '';
        const v = value(sh).total;
        return v > 21 ? 'Battı' : isBlackjack(sh) && sh.length === 2 ? 'BJ' : String(v);
      };
      const cardNodes = (ids, small) => h('div', { class: 'bjcards' }, ids.map((c) =>
        h('div', { class: `bjc${small ? ' sm' : ''}${ctx.pend.has(c) ? ' pend' : ''}`, 'data-card': c }, c === 'hole' ? ctx.cardEl(null) : ctx.cardEl(ctx.parseCard(c)))));
      const rows = [h('div', { class: 'bjrow dealer' }, h('span', { class: 'bjl' }, 'Krupiye', h('b', {}, tot(sc.dealer))), cardNodes(sc.dealer, false))];
      for (let i = 1; i < ctx.n; i++) {
        rows.push(h('div', { class: 'bjrow' }, h('span', { class: 'bjl' }, ctx.name(i), h('b', {}, tot(sc.hands[i]))), cardNodes(sc.hands[i], true)));
      }
      const onTable = [...sc.hands.flat(), ...sc.dealer].filter((c) => !ctx.pend.has(c)).length; // uçan kart desteden çıkmış sayılmaz: sayı kart inince düşer
      const area = h('div', { class: 'center bjarea' }, ctx.deck(52 - onTable), rows);
      const mineTurn = ctx.awaiting && !disp && s.turn === 0 && s.phase !== 'over';
      const myTot = tot(sc.hands[0]);
      const myRes = resText(sc.res, 0);
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(sc.round + 1, ROUNDS)}/${ROUNDS}`),
        h('div', { class: 'kg' }, myRes || (sc.hands[0].length ? `Elin: ${myTot || '…'}` : s.phase === 'bet' ? 'Bahis' : ' ')),
        h('div', { class: 'sub' }, sc.bets[0] ? `Bahsin: ${sc.bets[0]}` : ' '),
        h('div', { class: 'tot' }, `Çipin: ${sc.chips[0]}`));
      const out = [ctx.table({
        area, info,
        chipSub: (i) => (sc.res ? resText(sc.res, i) : `${sc.chips[i]}${sc.bets[i] ? ` · ${sc.bets[i]}` : ''}`),
        chipCls: (i) => (!disp && s.phase !== 'over' && s.turn === i ? 'turn' : ''),
      })];
      if (mineTurn && s.phase === 'bet') {
        out.push(h('div', { class: 'announce panel' }, h('b', {}, 'Bahsini seç'),
          h('div', { class: 'pgrid' }, BETS.map((v) => h('button', { class: 'btn', disabled: v > s.chips[0], onclick: () => ctx.respond({ t: 'bet', v }) }, String(v))))));
      }
      if (mineTurn && s.phase === 'play') {
        const legal = bj.legalMoves(s, 0);
        const can = (t) => legal.some((m) => m.t === t);
        out.push(h('div', { class: 'announce panel' }, h('div', { class: 'pgrid' },
          h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'hit' }) }, 'Kart çek'),
          h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'stand' }) }, 'Dur'),
          h('button', { class: 'btn', disabled: !can('double'), onclick: () => ctx.respond({ t: 'double' }) }, 'Katla'))));
      }
      out.push(ctx.handRow(sc.hands[0], {}));
      return out;
    },

    endHead: (w, ctx, res) => (res.scores[0] > 1000 ? 'Kasadan kazançlı çıktın!' : res.scores[0] === 1000 ? 'Başladığın yerdesin' : 'Kasa kazandı'),
    fmtScore: (s) => `${s} çip`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, 'Amaç elini 21\'e en çok yaklaştırıp aşmadan krupiyeyi geçmek. Kartlar: 2-10 kendi değeri, vale/kız/papaz 10, as 11 ya da 1.'),
      h2('p', {}, 'Her el önce bahis verilir (50, 100 ya da 200). İki kart gelir; krupiyenin biri açık, biri kapalı. Kart çek, dur ya da (ilk iki kartta) bahsi katla: tek kart çekilir ve elin biter.'),
      h2('p', {}, 'İlk iki kart 21 ise Blackjack: bahsin 1,5 katı ödenir. 21\'i aşan kaybeder. Krupiye 17\'ye kadar çeker, 17\'de durur. Kazanana bahis kadar, beraberlikte bahis iade edilir.'),
      h2('p', {}, '10 el sonunda en çok çipi olan kazanır. Bölme (split), sigorta ve teslim yok.')),
  });
}

function guardFlip() {}
