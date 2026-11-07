// Gin Rummy masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (10'ar, dağıtmayandan başlayarak) → açık kart desteden yere → çekme (desteden kapalı / yerden açık) →
// atma → kapı/gin: eller açılır, perler ve işlenen kartlar sonuçta gösterilir → kartlar desteye toplanır → yeni dağıtım.
// Elin sırası oyuncunundur (sürükle / Düzenle); ilk dizilişte perler önde.
import gin, { solve, KNOCK_MAX, TARGET, BOX_BONUS } from '../games/gin.js';
import { createMatchScreen, choreo } from './table-kit.js';
import { RANK_NAME_TR, SUIT_NAME_TR } from '../core/cards.js';

const cname = (c) => `${SUIT_NAME_TR[c[0]]} ${RANK_NAME_TR[parseInt(c.slice(1), 10)] || parseInt(c.slice(1), 10)}`;
const KIND = { gin: 'GIN yaptı', knock: 'kapı dedi', undercut: 'kapı dedi ama alt kesildi', void: 'deste bitti, el berabere' };

export function createGinScreen(deps) {
  const { h } = deps;
  let disp = null;
  let selected = null;
  let note = '';

  const arrange = (hand) => {
    const r = solve(hand);
    const inMeld = r.melds.flat();
    return [...inMeld, ...hand.filter((c) => !inMeld.includes(c))];
  };
  const pileSpot = (ctx, c) => {
    const j = ctx.A.jitter(c, 10);
    return { dx: 36 + j.dx, dy: j.dy, rot: j.rot };
  };

  async function dealRound(ctx, st) {
    const v = gin.viewFor(st, 0);
    v.hand.forEach((c) => ctx.pend.add(c));
    const up = v.pileTop;
    ctx.pend.add(up);
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    disp = { hand: v.hand, sizes: v.handSizes, pile: [up], pileN: 1, deck: 52 };
    ctx.render();
    ctx.resetOrder();
    const mine = arrange(v.hand);
    let k = 0;
    const order = [];
    const nd = 1 - st.dealer;
    for (let r = 0; r < 10; r++) for (const seat of [nd, st.dealer]) order.push({ seat, card: seat === 0 ? mine[k++] : null });
    await choreo.deal(ctx, order, { from: ctx.deckBox() });
    // açık kart: desteden yere, yolda açılır
    await ctx.fly(up, ctx.deckBox(), ctx.cardBox(up), { duration: ctx.A.dur('deal') * 1.5, easing: ctx.A.EASE.land, reveal: true });
    ctx.reveal(up);
    ctx.adj = [0, 0];
    disp = null;
  }

  /** Sonuç penceresi: iki elin perleri, dağınıkları ve işlenen kartlar */
  function handView(ctx, title, part, lays) {
    const mini = (c, cls = '') => h('span', { class: `gmc${cls}` }, ctx.cardEl(ctx.parseCard(c)));
    return h('div', { class: 'gres' },
      h('div', { class: 'gtitle' }, title),
      h('div', { class: 'gmelds' },
        part.melds.map((m) => h('span', { class: 'gm' }, m.map((c) => mini(c)))),
        part.left.length ? h('span', { class: 'gm dead' }, part.left.map((c) => mini(c))) : null),
      lays && lays.length ? h('div', { class: 'hint' }, `İşledi: ${lays.map((l) => cname(l.c)).join(', ')}`) : null);
  }

  return createMatchScreen(deps, {
    title: 'Gin Rummy',
    arrange: true,
    game: gin,
    players: () => 2,
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
      const mv = e.move;
      const bv = gin.viewFor(before, 0);
      selected = null;
      note = '';
      if (mv.t === 'pass') {
        note = `${ctx.name(seat)} açık kartı almadı`;
        ctx.render();
        await ctx.wait(700);
        note = '';
        return;
      }
      if (mv.t === 'take' || mv.t === 'draw') {
        const fromPile = mv.t === 'take' || mv.from === 'pile';
        const card = fromPile ? bv.pileTop : seat === 0 ? e.state.lastEvent.c : null;
        const src = fromPile ? ctx.cardBox(bv.pileTop) : ctx.deckBox();
        disp = { hand: seat === 0 ? [...bv.hand, card] : bv.hand, sizes: bv.handSizes.slice(), pile: fromPile ? bv.pile.slice(0, -1) : bv.pile, pileN: bv.pileSize - (fromPile ? 1 : 0), deck: fromPile ? bv.deckLeft : bv.deckLeft - 1 };
        if (seat === 0) ctx.pend.add(card);
        if (fromPile) ctx.hide(bv.pileTop);
        ctx.render();
        const to = seat === 0 ? ctx.cardBox(card) : ctx.seatBox(seat);
        if (fromPile) await ctx.fly(card, src, to, { duration: A.dur('pass'), easing: A.EASE.move });
        else await ctx.fly(card, src, to, { duration: A.dur('deal') * 1.4, easing: A.EASE.land, reveal: seat === 0 });
        if (seat === 0) ctx.reveal(card);
        else ctx.bumpCount(seat, 1);
        if (fromPile && seat !== 0) note = `${ctx.name(seat)} yerden ${cname(card)} aldı`;
        disp = null;
        return;
      }
      // atma / kapı
      const c = mv.c;
      const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);
      const sizes = bv.handSizes.slice();
      sizes[seat]--;
      disp = { hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand, sizes, pile: [...bv.pile, c], pileN: bv.pileSize + 1, deck: bv.deckLeft };
      ctx.pend.add(c);
      ctx.render();
      await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land });
      ctx.reveal(c);
      const re = e.event.roundEnd;
      if (!re) {
        disp = null;
        return;
      }
      note = re.kind === 'void' ? KIND.void : `${ctx.name(re.knocker)} ${KIND[re.kind]}!`;
      ctx.render();
      await ctx.wait(900);
      let body;
      if (re.kind === 'void') body = h('div', { class: 'hint' }, 'Destede 2 kart kaldı ve kimse kapı demedi: puan yok, aynı kişi yeniden dağıtır.');
      else {
        const def = 1 - re.knocker;
        const res = re.kind === 'gin' ? `Gin: ${GIN_TXT(re)}` : re.kind === 'undercut' ? `Alt kesme: ${ctx.name(def)}'in cezası ${re.def.dead} ≤ ${re.knock.dead}. ${ctx.name(def)} ${re.pts} puan aldı (25 bonus + fark).` : `Kapı: ${re.def.dead} − ${re.knock.dead} = ${re.pts} puan ${ctx.name(re.knocker)}'e.`;
        body = h('div', {},
          handView(ctx, `${ctx.name(re.knocker)} (${re.kind === 'gin' ? 'gin' : `kapı, ceza ${re.knock.dead}`})`, re.knock),
          handView(ctx, `${ctx.name(def)} (ceza ${re.def.dead})`, re.def, re.def.lays),
          h('div', { class: 'hint' }, res),
          h('div', { class: 'drow' }, h('span', {}, 'Puan'), h('b', {}, `${ctx.name(0)} ${re.scores[0]} · ${ctx.name(1)} ${re.scores[1]} (hedef ${TARGET})`)));
      }
      await ctx.ask(body, `El ${re.round + 1}`);
      // kartlar desteye toplanır
      const to = ctx.deckBox();
      const ids = [...disp.pile.slice(-5), ...disp.hand].filter((id) => ctx.body.querySelector(`[data-card="${id}"]`));
      const jobs = ids.map((id, k) => {
        const from = ctx.cardBox(id);
        ctx.hide(id);
        return A.fly(ctx.cardEl(ctx.parseCard(id)), from, to, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * 25, flipTo: ctx.cardEl(null) });
      });
      const from = ctx.seatBox(1);
      const n1 = disp.sizes[1];
      for (let k = 0; k < Math.min(n1, 6); k++) jobs.push(A.sleep(k * 50).then(() => {
        if (k === Math.min(n1, 6) - 1) ctx.bumpCount(1, -n1);
        return A.fly(ctx.cardEl(null), from, to, { duration: A.dur('collect'), easing: A.EASE.leave });
      }));
      await Promise.all(jobs);
      note = '';
      if (!gin.isOver(e.state)) await dealRound(ctx, e.state);
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
      const r = solve(hand);
      const pileNodes = pile.slice(-5).map((c, k) => ctx.pileCard(c, { ...pileSpot(ctx, c), z: k + 1 }));
      const deckNode = ctx.deck(Math.max(deck, 0) || 0);
      deckNode.classList.add('nearpile');
      const top = pileNodes[pileNodes.length - 1];
      if (my && v.phase === 'first' && top) ctx.tapDraw(top, () => ctx.respond({ t: 'take' }));
      if (my && v.phase === 'draw') {
        ctx.tapDraw(deckNode, () => ctx.respond({ t: 'draw', from: 'deck' }));
        if (!v.forceDeck && v.pileTop && top) ctx.tapDraw(top, () => ctx.respond({ t: 'draw', from: 'pile' }));
      }
      const area = h('div', { class: 'center' }, deckNode, pileNodes, h('div', { class: 'cnt' }, `Deste ${deck} · yerde ${d.pileN ?? v.pileSize}`));
      const legal = my && v.phase === 'discard' ? gin.legalMoves(s, 0) : [];
      const knockable = (c) => legal.some((m) => m.t === 'knock' && m.c === c);
      let head;
      if (note) head = note;
      else if (my && v.phase === 'first') head = '▶ Açık kartı almak için ona dokun ya da pas de';
      else if (my && v.phase === 'draw') head = v.forceDeck ? '▶ Desteye dokun' : '▶ Desteye ya da yerdeki karta dokun';
      else if (my) {
        const gin0 = hand.find((c) => c !== v.took && solve(hand.filter((x) => x !== c)).dead === 0);
        head = gin0 ? `▶ GIN: ${cname(gin0)} atıp kapı de!` : legal.some((m) => m.t === 'knock') ? '▶ Kapı diyebilirsin: kartı seç' : '▶ Atacağın kartı seç';
      } else head = disp ? ' ' : `${ctx.name(v.turn)} oynuyor`;
      const info = h('div', { class: 'kinfo' },
        h('div', { class: 'kg' }, head),
        h('div', { class: 'sub' }, `Dağınık ${r.dead} (${r.left.length} kart) · kapı için ≤ ${KNOCK_MAX}`),
        h('div', { class: 'sub' }, `Puanın ${v.scores[0]} · rakip ${v.scores[1]} · hedef ${TARGET} · El ${v.round + 1}`));
      const out = [ctx.table({
        area, info, count: (i) => sizes[i],
        chipSub: (i) => `${v.scores[i]} puan`,
        chipCls: (i) => (!disp && v.turn === i && !s.over ? 'turn' : ''),
      })];
      if (my && v.phase === 'first') {
        // almak için karta dokunulur; panelde yalnız Pas (masayı kapatmasın diye dar)
        out.push(h('div', { class: 'announce panel narrow' }, h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'pass' }) }, 'Pas (almıyorum)')));
      }
      if (my && selected && knockable(selected)) {
        const dead = solve(hand.filter((x) => x !== selected)).dead;
        out.push(h('div', { class: 'announce panel' }, h('div', { class: 'pgrid two' },
          h('button', { class: 'btn', onclick: () => { const c = selected; selected = null; ctx.respond({ t: 'knock', c }); } }, dead === 0 ? `GIN! (${cname(selected)} at)` : `Kapı de (ceza ${dead})`),
          h('button', { class: 'btn', onclick: () => { const c = selected; selected = null; ctx.respond({ t: 'discard', c }); } }, `Sadece at`))));
      }
      out.push(ctx.handRow(ctx.ordered(hand, arrange), {
        drag: true,
        can: (c) => my && v.phase === 'discard' && c !== v.took,
        dim: my && v.phase === 'discard',
        selected,
        onDrop: (c) => {
          if (!(my && v.phase === 'discard' && c !== v.took)) return false;
          selected = null;
          ctx.respond({ t: 'discard', c });
          return true;
        },
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

    endHead: (w, ctx, res) => (w.includes(0) ? 'Kazandın!' : 'Oyun bitti'),
    fmtScore: (sc) => `${sc} puan`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, '52 kart, 2 kişi. Herkese 10 kart dağıtılır, bir kart yere açık konur. İlk turda önce dağıtmayan, sonra dağıtan bu açık kartı alabilir ya da pas der; ikisi de pas derse dağıtmayan desteden çeker.'),
      h2('p', {}, 'Sıran gelince desteye ya da yerdeki son karta dokunup çekersin, sonra bir kart atarsın (kartı seç, tekrar dokun). Yerden aldığın kartı aynı tur atamazsın. Kartları sürükleyip dizebilir, "Düzenle" ile per / renk / sayı sırasına koyabilirsin.'),
      h2('p', {}, 'Per: aynı sayıdan 3-4 kart. Seri: aynı renkten ardışık 3 ya da daha fazla kart; as yalnız 1 sayılır (A-2-3 olur, Q-K-A olmaz). Perlere girmeyen kartlar dağınıktır: as 1, 2-10 kendi değeri, resimler 10.'),
      h2('p', {}, `Kart atarken dağınıkların ${KNOCK_MAX} ya da azsa "Kapı" diyebilirsin. Eller açılır, rakip dağınıklarını senin perlerine işler. Rakibin cezası seninkinden fazlaysa farkı alırsın; eşit ya da azsa alt kesilirsin: rakip farkı + 25 alır. Hiç dağınığın yoksa GIN: rakibin cezası + 25 senin, rakip işleyemez.`),
      h2('p', {}, `Destede 2 kart kalınca kimse kapı demediyse el berabere. ${TARGET} puana ilk ulaşan kazanır: +100 oyun bonusu (rakip hiç el almadıysa 200), ayrıca iki taraf da aldığı her el için +${BOX_BONUS} alır.`)),
  });
}

function GIN_TXT(re) {
  return `rakibin cezası ${re.def.dead} + 25 bonus = ${re.pts} puan.`;
}
