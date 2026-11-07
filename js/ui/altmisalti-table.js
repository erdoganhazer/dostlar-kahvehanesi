// 66 masası (2 kişi). Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (desteden 3+3, sonra koz kartı açılıp destenin altına yan konur) → oynama → okuma molası →
// toplama (kazanana) → çekme (önce kazanan, sonra kaybeden; son kart açık koz) → el sonu özeti → kalan kartlar desteye → yeni dağıtım.
// Koz 9 değişimi: 9 elden koz yerine, koz kartı ele uçar. Kapatma: koz kartı yerinde kapanır.
import g66, { marriageOf, TARGET } from '../games/altmisalti.js';
import { SUIT_SYMBOL } from '../core/cards.js';
import { createMatchScreen, choreo } from './table-kit.js';

const SL = { bottom: [-8, 26, -5], top: [8, -26, 4] };
const SUIT_TR = { S: 'Maça', H: 'Kupa', D: 'Karo', C: 'Sinek' };
const REASON = { win: '66\'ya ulaştı', closeFail: 'kapatan 66\'ya ulaşamadı', noone: 'kimse 66 yapamadı, son eli alan kazandı' };

export function createAltmisaltiScreen(deps) {
  const { h } = deps;
  let disp = null; // { hand, sizes, trick, stock, trumpCard, trumpShown, closed, pts }
  let selected = null;
  let note = '';

  const scene = (v, extra = {}) => ({ hand: v.hand, sizes: v.handSizes, trick: v.trick, stock: v.stockLeft, trumpCard: v.trumpCard, closed: v.closed, pts: v.myPts, ...extra });

  async function dealAnim(ctx, st) {
    const { A } = ctx;
    const v = g66.viewFor(st, 0);
    disp = scene(v, { stock: 24, trumpShown: false, trick: [] });
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    ctx.render();
    const order = [];
    let k = 0;
    for (const n of [3, 3]) for (const seat of [st.leader, 1 - st.leader]) for (let i = 0; i < n; i++) order.push({ seat, card: seat === 0 ? v.hand[k++] : null });
    await choreo.deal(ctx, order, { from: ctx.deckBox() });
    // koz kartı açılır, destenin altına yan konur
    disp = { ...disp, stock: 12, trumpShown: true };
    ctx.pend.add('trump');
    ctx.render();
    await A.fly(ctx.cardEl(null), ctx.deckBox(), ctx.cardBox('trump'), { duration: A.dur('deal') * 1.3, easing: A.EASE.land, flipTo: ctx.cardEl(ctx.parseCard(v.trumpCard)) });
    ctx.reveal('trump');
    ctx.adj = [0, 0];
    disp = null;
  }

  function trumpNode(ctx, d) {
    if (!d.trumpShown || !d.trumpCard || d.stock <= 0) return null;
    const closed = d.closed >= 0;
    return h('div', { class: `trumpc${ctx.pend.has('trump') ? ' pend' : ''}`, 'data-card': 'trump' }, closed ? ctx.cardEl(null) : ctx.cardEl(ctx.parseCard(d.trumpCard)));
  }

  return createMatchScreen(deps, {
    title: '66',
    game: g66,
    players: () => 2,
    reset() {
      disp = null;
      selected = null;
      note = '';
    },
    onTurn() {
      selected = null;
    },
    onStart: (ctx) => dealAnim(ctx, ctx.state),

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const seat = e.seat;
      const mv = e.move;
      const ev = e.event;
      const bv = g66.viewFor(before, 0);
      selected = null;
      const base = scene(bv, { trumpShown: true });
      if (mv.t === 'close') {
        note = `${ctx.name(seat)} desteyi kapattı: artık renk vermek zorunlu`;
        disp = base;
        ctx.render();
        const el = ctx.body.querySelector('[data-card="trump"]');
        if (el) await A.flipInPlace(el, ctx.cardEl(null));
        disp = null;
        return;
      }
      if (mv.t === 'swap9') {
        const nine = bv.trump + '9';
        const got = bv.trumpCard;
        note = `${ctx.name(seat)} koz 9'u açık kozla değiştirdi`;
        const src = seat === 0 ? ctx.cardBox(nine) : ctx.seatBox(seat);
        const trumpBox = ctx.cardBox('trump');
        disp = { ...base, hand: seat === 0 ? [...bv.hand.filter((c) => c !== nine), got] : bv.hand, trumpCard: nine };
        if (seat === 0) ctx.pend.add(got);
        ctx.pend.add('trump');
        ctx.render();
        const dst = seat === 0 ? ctx.cardBox(got) : ctx.seatBox(seat);
        await Promise.all([
          ctx.fly(seat === 0 ? nine : null, src, trumpBox, { duration: A.dur('pass'), easing: A.EASE.move, reveal: seat !== 0 }),
          ctx.fly(got, trumpBox, dst, { duration: A.dur('pass'), easing: A.EASE.move, delay: 120 }),
        ]);
        ctx.reveal('trump');
        if (seat === 0) ctx.reveal(got);
        disp = null;
        return;
      }
      // kart oynama
      const c = mv.c;
      const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);
      const sizes = bv.handSizes.slice();
      sizes[seat]--;
      const trick = [...bv.trick, { seat, card: c }];
      disp = { ...base, hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand, sizes, trick };
      if (ev.marriage) note = `${ctx.name(seat)}: ${SUIT_TR[c[0]]} evliliği! +${ev.marriage}${ev.marriage === 40 ? ' (koz)' : ''}`;
      else note = '';
      ctx.pend.add(c);
      ctx.render();
      await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land });
      ctx.reveal(c);
      if (ev.marriage) await ctx.wait('read');
      const td = ev.trickDone;
      const de = ev.dealEnd;
      if (!td) {
        if (!de) {
          disp = null;
          return;
        }
      } else {
        await ctx.wait('read');
        await choreo.collect(ctx, td.cards, td.winner);
        disp = { ...disp, trick: [] };
        // çekme: önce kazanan, sonra kaybeden (son kart açık koz)
        const dr = ev.drew;
        if (dr) {
          const after = g66.viewFor(e.state, 0);
          const last = bv.stockLeft === 2;
          const pairs = [[dr.winner, dr.a, false], [1 - dr.winner, dr.b, last]];
          const myNew = pairs.find(([s]) => s === 0)?.[1];
          disp = { ...disp, hand: de ? disp.hand : after.hand, sizes: disp.sizes };
          if (myNew && !de) ctx.pend.add(myNew);
          ctx.adj = [0, 0];
          ctx.render();
          for (const [s2, card, fromTrump] of pairs) {
            const from = fromTrump ? ctx.cardBox('trump') : ctx.deckBox();
            if (fromTrump) ctx.hide('trump');
            disp.stock = Math.max(0, disp.stock - 1);
            const to = s2 === 0 && !de ? ctx.cardBox(card) : ctx.seatBox(s2);
            await ctx.fly(fromTrump || s2 === 0 ? card : null, from, to, { duration: A.dur('deal') * 1.2, easing: A.EASE.land, reveal: s2 === 0 && !fromTrump });
            if (s2 === 0 && !de) ctx.reveal(card);
            else if (s2 !== 0) ctx.bumpCount(s2, 1);
          }
          if (last) disp.trumpShown = false;
        }
      }
      if (!de) {
        disp = null;
        return;
      }
      // el sonu
      note = '';
      ctx.render();
      const rows = [0, 1].map((i) => h('div', { class: 'drow' }, h('span', {}, `${ctx.name(i)} · ${de.pts[i]} puan, ${de.tricks[i]} el`), h('b', { class: i === de.winner ? 'pos' : '' }, i === de.winner ? `+${de.gp}` : '')));
      await ctx.ask(h('div', {}, h('div', {}, `${ctx.name(de.winner)} kazandı: ${REASON[de.reason]}`), rows, h('div', { class: 'hint' }, `Oyun: ${de.game[0]} – ${de.game[1]} (${TARGET}'ye)`)), `El ${de.n + 1}`);
      // elde ve destede kalanlar desteye
      const to = ctx.deckBox();
      const mine = [...ctx.body.querySelectorAll('.khand .kc[data-card]')].map((n) => n.dataset.card);
      const jobs = mine.map((id, k) => {
        const from = ctx.cardBox(id);
        ctx.hide(id);
        return A.fly(ctx.cardEl(ctx.parseCard(id)), from, to, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * 40, flipTo: ctx.cardEl(null) });
      });
      const opp = disp.sizes[1] + (ctx.adj[1] || 0);
      for (let k = 0; k < opp; k++) jobs.push(A.sleep(k * 50).then(() => { ctx.bumpCount(1, -1); return A.fly(ctx.cardEl(null), ctx.seatBox(1), to, { duration: A.dur('collect'), easing: A.EASE.leave }); }));
      const tEl = ctx.body.querySelector('[data-card="trump"]');
      if (tEl && disp.trumpShown) {
        const from = ctx.cardBox('trump');
        ctx.hide('trump');
        jobs.push(A.fly(ctx.cardEl(null), from, to, { duration: A.dur('collect'), easing: A.EASE.leave }));
      }
      await Promise.all(jobs);
      ctx.adj = [0, 0];
      if (!g66.isOver(e.state)) await dealAnim(ctx, e.state);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const v = ctx.view(0);
      const d = disp || scene(v, { trumpShown: true });
      const pile = d.trick.map((t, k) => {
        const [dx, dy, rot] = SL[ctx.pos(t.seat)];
        return ctx.pileCard(t.card, { dx, dy, rot, z: k + 1 });
      });
      const stockN = Math.max(0, d.stock - (d.trumpShown && d.stock > 0 ? 1 : 0));
      const area = h('div', { class: 'center g66' }, trumpNode(ctx, d), ctx.deck(stockN), pile,
        h('div', { class: 'cnt' }, `Koz ${SUIT_SYMBOL[v.trump]} ${SUIT_TR[v.trump]}${d.closed >= 0 ? ' · kapalı' : ''}`));
      const my = ctx.awaiting && !disp && s.turn === 0 && s.phase !== 'over';
      const legal = my ? g66.legalMoves(s, 0) : [];
      const plays = new Set(legal.filter((m) => m.t === 'play').map((m) => m.c));
      const pend = v.pending[0] ? ` (+${v.pending[0]} ilk elde)` : '';
      const info = h('div', { class: 'kinfo' },
        h('div', { class: 'kg' }, note || (my ? (v.trick.length ? '▶ Sıra sende' : '▶ Çık') : disp ? ' ' : `${ctx.name(s.turn)} oynuyor`)),
        h('div', { class: 'sub' }, `Puanın ${d.pts}${pend} · ${v.tricks[0]} el aldın`),
        h('div', { class: 'sub' }, `Oyun ${v.game[0]} – ${v.game[1]} (${TARGET}'ye)`));
      const out = [ctx.table({
        area, info, count: (i) => d.sizes[i],
        chipSub: (i) => `oyun ${v.game[i]}`,
        chipCls: (i) => (!disp && s.phase !== 'over' && s.turn === i ? 'turn' : ''),
      })];
      const extra = legal.filter((m) => m.t !== 'play');
      if (my && extra.length) {
        out.push(h('div', { class: 'announce panel' }, h('div', { class: 'pgrid two' },
          extra.map((m) => h('button', { class: 'btn', onclick: () => ctx.respond(m) }, m.t === 'close' ? 'Desteyi kapat' : `Koz 9 ile ${SUIT_SYMBOL[v.trump]}${v.trumpCard.slice(1) === '14' ? 'A' : ''} değiştir`)))));
      }
      out.push(ctx.handRow(d.hand, {
        can: (c) => plays.has(c),
        selected,
        dim: my,
        onDrop: (c) => {
          if (!my || !plays.has(c)) return false;
          selected = null;
          ctx.respond({ t: 'play', c });
          return true;
        },
        onTap: (c, can) => {
          if (!my || !can) return;
          if (deps.settings.get('tap2') && selected !== c && plays.size > 1) {
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

    endHead: (w) => (w.includes(0) ? 'Kazandın!' : 'Kaybettin'),
    fmtScore: (sc) => `${sc} oyun puanı`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, '2 kişi, 24 kart (9, 10, vale, kız, papaz, as). Değerler: as 11, 10 10, papaz 4, kız 3, vale 2, 9 0. Güç sırası: as > 10 > papaz > kız > vale > 9. Herkese 6 kart; sonraki kart açılır ve koz olur.'),
      h2('p', {}, 'Deste açıkken renk vermek zorunlu değil. Eli alan önce desteden çeker. Deste bitince ya da kapatılınca renk vermek, rengin yoksa kozlamak zorunlu.'),
      h2('p', {}, 'Evlilik: elinde aynı renkten papaz ve kız varsa, çıkarken birini oynayınca 20 (kozda 40) puan. İlk elini alınca yazılır. Koz 9\'u olan, çıkarken (en az bir el almışsa) açık kozla değiştirebilir.'),
      h2('p', {}, 'Çıkan oyuncu desteyi kapatabilir: 66\'ya ulaşamazsa rakip 2 oyun puanı alır. 66\'ya ilk ulaşan eli kazanır: rakip 33 ve üstündeyse 1, altındaysa 2, rakip hiç el almadıysa 3 oyun puanı. Deste açıkken son eli alan +10. 7 oyun puanına ilk ulaşan kazanır.'),
      h2('p', {}, 'Kartı oynamak için bir kez dokun (kalkar), tekrar dokun (oynanır). Tek yasal kart varsa tek dokunuş yeter.')),
  });
}
