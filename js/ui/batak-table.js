// Batak masası (ortak iskelet table-kit.js üzerinde). Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi King ile aynı: dağıtım → oynama → okuma molası → toplama → el sonu özeti → yeni dağıtım.
import batak, { SUITS, SUIT_TR, DEALS } from '../games/batak.js';
import { SUIT_SYMBOL } from '../core/cards.js';
import { createMatchScreen, choreo } from './table-kit.js';
import { SLOT } from './king-table.js';

export function createBatakScreen(deps) {
  const { h, counter } = deps;
  let selected = null;
  let disp = null; // { trick, hand, sizes, tricksWon }

  async function dealAnim(ctx, st) {
    const v = batak.viewFor(st, 0);
    disp = { trick: [], hand: v.hand, sizes: v.handSizes, tricksWon: [0, 0, 0, 0] };
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    ctx.render();
    const order = [];
    const first = (st.dealer + 1) % 4;
    for (let r = 0; r < 13; r++) for (let k = 0; k < 4; k++) {
      const seat = (first + k) % 4;
      order.push({ seat, card: seat === 0 ? v.hand[r] : null });
    }
    await choreo.deal(ctx, order, { from: ctx.centerBox() });
    disp = null;
    ctx.adj = [0, 0, 0, 0];
  }

  const contract = (ctx, s) => (s.bidder < 0 ? '' : `${ctx.name(s.bidder)}: ${s.high}${s.trump ? ` · Koz ${SUIT_SYMBOL[s.trump]}` : ''}`);

  function sheet(ctx) {
    const s = ctx.state;
    if (!s) return;
    const rows = s.sheet.map((r) =>
      h('tr', {}, h('td', {}, r.n + 1), h('td', {}, `${ctx.name(r.bidder).slice(0, 5)} ${r.bid}${SUIT_SYMBOL[r.trump]} ${r.made ? '✓' : '✗'}`),
        r.delta.map((d) => h('td', { class: d < 0 ? 'neg' : 'pos' }, d))));
    ctx.dialog(h('table', { class: 'sheet' },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'İhale'), [0, 1, 2, 3].map((i) => h('th', {}, ctx.name(i).slice(0, 5))))),
      h('tbody', {}, rows),
      h('tfoot', {}, h('tr', {}, h('td', { colspan: 2 }, 'Toplam'), s.totals.map((t) => h('td', { class: t < 0 ? 'neg' : 'pos' }, t))))), [['Kapat']], 'Skor');
  }

  function bidPanel(ctx) {
    const legal = batak.legalMoves(ctx.state, 0);
    const btns = legal.map((m) => h('button', { class: 'btn', onclick: () => ctx.respond(m) }, m.v === 0 ? 'Pas' : String(m.v)));
    const s = ctx.state;
    return h('div', { class: 'announce panel' },
      h('b', {}, 'İhale: kaç el alırsın?'),
      h('div', { class: 'hint', style: 'color:#000' }, s.high ? `Şu an en yüksek: ${ctx.name(s.bidder)} ${s.high}` : 'Henüz kimse ihale vermedi'),
      h('div', { class: 'bidgrid' }, btns));
  }

  function trumpPanel(ctx) {
    const koz = SUITS.map((t) =>
      h('button', { class: `btn suit${t === 'H' || t === 'D' ? ' red' : ''}`, onclick: () => ctx.respond({ t: 'trump', s: t }) }, SUIT_SYMBOL[t], h('div', { class: 'tag' }, SUIT_TR[t])));
    return h('div', { class: 'announce panel' }, h('b', {}, `İhaleyi ${ctx.state.high} ile aldın, kozu seç`), h('div', { class: 'kozrow' }, koz));
  }

  return createMatchScreen(deps, {
    title: 'Batak',
    game: batak,
    players: () => 4,
    yazbozRow: (e) => {
      const d = e.event.dealEnd;
      return d ? { label: `${d.bid}${SUIT_SYMBOL[d.trump]}${d.made ? '✓' : '✗'}`, cells: d.delta } : null;
    },
    reset() {
      selected = null;
      disp = null;
    },
    onStart: (ctx) => dealAnim(ctx, ctx.state),
    onTurn() {
      selected = null;
    },

    async onMove(e, ctx, before) {
      selected = null;
      const { A } = ctx;
      if (e.move.t !== 'play') return;
      const seat = e.seat;
      const c = e.move.c;
      const bv = batak.viewFor(before, 0);
      const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);
      const trick = [...before.trick, { seat, card: c }];
      const sizes = bv.handSizes.slice();
      sizes[seat]--;
      disp = { trick, hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand, sizes, tricksWon: before.tricksWon };
      ctx.pend.add(c);
      ctx.render();
      await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land });
      ctx.reveal(c);
      const done = e.event.trickDone;
      if (!done) {
        disp = null;
        return;
      }
      await ctx.wait('read');
      await choreo.collect(ctx, trick.map((t) => t.card), done.winner);
      const tw = before.tricksWon.slice();
      tw[done.winner]++;
      disp = { ...disp, trick: [], tricksWon: tw };
      const de = e.event.dealEnd;
      if (!de) {
        disp = null;
        return;
      }
      disp = { trick: [], hand: [], sizes: [0, 0, 0, 0], tricksWon: tw };
      ctx.render();
      const rows = [0, 1, 2, 3].map((i) => h('div', { class: 'drow' }, h('span', {}, ctx.name(i)), h('b', { class: de.delta[i] < 0 ? 'neg' : 'pos' }, de.delta[i])));
      await ctx.ask(h('div', {}, h('div', {}, `${ctx.name(de.bidder)} ${de.bid} dedi, ${de.took} el aldı: ${de.made ? 'tuttu' : 'yattı'}`), rows), `El ${de.n + 1}/${DEALS}`);
      if (!batak.isOver(e.state)) await dealAnim(ctx, e.state);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const v = batak.viewFor(s, 0);
      const d = disp || {};
      const trick = d.trick ?? s.trick;
      const hand = d.hand ?? v.hand;
      const sizes = d.sizes ?? v.handSizes;
      const tw = d.tricksWon ?? s.tricksWon;
      const pile = trick.map((t, k) => {
        const [dx, dy, rot] = SLOT[ctx.pos(t.seat)];
        return ctx.pileCard(t.card, { dx, dy, rot, z: k + 1 });
      });
      const mine = ctx.awaiting && s.turn === 0 && !disp;
      const myPlay = mine && s.phase === 'play';
      const legal = myPlay ? new Set(batak.legalMoves(s, 0).map((m) => m.c)) : new Set();
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(s.dealNo + 1, DEALS)}/${DEALS}`),
        h('div', { class: 'kg' }, s.phase === 'bid' ? 'İhale' : s.phase === 'trump' ? 'Koz seçiliyor' : contract(ctx, s)),
        h('div', { class: 'sub' }, s.phase === 'bid' ? `${ctx.name(s.turn)} söylüyor` : s.phase === 'trump' ? `${ctx.name(s.bidder)} ${s.high} dedi` : myPlay ? '▶ Sıra sende' : `Aldığın el: ${tw[0]}`),
        h('div', { class: 'tot' }, 'Puanın ', counter(Math.abs(s.totals[0]), 4), s.totals[0] < 0 ? ' (−)' : ''));
      const area = h('div', { class: `center${s.phase !== 'play' && !trick.length ? ' compact' : ''}` }, pile);
      const sub = (i) => {
        if (s.phase === 'bid') return s.bids[i] === null ? (s.turn === i && !disp ? 'söylüyor…' : '') : s.bids[i] === 0 ? 'Pas' : `${s.bids[i]} dedi`;
        return `${tw[i]} el${s.bidder === i ? ` / ${s.high}` : ''}`;
      };
      const out = [ctx.table({
        area, info, count: (i) => sizes[i], chipSub: sub,
        chipCls: (i) => (!disp && s.phase !== 'over' && batak.currentActor(s) === i ? 'turn' : ''),
      })];
      if (mine && s.phase === 'bid') out.push(bidPanel(ctx));
      if (mine && s.phase === 'trump') out.push(trumpPanel(ctx));
      out.push(ctx.handRow(hand, {
        can: (c) => legal.has(c),
        selected,
        dim: myPlay,
        onTap: (c, can) => {
          if (!myPlay || !can) return;
          if (selected !== c && legal.size > 1) {
            selected = c;
            ctx.render();
            return;
          }
          selected = null;
          ctx.respond({ t: 'play', c });
        },
      }));
      return out;
    },

    endHead: (w) => (w.includes(0) && w.length === 1 ? 'Kazandın!' : w.includes(0) ? 'Berabere kazandın' : 'Oyun bitti'),
    rules: (h2) => h2('div', { class: 'rules' },
      h2('h4', {}, 'Nasıl oynanır'),
      h2('p', {}, '4 kişi, 13\'er kart, 5 el. Her elde herkes sırayla bir kez ihale verir: kaç el alacağını (en az 5) söyler ya da pas der. En yüksek ihaleyi veren kozu seçer ve ilk kartı atar.'),
      h2('p', {}, 'Renk verme zorunlu; veremiyorsan koz atmak zorundasın. Yükseltebiliyorsan masadaki en büyük karttan büyüğünü atmalısın. Herkes pas derse son söz sahibi 5 almak zorundadır.'),
      h2('h4', {}, 'Puanlar'),
      h2('p', {}, 'İhaleyi alan sözünü tutarsa ihale kadar puan alır, tutamazsa o kadar puan kaybeder. Diğer oyuncular aldıkları her el için +1 alır. 5 el sonunda en yüksek puanlı kazanır.'),
      h2('p', {}, 'Kartı oynamak için bir kez dokun (kalkar), tekrar dokun (oynanır). Tek yasal kart varsa tek dokunuş yeter.')),
  });
}
