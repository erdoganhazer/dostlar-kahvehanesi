// King masası (ortak iskelet table-kit.js üzerinde). Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (desteden herkese) → oynama (elden/kutudan masadaki yuvaya) → okuma molası →
// toplama (eli alanın destesine) → el sonu özeti → yeni dağıtım.
import king, { GAME_NAMES, GAME_HINT, SUIT_TR, PENALTIES, KOZ_PER_PLAYER, PEN_PER_PLAYER, PEN_LIMIT, DEALS, SUITS } from '../games/king.js';
import { SUIT_SYMBOL } from '../core/cards.js';
import { createMatchScreen, choreo } from './table-kit.js';

const SHORT = { el: '−50 / el', kupa: '−30 / kupa', kiz: '−100 / kız', erkek: '−60 / vale-papaz', rifki: '−320', son2: '−180 × 2' };
// Masadaki yuva: oynayanın tarafına hafif kayık, hafif açılı (dx, dy, açı)
export const SLOT = { bottom: [-6, 24, -5], right: [22, 4, 8], top: [6, -24, 3], left: [-22, -4, -9] };

export function createKingScreen(deps) {
  const { h, settings, counter } = deps;
  let selected = null;
  let disp = null; // animasyon sırasında gösterilecek geçici görünüm: { trick, hand, sizes, tricksWon }

  const gameTitle = (g) => (!g ? '' : g.g === 'koz' ? `Koz ${SUIT_SYMBOL[g.trump]} ${SUIT_TR[g.trump]}` : GAME_NAMES[g.g]);

  async function dealAnim(ctx, st) {
    const v = king.viewFor(st, 0);
    disp = { trick: [], hand: v.hand, sizes: v.handSizes, tricksWon: [0, 0, 0, 0] };
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    ctx.render();
    const order = [];
    const first = (st.announcer + 1) % 4; // söyleyenin sağından başlayarak dağıt
    for (let r = 0; r < 13; r++) for (let k = 0; k < 4; k++) {
      const seat = (first + k) % 4;
      order.push({ seat, card: seat === 0 ? v.hand[r] : null });
    }
    await choreo.deal(ctx, order, { from: ctx.centerBox() });
    disp = null;
    ctx.adj = [0, 0, 0, 0];
  }

  function sheet(ctx) {
    const s = ctx.state;
    if (!s) return;
    const rows = s.sheet.map((r) =>
      h('tr', {}, h('td', {}, r.n + 1), h('td', {}, `${ctx.name(r.by).slice(0, 5)}: ${r.g === 'koz' ? 'Koz' + SUIT_SYMBOL[r.trump] : GAME_NAMES[r.g]}`),
        r.delta.map((d) => h('td', { class: d < 0 ? 'neg' : 'pos' }, d))));
    ctx.dialog(h('table', { class: 'sheet' },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Oyun'), [0, 1, 2, 3].map((i) => h('th', {}, ctx.name(i).slice(0, 5))))),
      h('tbody', {}, rows),
      h('tfoot', {}, h('tr', {}, h('td', { colspan: 2 }, 'Toplam'), s.totals.map((t) => h('td', { class: t < 0 ? 'neg' : 'pos' }, t))))), [['Kapat']], 'Skor');
  }

  function announcePanel(ctx) {
    const st = ctx.state;
    const u = st.used[0];
    const legal = king.legalMoves(st, 0);
    const has = (g) => legal.some((m) => m.g === g);
    const pen = PENALTIES.map((g) =>
      h('button', { class: 'btn', disabled: !has(g), onclick: () => ctx.respond({ t: 'ann', g }) },
        GAME_NAMES[g], h('div', { class: 'tag' }, `${SHORT[g]} · ${PEN_LIMIT - st.gameCount[g]} hak`)));
    const koz = SUITS.map((t) =>
      h('button', { class: `btn suit${t === 'H' || t === 'D' ? ' red' : ''}`, disabled: !has('koz'), onclick: () => ctx.respond({ t: 'ann', g: 'koz', trump: t }) },
        SUIT_SYMBOL[t], h('div', { class: 'tag' }, SUIT_TR[t])));
    return h('div', { class: 'announce panel' },
      h('b', {}, 'Oyunu sen söylüyorsun'),
      h('div', { class: 'hint', style: 'color:#000' }, `Ceza hakkın: ${PEN_PER_PLAYER - u.pen} · Koz hakkın: ${KOZ_PER_PLAYER - u.koz}`),
      h('div', { class: 'pgrid' }, pen),
      h('div', { class: 'kozrow' }, koz));
  }

  return createMatchScreen(deps, {
    title: 'King',
    game: king,
    players: () => 4,
    makeConfig: () => ({ king: { kingEnds: settings.get('kingEnds') } }),
    yazbozRow: (e) => {
      if (!e.event.dealEnd) return null;
      const r = e.state.sheet[e.state.sheet.length - 1];
      return { label: r.g === 'koz' ? `Koz${SUIT_SYMBOL[r.trump]}` : GAME_NAMES[r.g], cells: e.event.dealEnd.delta };
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
      const bv = king.viewFor(before, 0);
      // 1) kartın kaynağı yeniden çizimden ÖNCE ölçülür
      const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);
      const trick = [...before.trick, { seat, card: c }];
      const sizes = bv.handSizes.slice();
      sizes[seat]--;
      disp = { trick, hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand, sizes, tricksWon: before.tricksWon };
      ctx.pend.add(c);
      ctx.render();
      // 2) masadaki yuvasına uçar, inince görünür
      await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land });
      ctx.reveal(c);
      const done = e.event.trickDone;
      if (!done) {
        disp = null;
        return;
      }
      // 3) okuma molası, sonra kartlar alanın destesine gider
      await ctx.wait('read');
      await choreo.collect(ctx, trick.map((t) => t.card), done.winner);
      const tw = before.tricksWon.slice();
      tw[done.winner]++;
      disp = { ...disp, trick: [], tricksWon: tw };
      const newDeal = e.state.dealNo !== before.dealNo || e.state.redeal !== before.redeal || king.isOver(e.state);
      if (!newDeal) {
        disp = null;
        return;
      }
      disp = { trick: [], hand: [], sizes: [0, 0, 0, 0], tricksWon: tw };
      ctx.render();
      if (e.event.dealEnd) {
        const de = e.event.dealEnd;
        const last = e.state.sheet[e.state.sheet.length - 1];
        const rows = [0, 1, 2, 3].map((i) => h('div', { class: 'drow' }, h('span', {}, ctx.name(i)), h('b', { class: de.delta[i] < 0 ? 'neg' : 'pos' }, de.delta[i])));
        await ctx.ask(h('div', {}, rows), last ? `El ${de.n + 1}: ${last.g === 'koz' ? 'Koz' + SUIT_SYMBOL[last.trump] : GAME_NAMES[last.g]}` : `El ${de.n + 1}`);
      } else if (e.state.redeal !== before.redeal) {
        await ctx.ask('Dört oyuncu da birer kız aldı. El yeniden dağıtılıyor.', 'Kız Almaz');
      }
      if (!king.isOver(e.state)) await dealAnim(ctx, e.state);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const v = king.viewFor(s, 0);
      const d = disp || {};
      const trick = d.trick ?? s.trick;
      const hand = d.hand ?? v.hand;
      const sizes = d.sizes ?? v.handSizes;
      const tw = d.tricksWon ?? s.tricksWon;
      const pile = trick.map((t, k) => {
        const [dx, dy, rot] = SLOT[ctx.pos(t.seat)];
        return ctx.pileCard(t.card, { dx, dy, rot, z: k + 1 });
      });
      const myTurn = ctx.awaiting && s.phase === 'play' && s.turn === 0 && !disp;
      const legal = myTurn ? new Set(king.legalMoves(s, 0).map((m) => m.c)) : new Set();
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(s.dealNo + 1, DEALS)}/${DEALS}`),
        h('div', { class: 'kg' }, s.game ? gameTitle(s.game) : 'Oyun söylenecek'),
        h('div', { class: 'sub' }, s.game ? GAME_HINT[s.game.g] : `${ctx.name(s.announcer)} söylüyor`),
        h('div', { class: 'sub' }, myTurn ? '▶ Sıra sende' : `Aldığın el: ${tw[0]}`),
        h('div', { class: 'tot' }, 'Puanın ', counter(Math.abs(s.totals[0]), 4), s.totals[0] < 0 ? ' (−)' : ''));
      const area = h('div', { class: `center${s.phase === 'announce' && !trick.length ? ' compact' : ''}` }, pile);
      const out = [ctx.table({
        area,
        info,
        count: (i) => sizes[i],
        chipSub: (i) => `${tw[i]} el${s.phase !== 'over' && s.announcer === i ? ' · söyleyen' : ''}`,
        chipCls: (i) => (!disp && s.phase !== 'over' && king.currentActor(s) === i ? 'turn' : ''),
      })];
      if (s.phase === 'announce' && s.announcer === 0 && ctx.awaiting && !disp) out.push(announcePanel(ctx));
      out.push(ctx.handRow(hand, {
        can: (c) => legal.has(c),
        selected,
        dim: myTurn,
        onDrop: (c) => {
          if (!myTurn || !legal.has(c)) return false;
          selected = null;
          ctx.respond({ t: 'play', c });
          return true;
        },
        onTap: (c, can) => {
          if (!myTurn || !can) return;
          if (deps.settings.get('tap2') && selected !== c && legal.size > 1) {
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

    endHead: (w, ctx, res) => (res.state.kingBy >= 0 ? `${ctx.name(res.state.kingBy)} KING yaptı!` : w.includes(0) ? 'Kazandın!' : 'Oyun bitti'),
    rules: (h) => {
      const row = (a, b) => h('tr', {}, h('td', {}, a), h('td', { class: 'r' }, b));
      return h('div', { class: 'rules' },
        h('h4', {}, 'Nasıl oynanır'),
        h('p', {}, '4 kişi, 13\'er kart, 20 el. Her oyuncu sırayla oyunu söyler: toplam 3 ceza + 2 koz. Söyleyen ilk kartı atar; elinde o renkten varsa vermek zorundasın.'),
        h('p', {}, 'Kartı oynamak için bir kez dokun (kalkar), tekrar dokun (oynanır). Tek yasal kart varsa tek dokunuş yeter. Kararan kartlar o an atılamaz.'),
        h('h4', {}, 'Puanlar'),
        h('table', { class: 'sheet' },
          row('Koz — aldığın her el', '+50'), row('El almaz — her el', '−50'), row('Kupa almaz — her kupa', '−30'),
          row('Kız almaz — her kız', '−100'), row('Erkek almaz — her vale/papaz', '−60'),
          row('Rıfkı — kupa papazı', '−320'), row('Son iki — son iki elin her biri', '−180')),
        h('h4', {}, 'Özel kurallar'),
        h('p', {}, 'Kupa almaz ve Rıfkı\'da kupa çıkmadan kupa ile açılmaz. Elinde seri yoksa kupa atarsın (Rıfkı\'da kupa papazı). Koz oyununda serin yoksa koz atmak zorundasın.'),
        h('p', {}, 'Oyun sonunda toplamı 0 ve üstü olan kazanır.'));
    },
  });
}
