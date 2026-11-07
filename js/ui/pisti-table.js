// Pişti masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: açılış (desteden yere 3 kapalı + 1 açık, sonra herkese 4'er) → oynama (elden/kutudan yığına) →
// yığını alma (okuma molası, sonra alanın destesine) → yeni 4'er kart (desteden).
import pisti from '../games/pisti.js';
import { createMatchScreen, choreo } from './table-kit.js';

export function createPistiScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { pile, hidden, hand, sizes, deck, caps, points }
  let note = '';

  const baseIds = (n) => Array.from({ length: n }, (_, k) => `base${k}`);

  function handOrder(ctx, hand) {
    const order = [];
    for (let r = 0; r < 4; r++) for (let k = 1; k <= ctx.n; k++) {
      const seat = k % ctx.n; // önce rakipler, en son sen (dağıtan sensin)
      order.push({ seat, card: seat === 0 ? hand[r] : null });
    }
    return order;
  }

  async function dealHands(ctx, v, deckBefore) {
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    disp = { ...(disp || {}), hand: v.hand, sizes: v.handSizes, deck: deckBefore };
    ctx.render();
    await choreo.deal(ctx, handOrder(ctx, v.hand), { from: ctx.deckBox() });
    ctx.adj = Array(ctx.n).fill(0);
  }

  return createMatchScreen(deps, {
    title: 'Pişti',
    game: pisti,
    players: () => settings.get('pistiPlayers'),
    askPlayers: { key: 'pistiPlayers', options: [2, 4] },
    reset() {
      disp = null;
      note = '';
    },

    async onStart(ctx) {
      const v = ctx.view(0);
      const top = v.pile[0];
      const base = baseIds(v.pileSize - v.pile.length);
      [...base, top].forEach((c) => ctx.pend.add(c));
      v.hand.forEach((c) => ctx.pend.add(c));
      ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
      disp = { pile: [top], hidden: base.length, hand: v.hand, sizes: v.handSizes, deck: 52, caps: v.capCounts, points: v.points };
      ctx.render();
      const from = ctx.deckBox();
      // yere: 3 kapalı, sonra üstteki açık
      for (const [k, id] of [...base, top].entries()) {
        const face = id === top;
        await ctx.A.fly(ctx.cardEl(null), from, ctx.cardBox(id), { duration: ctx.A.dur('deal'), easing: ctx.A.EASE.land, flipTo: face ? ctx.cardEl(ctx.parseCard(id)) : null, delay: k ? 0 : 0 });
        ctx.reveal(id);
      }
      await choreo.deal(ctx, handOrder(ctx, v.hand), { from });
      disp = null;
    },

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const ev = e.event;
      const seat = e.seat;
      const c = e.move.c;
      const bv = pisti.viewFor(before, 0);
      const v = pisti.viewFor(e.state, 0);
      const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);
      const sizes = bv.handSizes.slice();
      sizes[seat]--;
      disp = {
        pile: [...bv.pile, c],
        hidden: bv.pileSize - bv.pile.length,
        hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand,
        sizes,
        deck: bv.deckLeft,
        caps: bv.capCounts,
        points: bv.points,
      };
      note = '';
      ctx.pend.add(c);
      ctx.render();
      await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land });
      ctx.reveal(c);

      const taker = ev.capture ? seat : e.state.over && disp.pile.length ? (before.lastCap >= 0 ? before.lastCap : seat) : -1;
      if (taker >= 0) {
        if (ev.capture) note = ev.bonus ? `${ctx.name(seat)} pişti yaptı! +${ev.bonus}` : `${ctx.name(seat)} yerdekileri aldı`;
        else note = `Yerde kalanlar ${ctx.name(taker)}'e`;
        ctx.render();
        await ctx.wait(ev.bonus ? 950 : 'read');
        const ids = [...baseIds(disp.hidden), ...disp.pile].filter((id) => ctx.body.querySelector(`[data-card="${id}"]`));
        await choreo.collect(ctx, ids, taker);
        disp = { ...disp, pile: [], hidden: 0, caps: v.capCounts, points: v.points };
        ctx.render();
      }
      if (ev.dealt) await dealHands(ctx, v, bv.deckLeft);
      disp = null;
    },

    render(ctx) {
      const v = ctx.view(0);
      const d = disp || {};
      const pile = d.pile ?? v.pile;
      const hidden = d.hidden ?? v.pileSize - v.pile.length;
      const hand = d.hand ?? v.hand;
      const sizes = d.sizes ?? v.handSizes;
      const deck = d.deck ?? v.deckLeft;
      const caps = d.caps ?? v.capCounts;
      const points = d.points ?? v.points;
      const { jitter } = ctx.A;
      const nodes = baseIds(hidden).map((id, k) => {
        const j = jitter(id, 10);
        return ctx.pileCard(id, { dx: j.dx, dy: j.dy, rot: j.rot, z: k + 1, back: true });
      });
      pile.slice(-6).forEach((c, k) => {
        const j = jitter(c, 12);
        nodes.push(ctx.pileCard(c, { dx: j.dx, dy: j.dy, rot: j.rot, z: 10 + k }));
      });
      const total = pile.length + hidden;
      const my = ctx.awaiting && !disp;
      const area = h('div', { class: 'center' }, ctx.deck(deck), nodes, total ? h('div', { class: 'cnt' }, `${total} kart`) : null);
      const info = h('div', { class: 'kinfo' },
        h('div', { class: 'kg' }, note || (my ? '▶ Sıra sende' : disp ? '\u00a0' : v.turn === 0 ? 'Sıra sende' : `${ctx.name(v.turn)} oynuyor`)),
        h('div', { class: 'sub' }, `Puanın ${points[0]} · aldığın kart ${caps[0]}`));
      return [
        ctx.table({ area, info, count: (i) => sizes[i], chipSub: (i) => `${points[i]} puan` }),
        ctx.handRow(hand, { can: () => my, onTap: (c, can) => can && ctx.respond({ c }), onDrop: (c) => (my ? (ctx.respond({ c }), true) : false) }),
      ];
    },

    endHead: (w) => (w.includes(0) ? (w.length > 1 ? 'Berabere' : 'Kazandın!') : 'Oyun bitti'),
    fmtScore: (s) => `${s} puan`,
    rules: (h) => h('div', { class: 'rules' },
      h('p', {}, 'Herkese 4 kart dağıtılır, yerde 4 kart vardır (üstteki açık). Yerdeki üst kartla aynı sayıyı ya da valeyi atan, yerdeki bütün kartları alır.'),
      h('p', {}, 'Yerde tek kart varken aynı sayıyı atarsan PİŞTİ: 10 puan. Valeyle vale pişti 20 puan.'),
      h('p', {}, 'Puanlar: vale 1, as 1, sinek 2 → 2, karo 10 → 3, en çok kart toplayan 3 puan. Oyun sonunda yerde kalanlar son alana gider.'),
      h('p', {}, 'Kartı oynamak için üstüne dokunman yeterli.')),
  });
}
