import { sfx } from './sfx.js';
// Masa sohbeti: botlar oyunun gidişatına göre konuşur (övünme, laf sokma, tebrik, sitem), insan hazır mesaj seçer ya da yazar.
// Balonlar konuşan oyuncunun kutusunun yanında, ekranın üstündeki ayrı katmanda (#chatfx) birkaç saniye görünür.
// Olaylar: detect() her hamleden sonra oyuna göre olay listesi çıkarır; botlar tarzlarına göre (atak: laf sokar,
// temkinli: tebrik eder) ve bekleme süreleriyle konuşur. Ayarlar > Sohbet kapalıysa hiçbir şey görünmez.

const L = {
  start: ['Selam millet', 'Hadi bakalım, iyi oyunlar', 'Bugün şanslı günümdeyim', 'Kartlar bana gülüyor bugün', 'Herkese bol şans', 'Hazır mısınız?'],
  brag: ['Bu el benim!', 'Al bakalım!', 'Kolay oldu', 'Ders gibi oyun', 'Gördünüz mü?', 'Sıradaki gelsin', 'İşte böyle oynanır'],
  taunt: ['{t}, bu kadar mı?', '{t}, kartlara küsme sakın', 'Biraz daha çalışman lazım {t}', '{t} uyuyor mu?', 'Kolay lokma çıktın {t}', 'Ağlamak yok {t}', '{t}, bir dahaki sefere belki', 'Masa sana ağır geldi {t}', '{t}, kartları ters mi tutuyorsun?'],
  loss: ['Olmadı bu sefer', 'Yazık oldu', 'Bu kartlarla bu kadar', 'Şansım yok bugün', 'Hadi be!', 'Bunu hak etmedim', 'Kartlar küstü bana'],
  congrats: ['Tebrikler {t}', 'Helal olsun {t}', 'Güzel oynadın {t}', 'Bravo {t}'],
  envy: ['Şanslısın {t}', 'Bu sefer kurtardın {t}', 'Kartlar hep sana geliyor {t}', 'Hile var bunda {t}'],
  pisti: ['Pişti!', 'Pişti, al bakalım!', 'Pişti yaptım, kusura bakma', 'Pişti! Bir tane daha?'],
  fanti: ['Fanti!', 'Hepsini topladım!', 'Masayı süpürdüm'],
  caught: ['Yakaladım seni {t}!', 'Bana yalan söyleyemezsin {t}', 'Yalancı yalancı!', 'Yüzünden belliydi {t}'],
  honest: ['Ben yalan söylemem!', 'Afiyet olsun {t}', 'Al hepsini {t}', 'Bana güvenmedin, al bakalım {t}'],
  allin: ['All-in!', 'Gel bakalım, hepsi ortada', 'Cesaretin varsa gör', 'Ya hep ya hiç'],
  bust: ['Battım yine', '21 değil 25 oldu', 'Bir kart fazla çektim'],
  gin: ['GIN!', 'Gin, saymaya başla', 'Tertemiz el: gin!'],
  knock: ['Kapı!', 'Kapıyı çalıyorum', 'Ben kapı diyorum, aç bakalım elini'],
  undercut: ['Alt kestim seni!', 'Kapı dedin ama hesap tutmadı', 'Erken kapı pahalıya patlar'],
  finish: ['Bittim!', 'Konken!', 'Eller yukarı, bittim'],
  rebuy: ['Bitmedi daha, giriyorum!', 'Çanağa koydum, devam!', 'Bu çanak bana gelecek, görürsünüz', 'Yandım ama pes yok'],
  quit: ['Bana bu kadar, kalkıyorum', 'Cebimi korurum, çekildim', 'Siz devam edin, ben çayımı içerim'],
  burn: ['{t} yandı!', 'Geçmiş olsun {t}, yandın', 'Yanık kokusu geliyor, {t}', '{t} yüzü geçti!'],
  opened: ['Açtım!', 'Perler yerde', 'Hadi bakalım, açtım'],
  marriage: ['Evlilik var!', 'Düğünümüz var, buyrun', 'Papazla kız evlendi', 'Kırk! Koz evliliği'],
  esek: ['{t} eşek oldu!', 'Aa, {t} eşek!', 'Hızlı ol biraz {t}', 'Eşek {t}, eşek!'],
  papaz: ['Papaz {t}\'de kaldı!', 'Geçmiş olsun {t}, papaz sende'],
  winMatch: ['Kazandım! İyi oyundu', 'Bir el daha?', 'Yenilmezim bugün', 'Masanın kralı benim'],
  loseMatch: ['Tebrikler {t}, rövanş isterim', 'Bir dahakine görürsün', 'Bugün senin günündü {t}'],
  idle: ['Hadi ama, düşünme bu kadar', 'Saat ilerliyor', 'Seri !!', 'Uyuma {t}'],
};
const REPLY = [
  [/selam|merhaba|sa\b/i, ['Selam!', 'Aleyküm selam', 'Selam, hoş geldin']],
  [/iyi oyun/i, ['Sana da!', 'İyi oyunlar', 'Sağ ol, sana da']],
  [/tebrik|helal|bravo/i, ['Teşekkürler!', 'Sağ ol', 'Daha bitmedi ama']],
  [/teşekkür|sağ ol/i, ['Rica ederim', 'Ne demek']],
  [/seri|hadi|acele/i, ['Tamam tamam', 'Acele etme', 'Düşünüyorum!', 'Sabır']],
  [/benim|kazan|göster/i, ['Göreceğiz bakalım', 'Hayal kurma', 'Daha erken']],
];
const DEFAULT_REPLY = ['Haha', 'Öyle mi?', 'Oyna oyna', 'Bakalım', 'Hı hı'];
export const QUICK = ['Seri !!', 'İyi oyunlar', 'Selam', 'Tebrikler', 'Teşekkürler', 'Bu el benim', 'Hadi bakalım'];
// İnsanın laf sokma seçenekleri (kahvehane ağzı; kimseyi incitmeyen takılmalar)
export const TAUNTS = ['Kâğıt görmemiş gibi oynuyorsun', 'Çırak mısın, usta mı?', 'Al sana ders!', 'Ağla bakalım', 'Masadan kalkma vakti geldi',
  'Çayını iç, sinirlerin yatışsın', 'Bu daha başlangıç', 'Bu elle mi oturdun masaya?', 'Rövanşa hazır ol', 'Gözün korkmasın', 'Uyuma, sıra sende!', 'Kartlar bana âşık bugün'];
