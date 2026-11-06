// Konken masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (desteden 10'ar, başlayana 11) → çekme (desteden kapalı / yerden açık, çekene) →
// atma (elden/kutudan yere açık) → biten olursa eller açılır, cezalar okunur → bütün kartlar desteye toplanır → yeni dağıtım.
// Elin her zaman perler önde, açıkta kalanlar sonda olacak şekilde dizilir (yer değiştirme FLIP ile kayar).
import konken, { solve, finishWith, isJoker, DEALS_CEZA, WIN_GALIBIYET } from '../games/konken.js';
import { createMatchScreen, choreo } from './table-kit.js';
import { RANK_NAME_TR, SUIT_NAME_TR } from '../core/cards.js';

const cname = (c) => (isJoker(c) ? 'Joker' : `${SUIT_NAME_TR[c[0]]} ${RANK_NAME_TR[parseInt(c.slice(1), 10)] || parseInt(c.slice(1), 10)}`);
const KIND = { normal: 'bitti', joker: 'joker atarak bitti (cezalar 2 kat)', cifte: 'çifte bitti (cezalar 2 kat)', 'cifte-joker': 'çifte ve joker ile bitti (cezalar 4 kat)', void: 'deste bitti, kimse bitemedi' };

export function createKonkenScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { hand, sizes, pile, deck }
  let selected = null;
  let note = '';

  const arrange = (hand) => {
    const r = solve(hand);
    const inMeld = r.melds.flat();
    return { order: [...inMeld, ...hand.filter((c) => !inMeld.includes(c))], r };
  };
  const pileSpot = (ctx, c) => {
    const j = ctx.A.jitter(c, 10);
    return { dx: 36 + j.dx, dy: j.dy, rot: j.rot };
  };

  async function dealRound(ctx, st) {
    const v = konken.viewFor(st, 0);
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    disp = { hand: v.hand, sizes: v.handSizes, pile: [], pileN: 0, deck: 106 };
    ctx.render();
    ctx.resetOrder();
    const mine = arrange(v.hand).order;
    let k = 0;
    const order = [];
    for (let r = 0; r < 10; r++) for (let i = 0; i < ctx.n; i++) {
      const seat = (st.starter + i) % ctx.n;
      order.push({ seat, card: seat === 0 ? mine[k++] : null });
    }
    order.push({ seat: st.starter, card: st.starter === 0 ? mine[k++] : null });
    await choreo.deal(ctx, order, { from: ctx.deckBox() });
    ctx.adj = Array(ctx.n).fill(0);
    disp = null;
  }

  return createMatchScreen(deps, {
    title: 'Konken',
    arrange: true,
    tally: (s) => (s.scoring === 'ceza' ? { head: 'Ceza', totals: s.totals } : { head: 'Galibiyet', totals: s.wins }),
    game: konken,
    players: () => settings.get('konkenPlayers'),
    askPlayers: { key: 'konkenPlayers', options: [2, 3, 4] },
    makeConfig: () => ({ konken: { scoring: settings.get('konkenScoring'), joker: settings.get('konkenJoker'), cifte: settings.get('konkenCifte') } }),
    maxThink: 550,
    reset() {
      disp = null;
      selected = null;
      note = '';
    },
    onTurn() {
      selected = null;
    },
    onStart: (ctx) => dealRound(ctx, ctx.state),

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const seat = e.seat;
      const ev = e.event;
      const bv = konken.viewFor(before, 0);
      selected = null;
      note = '';
      if (e.move.t === 'draw') {
        const fromPile = e.move.from === 'pile';
        const card = fromPile ? bv.pileTop : seat === 0 ? e.state.drew.card : null;
        const src = fromPile ? ctx.cardBox(bv.pileTop) : ctx.deckBox();
        const sizes = bv.handSizes.slice();
        disp = { hand: seat === 0 ? [...bv.hand, card] : bv.hand, sizes, pile: fromPile ? bv.pile.slice(0, -1) : bv.pile, pileN: bv.pileSize - (fromPile ? 1 : 0), deck: fromPile ? bv.deckLeft : Math.max(0, bv.deckLeft - 1) };
        if (seat === 0) ctx.pend.add(card);
        if (fromPile) ctx.hide(bv.pileTop);
        ctx.render();
        const to = seat === 0 ? ctx.cardBox(card) : ctx.seatBox(seat);
        // desteden: kapalı gelir (sana geliyorsa yolda açılır); yerden: açık gider
        if (fromPile) await ctx.fly(card, src, to, { duration: A.dur('pass'), easing: A.EASE.move });
        else await ctx.fly(card, src, to, { duration: A.dur('deal') * 1.4, easing: A.EASE.land, reveal: seat === 0 });
        if (seat === 0) ctx.reveal(card);
        else ctx.bumpCount(seat, 1);
        if (fromPile && seat !== 0) note = `${ctx.name(seat)} yerden ${cname(card)} aldı`;
        disp = null;
        return;
      }
      // atma
      const c = e.move.c;
      const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);
      const sizes = bv.handSizes.slice();
      sizes[seat]--;
      disp = { hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand, sizes, pile: [...bv.pile, c], pileN: bv.pileSize + 1, deck: bv.deckLeft };
      ctx.pend.add(c);
      ctx.render();
      await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land });
      ctx.reveal(c);
      const re = ev.roundEnd;
      if (!re) {
        disp = null;
        return;
      }
      // el bitti: sonuç
      note = re.winner >= 0 ? `${ctx.name(re.winner)} ${KIND[re.kind]}!` : KIND.void;
      ctx.render();
      await ctx.wait(900);
      const rows = re.delta.map((d, i) => h('div', { class: 'drow' },
        h('span', {}, `${ctx.name(i)}${i === re.winner ? ' — bitti' : re.shown[i].left.length ? ` — açıkta: ${re.shown[i].left.map(cname).join(', ')}` : ''}`),
        h('b', { class: d ? 'neg' : 'pos' }, re.round !== undefined && settings.get('konkenScoring') === 'galibiyet' ? `${re.wins[i]} galibiyet` : d ? `+${d} → ${re.totals[i]}` : `0 → ${re.totals[i]}`)));
      await ctx.ask(h('div', {}, rows), `El ${re.round + 1}`);
      // bütün kartlar desteye toplanır
      const to = ctx.deckBox();
      const ids = [...disp.pile.slice(-5), ...disp.hand].filter((id) => ctx.body.querySelector(`[data-card="${id}"]`));
      const jobs = ids.map((id, k) => {
        const from = ctx.cardBox(id);
        ctx.hide(id);
        return A.fly(ctx.cardEl(ctx.parseCard(id)), from, to, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * 25, flipTo: ctx.cardEl(null) });
      });
      for (let i = 1; i < ctx.n; i++) {
        const from = ctx.seatBox(i);
        for (let k = 0; k < Math.min(disp.sizes[i], 6); k++) jobs.push(A.sleep(k * 50).then(() => {
          if (k === Math.min(disp.sizes[i], 6) - 1) ctx.bumpCount(i, -disp.sizes[i]);
          return A.fly(ctx.cardEl(null), from, to, { duration: A.dur('collect'), easing: A.EASE.leave });
        }));
      }
      await Promise.all(jobs);
      note = '';
      if (!konken.isOver(e.state)) await dealRound(ctx, e.state);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const v = ctx.view(0);
      const d = disp || {};
      const hand = d.hand ?? v.hand;
      const sizes = d.sizes ?? v.handSizes;
      const pile = d.pile ?? v.pile;
      const deck = d.deck ?? v.deckLeft;
      const my = ctx.awaiting && !disp && v.turn === 0 && !s.over;
      const r = arrange(hand).r;
      const order = ctx.ordered(hand, (cs) => arrange(cs).order);
      const pileNodes = pile.slice(-5).map((c, k) => ctx.pileCard(c, { ...pileSpot(ctx, c), z: k + 1 }));
      const deckNode = ctx.deck(Math.max(deck, 0) || 0);
      deckNode.classList.add('nearpile'); // deste yerdeki kartların hemen solunda: iki çekme yeri yan yana
      if (my && v.phase === 'draw') {
        ctx.tapDraw(deckNode, () => ctx.respond({ t: 'draw', from: 'deck' }));
        if (v.pileTop && pileNodes.length) ctx.tapDraw(pileNodes[pileNodes.length - 1], () => ctx.respond({ t: 'draw', from: 'pile' }));
      }
      const area = h('div', { class: 'center' }, deckNode, pileNodes,
        h('div', { class: 'cnt' }, `Deste ${deck} · yerde ${d.pileN ?? v.pileSize}`));
      const canFinish = my && v.phase === 'discard' ? hand.find((c) => finishWith(hand, c, v.opts)) : null;
      let head;
      if (note) head = note;
      else if (my && v.phase === 'draw') head = '▶ Desteye ya da yerdeki karta dokun';
      else if (my) head = canFinish ? `▶ Bitebilirsin: ${cname(canFinish)} at` : '▶ Atacağın kartı seç';
      else head = disp ? ' ' : `${ctx.name(v.turn)} oynuyor`;
      const score = v.scoring === 'ceza' ? `Cezan ${v.totals[0]} · El ${Math.min(v.round + 1, DEALS_CEZA)}/${DEALS_CEZA}` : `Galibiyetin ${v.wins[0]}/${WIN_GALIBIYET} · El ${v.round + 1}`;
      const info = h('div', { class: 'kinfo' },
        h('div', { class: 'kg' }, head),
        h('div', { class: 'sub' }, `${r.melds.length} grup · açıkta ${r.left.length} kart (ceza ${r.dead})`),
        h('div', { class: 'sub' }, score));
      const out = [ctx.table({
        area, info, count: (i) => sizes[i],
        chipSub: (i) => (v.scoring === 'ceza' ? `ceza ${v.totals[i]}` : `${v.wins[i]} galibiyet`),
        chipCls: (i) => (!disp && v.turn === i ? 'turn' : ''),
      })];
      out.push(ctx.handRow(order, {
        drag: true,
        can: () => my && v.phase === 'discard',
        selected,
        onTap: (c, can) => {
          if (!can) return;
          if (selected !== c) {
            selected = c;
            ctx.render();
            return;
          }
          selected = null;
          ctx.respond({ t: 'discard', c });
        },
      }));
      return out;
    },

    endHead: (w) => (w.includes(0) ? 'Kazandın!' : 'Oyun bitti'),
    fmtScore: (sc, i, ctx) => (settings.get('konkenScoring') === 'ceza' ? `${-sc} ceza` : `${sc} galibiyet`),
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, '2 deste ve 2 joker (106 kart). Herkese 10 kart, başlayana 11 kart dağıtılır. Başlayan ilk turda çekmeden bir kart atar.'),
      h2('p', {}, 'Sıran gelince desteden ya da yerdeki son atılan karttan bir kart çekersin, sonra bir kart atarsın. Kartı atmak için bir kez dokun (kalkar), tekrar dokun (atılır).'),
      h2('p', {}, 'Per: aynı sayıdan farklı renkte 3-4 kart. Seri: aynı renkten ardışık 3 ya da daha fazla kart (as 2\'nin önüne ya da papazın arkasına gelir). Joker her kartın yerine geçer. Elin otomatik dizilir: perler önde, açıkta kalanlar sonda.'),
      h2('p', {}, 'Elindeki 10 kart tamamen per ve seri olunca son kartını atıp bitersin. Ayarlardan açılırsa: joker atarak bitmek ve çifte (aynı karttan 5 çift) cezaları iki katına çıkarır.'),
      h2('p', {}, 'Ceza modunda: biten 0, diğerleri açıkta kalan kartları kadar ceza yer (2-10 kendi değeri, resimler ve as 10, joker 25). 11 el sonunda en az cezası olan kazanır. Galibiyet modunda: her eli bitiren 1 (özel bitişte 2) puan alır, 5 puana ilk ulaşan kazanır.')),
  });
}
