// Fanti masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (desteden yere 4 açık kart, sonra herkese 4'er) → oynama (elden/kutudan masadaki boş yuvaya) →
// alma (okuma molası, atılan kart ve aldıkları alanın destesine) → yeni 4'er kart (desteden) → dağıtım sonu: kalanlar son alana,
// puan özeti → yeni deste dağıtılır. Yerdeki kartlar 11 hesabı yapılabilsin diye üst üste değil, ayrı yuvalarda durur.
import fanti from '../games/fanti.js';
import { createMatchScreen, choreo } from './table-kit.js';
import { RANK_NAME_TR, SUIT_NAME_TR } from '../core/cards.js';

const cname = (c) => `${SUIT_NAME_TR[c[0]]} ${RANK_NAME_TR[+c.slice(1)] || c.slice(1)}`;

export function createFantiScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { table, hand, sizes, deck, caps, totals }
  let note = '';
  let slots = new Map(); // masadaki kart → yuva (kart masada kaldıkça yeri değişmez)
  let selected = null; // elde seçilen kart (birden çok alma seçeneği varken)
  let picks = new Set(); // yerden seçilen kartlar

  const slotOf = (c) => {
    if (!slots.has(c)) {
      const used = new Set(slots.values());
      let i = 0;
      while (used.has(i)) i++;
      slots.set(c, i);
    }
    return slots.get(c);
  };
  const spot = (c) => {
    const i = slotOf(c);
    const col = i % 4;
    const row = Math.floor(i / 4) % 3;
    const layer = Math.floor(i / 12);
    const j = { dx: ((i * 37) % 7) - 3, rot: ((i * 53) % 9) - 4 };
    return { dx: 30 + (col - 1.5) * 46 + j.dx + layer * 8, dy: (row - 1) * 60 - 8 + layer * 8, rot: j.rot, z: i + 1 };
  };

  function dealOrder(ctx, hand) {
    const order = [];
    for (let r = 0; r < 4; r++) for (let k = 1; k <= ctx.n; k++) {
      const seat = k % ctx.n;
      order.push({ seat, card: seat === 0 ? hand[r] : null });
    }
    return order;
  }

  /** Yeni deste: yere 4 açık kart, sonra eller */
  async function dealRound(ctx, v) {
    const { A } = ctx;
    slots = new Map();
    v.table.forEach((c) => ctx.pend.add(c));
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    disp = { table: v.table, hand: v.hand, sizes: v.handSizes, deck: 52, caps: v.capCounts, totals: v.totals };
    ctx.render();
    for (const c of v.table) {
      await A.fly(ctx.cardEl(null), ctx.deckBox(), ctx.cardBox(c), { duration: A.dur('deal'), easing: A.EASE.land, flipTo: ctx.cardEl(ctx.parseCard(c)) });
      ctx.reveal(c);
    }
    disp.deck = 48;
    await choreo.deal(ctx, dealOrder(ctx, v.hand), { from: ctx.deckBox() });
    ctx.adj = Array(ctx.n).fill(0);
    disp = null;
  }

  async function dealHands(ctx, v, deckBefore) {
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    disp = { ...disp, hand: v.hand, sizes: v.handSizes, deck: deckBefore };
    ctx.render();
    await choreo.deal(ctx, dealOrder(ctx, v.hand), { from: ctx.deckBox() });
    ctx.adj = Array(ctx.n).fill(0);
  }

  return createMatchScreen(deps, {
    title: 'Fanti',
    game: fanti,
    players: () => settings.get('fantiPlayers'),
    askPlayers: { key: 'fantiPlayers', options: [2, 4] },
    reset() {
      disp = null;
      note = '';
      slots = new Map();
      selected = null;
      picks = new Set();
    },
    onTurn() {
      selected = null;
      picks = new Set();
    },
    onStart: (ctx) => dealRound(ctx, ctx.view(0)),

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const ev = e.event;
      const seat = e.seat;
      const c = e.move.c;
      const bv = fanti.viewFor(before, 0);
      const re = ev.roundEnd;
      const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);
      const sizes = bv.handSizes.slice();
      sizes[seat]--;
      disp = { table: [...bv.table, c], hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand, sizes, deck: bv.deckLeft, caps: bv.capCounts, totals: bv.totals };
      note = '';
      ctx.pend.add(c);
      ctx.render();
      await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land });
      ctx.reveal(c);
      // 1) alma
      if (ev.take.length) {
        const r = +c.slice(1);
        note = r === 11 ? `${ctx.name(seat)}: Fanti! ${ev.take.length} kart aldı` : r >= 12 ? `${ctx.name(seat)} ${RANK_NAME_TR[r].toLowerCase()} aldı` : `${ctx.name(seat)} 11 yaptı: ${[c, ...ev.take].map((x) => (+x.slice(1) === 14 ? 1 : +x.slice(1))).join(' + ')}`;
        ctx.render();
        await ctx.wait('read');
        await choreo.collect(ctx, [c, ...ev.take], seat);
        [c, ...ev.take].forEach((x) => slots.delete(x));
        const caps = disp.caps.slice();
        caps[seat] += ev.take.length + 1;
        disp = { ...disp, table: disp.table.filter((x) => x !== c && !ev.take.includes(x)), caps };
        ctx.render();
      }
      // 2) deste bitti: kalanlar son alana, puan özeti, yeni deste
      if (re) {
        if (re.rest.length) {
          note = `Yerde kalanlar ${ctx.name(re.restTo)}'e`;
          ctx.render();
          await ctx.wait('read');
          await choreo.collect(ctx, re.rest, re.restTo);
        }
        note = '';
        disp = { ...disp, table: [], caps: re.caps, totals: re.totals, deck: 0 };
        slots = new Map();
        ctx.render();
        const rows = re.pts.map((p, i) => h('div', { class: 'drow' },
          h('span', {}, `${ctx.name(i)} · ${re.caps[i]} kart, ${re.clubs[i]} sinek${re.specials[i].length ? `, ${re.specials[i].map(cname).join(', ')}` : ''}`),
          h('b', { class: 'pos' }, `+${p} → ${re.totals[i]}`)));
        await ctx.ask(h('div', {}, rows), `Deste ${re.round + 1} bitti`);
        if (!fanti.isOver(e.state)) await dealRound(ctx, fanti.viewFor(e.state, 0));
        disp = null;
        return;
      }
      if (ev.dealt) await dealHands(ctx, fanti.viewFor(e.state, 0), bv.deckLeft);
      disp = null;
    },

    render(ctx) {
      const v = ctx.view(0);
      const d = disp || {};
      const table = d.table ?? v.table;
      const hand = d.hand ?? v.hand;
      const sizes = d.sizes ?? v.handSizes;
      const deck = d.deck ?? v.deckLeft;
      const caps = d.caps ?? v.capCounts;
      const totals = d.totals ?? v.totals;
      const my = ctx.awaiting && !disp;
      const moves = my ? fanti.legalMoves(ctx.state, 0) : [];
      const optsOf = (c) => moves.filter((m) => m.c === c);
      const selOpts = selected ? optsOf(selected) : [];
      const cand = new Set(selOpts.flatMap((m) => m.take));
      const nodes = table.map((c) => {
        const n = ctx.pileCard(c, spot(c));
        if (picks.has(c)) n.classList.add('pick');
        if (cand.has(c)) {
          n.classList.add('cand');
          n.addEventListener('click', () => {
            if (picks.has(c)) picks.delete(c);
            else picks.add(c);
            const hit = selOpts.find((m) => m.take.length === picks.size && m.take.every((x) => picks.has(x)));
            if (hit) {
              selected = null;
              picks = new Set();
              ctx.respond(hit);
            } else ctx.render();
          });
        }
        return n;
      });
      const area = h('div', { class: 'center fantiarea' }, ctx.deck(deck), nodes);
      const info = h('div', { class: 'kinfo' },
        h('div', { class: 'kg' }, note || (my && selected ? `▶ Yerden toplamı ${11 - (+selected.slice(1) === 14 ? 1 : +selected.slice(1))} eden kartlara dokun` : my ? '▶ Sıra sende' : disp ? '\u00a0' : `${ctx.name(v.turn)} oynuyor`)),
        h('div', { class: 'sub' }, `Puanın ${totals[0]} / ${v.target} · bu destede aldığın ${caps[0]} kart`));
      return [
        ctx.table({ area, info, count: (i) => sizes[i], chipSub: (i) => `${totals[i]} puan` }),
        ctx.handRow(hand, {
          can: () => my,
          selected,
          onTap: (c, can) => {
            if (!can) return;
            const opts = optsOf(c);
            if (opts.length <= 1) {
              selected = null;
              picks = new Set();
              ctx.respond(opts[0] || { c, take: [] });
              return;
            }
            // birden çok 11 seçeneği: önce kart kalkar, sonra yerden alınacaklar seçilir (tekrar dokunmak seçimi bırakır)
            selected = selected === c ? null : c;
            picks = new Set();
            ctx.render();
          },
        }),
      ];
    },

    endHead: (w) => (w.includes(0) ? 'Kazandın!' : 'Oyun bitti'),
    fmtScore: (s) => `${s} puan`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, 'Yere 4 açık kart, herkese 4\'er kart dağıtılır. Attığın kartla yerdeki kartlardan toplamı 11 edenleri alırsın (as 1 sayılır). Örneğin yerde 3 ve 6 varken 2 atarsan ikisini alırsın.'),
      h2('p', {}, 'Kızı yalnız kız, papazı yalnız papaz alır. Vale (fanti) yerdeki kız ve papaz dışında bütün kartları alır. Alamıyorsan kartın yere kalır.'),
      h2('p', {}, 'Kartına dokun: tek seçenek varsa hemen oynanır. Birden çok şekilde 11 yapabiliyorsan kart kalkar; yerden alacağın kartlara dokun, toplam tutunca alırsın. Alabiliyorsan almak zorundasın. Eller bitince desteden yeniden 4\'er kart dağıtılır; deste bitince yerde kalanlar son alana gider.'),
      h2('p', {}, 'Her destede puan: sinek 2 = 1, karo 10 = 1, en çok sinek = 1, en çok kart = 2 (eşitlikte 1\'er). 2 kişide 21, 4 kişide 11 puana ilk ulaşan kazanır.')),
  });
}