// Laf yiyen botun cevabı (oyun tarzına göre)
const TAUNT_BACK = {
  atak: ['Sen önce kendi eline bak!', 'Gülme komşuna, gelir başına', 'Bitmedi daha, sonunu göreceğiz', 'Sözle değil kâğıtla konuş', 'Bu masada son gülen ben olurum'],
  dengeli: ['Haha, iyiydi', 'Göreceğiz bakalım', 'Acele etme, oyun uzun', 'Bu lafı not ettim', 'Şimdilik sen kazandın, şimdilik'],
  temkinli: ['Sabır, sabır…', 'Ben işime bakarım', 'Lafla peynir gemisi yürümez', 'Hı hı, oyna sen', 'Sakin ol kardeşim'],
};
const TAUNT_JOIN = ['Haha, iyi dedi!', 'Oo, laf yedi!', 'Yandı gülüm keten helva', 'Bu lafa çay ısmarlanır'];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * deps: { h, body, settings, seats(), name(i), pos(i), isBot(i), styleOf(i) }
 */
export function createChat(deps) {
  const { h, settings } = deps;
  const lastSaid = new Map(); // seat → zaman
  const lastText = new Map(); // seat → son söz
  let lastAny = 0;
  const on = () => settings.get('chat') !== false;

  function layer() {
    let l = document.getElementById('chatfx');
    if (!l) {
      l = document.createElement('div');
      l.id = 'chatfx';
      document.body.append(l);
    }
    return l;
  }

  /** Konuşma balonu: oyuncunun kutusunun yanında */
  function say(seat, text, kind = '') {
    if (!on() || !deps.body.isConnected) return;
    const chip = deps.body.querySelector(`.ks[data-seat="${seat}"]`);
    if (!chip) return;
    const r = chip.getBoundingClientRect();
    const b = h('div', { class: `bub ${kind}`, role: 'status' }, text);
    b.style.visibility = 'hidden';
    layer().append(b);
    const w = b.offsetWidth;
    const hh = b.offsetHeight;
    const p = deps.pos(seat);
    let x;
    let y;
    if (p === 'left') [x, y] = [r.right + 6, r.top + 6];
    else if (p === 'right') [x, y] = [r.left - w - 6, r.top + 6];
    else if (p === 'top') [x, y] = [r.left + r.width / 2 - w / 2, r.bottom + 6];
    else [x, y] = [r.left + r.width / 2 - w / 2, r.top - hh - 8];
    x = Math.max(6, Math.min(innerWidth - w - 6, x));
    // aynı anda konuşan başka balonla çakışmasın: çakışırsa altına (üst/alt koltukta yukarısına) kaydır
    const others = [...layer().querySelectorAll('.bub')].filter((o) => o !== b).map((o) => o.getBoundingClientRect());
    for (let k = 0; k < 4; k++) {
      const hit = others.find((o) => x < o.right + 4 && x + w > o.left - 4 && y < o.bottom + 4 && y + hh > o.top - 4);
      if (!hit) break;
      y = p === 'bottom' ? hit.top - hh - 6 : hit.bottom + 6;
    }
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    b.style.visibility = 'visible';
    sfx.msg();
    setTimeout(() => b.remove(), 2600 + text.length * 40);
    lastSaid.set(seat, performance.now());
    lastAny = performance.now();
  }

  const fill = (text, t) => {
    const nm = t == null ? '' : deps.name(t);
    const who = nm === 'Ben' || !nm ? 'kardeşim' : nm;
    return text.replace('{t}', who);
  };

  /** Bir bot olaya göre bir şey söyler mi? (olasılık, bekleme, tekrar etmeme) */
  function botLine(seat, kinds, target, { force = false, delay = 0 } = {}) {
    if (!on() || !deps.isBot(seat)) return false;
    const now = performance.now();
    if (!force && (now - (lastSaid.get(seat) || -1e9) < 6000 || now - lastAny < 1800)) return false;
    const pool = kinds.flatMap((k) => L[k] || []);
    let text = fill(pick(pool), target);
    if (text === lastText.get(seat)) text = fill(pick(pool), target);
    lastText.set(seat, text);
    const kind = kinds.some((k) => ['taunt', 'caught', 'esek', 'papaz', 'envy'].includes(k)) ? 'taunt' : '';
    lastSaid.set(seat, now); // bekleyen söz de sayılır
    setTimeout(() => say(seat, text, kind), delay);
    return true;
  }

  /** Bot tarzına göre: başkası kazandı/kaybetti tepkisi */
  function reactTo(gainer, loser) {
    const bots = deps.seats().map((_, i) => i).filter((i) => deps.isBot(i));
    for (const i of shuffle(bots)) {
      const st = deps.styleOf(i);
      if (i === gainer && Math.random() < 0.55) return botLine(i, ['brag'], null, { delay: 300 });
      if (i === loser && Math.random() < 0.45) return botLine(i, ['loss'], null, { delay: 300 });
      if (loser != null && i !== loser && st !== 'temkinli' && Math.random() < (st === 'atak' ? 0.5 : 0.25)) return botLine(i, ['taunt'], loser, { delay: 500 });
      if (gainer != null && i !== gainer && Math.random() < 0.3) return botLine(i, [st === 'temkinli' ? 'congrats' : 'envy'], gainer, { delay: 500 });
    }
    return false;
  }

  /** Oyun olayları (table-kit her hamleden sonra çağırır) */
  function onMove(gameId, e, before, after, sBefore, sAfter) {
    if (!on()) return;
    const ev = e.event || {};
    const seat = e.seat;
    // oyuna özel anlar
    if (gameId === 'pisti' && ev.bonus) return botLine(seat, ['pisti'], null, { force: true }) || reactTo(null, (seat + 1) % deps.seats().length);
    if (gameId === 'fanti' && ev.take?.length >= 3 && +ev.card.slice(1) === 11) return botLine(seat, ['fanti'], null, { force: true });
    if (gameId === 'blof' && ev.t === 'call') {
      if (ev.truth) return botLine(ev.accused, ['honest'], seat, { force: true });
      return botLine(seat, ['caught'], ev.accused, { force: true }) || reactTo(null, ev.accused);
    }
    if (gameId === 'poker' && e.move.t === 'raise' && after.chips?.[seat] === 0) return botLine(seat, ['allin'], null, { force: true });
    if (gameId === 'altmisalti' && ev.marriage) return botLine(seat, ['marriage'], null, { force: true });
    if (gameId === 'yanik' && ev.roundEnd) {
      const re = ev.roundEnd;
      if (re.burned.length) {
        const b = re.burned[0];
        const others = deps.seats().map((_, i) => i).filter((i) => i !== b && deps.isBot(i));
        if (others.length) return botLine(pick(others), ['burn'], b, { force: true });
      }
      if (re.finisher >= 0) return botLine(re.finisher, ['finish'], null, { force: true });
    }
    if (gameId === 'yanik' && (ev.ev?.t === 'rebuy' || ev.ev?.t === 'quit')) return botLine(seat, [ev.ev.t], null, { force: true });
    if (gameId === 'yanik' && ev.ev?.t === 'open') return botLine(seat, ['opened'], null);
    if (gameId === 'gin' && ev.roundEnd && ev.roundEnd.kind !== 'void') {
      const re = ev.roundEnd;
      if (re.kind === 'undercut') return botLine(1 - re.knocker, ['undercut'], re.knocker, { force: true }) || reactTo(null, re.knocker);
      return botLine(re.knocker, [re.kind], null, { force: true });
    }
    if (gameId === 'konken' && ev.finish) return botLine(seat, ['finish'], null, { force: true }) || reactTo(seat, null);
    if (gameId === 'esek' && ev.roundEnded && ev.loser != null) {
      const others = deps.seats().map((_, i) => i).filter((i) => i !== ev.loser && deps.isBot(i));
      if (others.length) return botLine(pick(others), ['esek'], ev.loser, { force: true });
    }
    if (gameId === 'blackjack' && ev.roundEnd) {
      const busted = ev.roundEnd.outcomes.findIndex((o, i) => o === 'bust' && deps.isBot(i));
      if (busted >= 0 && Math.random() < 0.5) return botLine(busted, ['bust']);
    }
    // genel: puan farkı (yalnızca el/tur sonunda ve alışlarda)
    const moment = ev.trickDone || ev.dealEnd || ev.handEnd || ev.roundEnd || ev.roundEnded || ev.capture || ev.take?.length || ev.paired;
    if (!moment || !sBefore || !sAfter) return;
    const d = sAfter.map((v, i) => v - sBefore[i]);
    let g = -1;
    let l = -1;
    d.forEach((v, i) => {
      if (v > 0 && (g < 0 || v > d[g])) g = i;
      if (v < 0 && (l < 0 || v < d[l])) l = i;
    });
    if (ev.trickDone && g < 0 && l < 0) {
      // el alma oyunlarında puan el sonunda yazılır: eli alan bazen övünür
      if (Math.random() < 0.18) botLine(ev.trickDone.winner, ['brag']);
      return;
    }
    if (g >= 0 || l >= 0) reactTo(g >= 0 ? g : null, l >= 0 ? l : null);
  }

  function onStart() {
    if (!on()) return;
    const bots = deps.seats().map((_, i) => i).filter((i) => deps.isBot(i));
    if (bots.length) botLine(pick(bots), ['start'], null, { force: true, delay: 600 });
  }

  function onEnd(winners, gameId, state) {
    if (!on()) return;
    if (gameId === 'papazkacti' && state?.loser != null) {
      const bots = deps.seats().map((_, i) => i).filter((i) => i !== state.loser && deps.isBot(i));
      if (bots.length) return botLine(pick(bots), ['papaz'], state.loser, { force: true });
    }
    const w = winners[0];
    if (deps.isBot(w)) botLine(w, ['winMatch'], null, { force: true });
    else {
      const bots = deps.seats().map((_, i) => i).filter((i) => deps.isBot(i));
      if (bots.length) botLine(pick(bots), ['loseMatch'], w, { force: true });
    }
  }

  /** İnsan uzun düşünürse bir bot dürter */
  function onHumanSlow() {
    const bots = deps.seats().map((_, i) => i).filter((i) => deps.isBot(i) && deps.styleOf(i) !== 'temkinli');
    if (bots.length && Math.random() < 0.6) botLine(pick(bots), ['idle'], 0);
  }

  /** İnsan mesajı: balon + bazen bir bot cevap verir */
  function human(text) {
    const t = String(text || '').trim().slice(0, 60);
    if (!t) return;
    say(0, t, 'me');
    const bots = deps.seats().map((_, i) => i).filter((i) => deps.isBot(i));
    if (bots.length && TAUNTS.includes(t)) {
      // laf sokulan bot hemen cevap verir; bazen bir başkası da güler
      const b = pick(bots);
      lastSaid.set(b, performance.now());
      setTimeout(() => say(b, pick(TAUNT_BACK[deps.styleOf(b)] || TAUNT_BACK.dengeli)), 900 + Math.random() * 700);
      const others = bots.filter((x) => x !== b);
      if (others.length && Math.random() < 0.45) setTimeout(() => say(pick(others), pick(TAUNT_JOIN)), 2600 + Math.random() * 800);
      return;
    }
    if (!bots.length || Math.random() < 0.25) return;
    const pool = (REPLY.find(([re]) => re.test(t)) || [null, DEFAULT_REPLY])[1];
    const b = pick(bots);
    const reply = pick(pool);
    lastSaid.set(b, performance.now());
    setTimeout(() => say(b, reply), 900 + Math.random() * 900);
  }

  // ---- Hazır mesaj düğmesi ve paneli (masanın sağ altında; yeniden çizimde aynı öğeler takılır) ----
  const input = h('input', { type: 'text', maxlength: 60, placeholder: 'Mesaj yaz…', 'aria-label': 'Mesaj' });
  const panel = h('div', { class: 'chatpanel', hidden: true },
    h('form', { onsubmit: (ev) => { ev.preventDefault(); human(input.value); input.value = ''; panel.hidden = true; } },
      input, h('button', { type: 'submit', 'aria-label': 'Gönder' }, '›')),
    h('div', { class: 'qtabs', role: 'tablist' },
      h('button', { type: 'button', class: 'on', onclick: (ev) => tabTo(ev, 'nice') }, 'Sohbet'),
      h('button', { type: 'button', onclick: (ev) => tabTo(ev, 'taunt') }, 'Laf sok 😏')),
    h('div', { class: 'qlist', 'data-tab': 'nice' }, QUICK.map((q) => h('button', { class: 'qc', type: 'button', onclick: () => { human(q); panel.hidden = true; } }, q))),
    h('div', { class: 'qlist', 'data-tab': 'taunt', hidden: true }, TAUNTS.map((q) => h('button', { class: 'qc taunt', type: 'button', onclick: () => { human(q); panel.hidden = true; } }, q))));
  function tabTo(ev, tab) {
    panel.querySelectorAll('.qtabs button').forEach((b) => b.classList.toggle('on', b === ev.currentTarget));
    panel.querySelectorAll('.qlist').forEach((l) => (l.hidden = l.dataset.tab !== tab));
  }
  const btn = h('button', { class: 'chatbtn', type: 'button', 'aria-label': 'Sohbet', onclick: () => (panel.hidden = !panel.hidden) },
    h('span', { 'aria-hidden': 'true', style: 'font-size:20px;line-height:1' }, '💬'));
  /** Masaya takılacak öğeler: panel (her çizimde), düğme üst çubukta (button()) */
  function nodes() {
    return on() ? [panel] : [];
  }
  function button() {
    btn.hidden = !on();
    return btn;
  }
  function clear() {
    const l = document.getElementById('chatfx');
    if (l) l.replaceChildren();
    panel.hidden = true;
  }

  return { say, onMove, onStart, onEnd, onHumanSlow, human, nodes, button, clear };
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
