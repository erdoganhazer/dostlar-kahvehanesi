// Yancı: oyuncunun sağ alt yanında oturan karakter; yönerge ve oyun sohbeti onun konuşma balonundan gelir.
// Ayar 'yanciMode': 'sohbet' (oyunu muhabbetle takip eder) ya da 'sessiz' (altındaki 🔇 ile susturulur).
// Resmine dokununca o anın ipucunu verir (sessizken de).
// Balon yerinde güncellenir (yeniden çizim beklemez; uçuş sırasında da güvenli). Kahvehane içeceği cafe.node('y') ile gelir.
import { avatarNode } from './avatar.js';
import { sfx } from './sfx.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

const L = {
  good: ['Aferin, tam benim aklımdaki.', 'İşte böyle oynanır!', 'Güzel, sağlam hamle.', 'Ustaca. Devam.', 'Bunu ben de yapardım.'],
  bad: ['Hmm… ben olsam {m} derdim.', 'Olsun, ama {m} daha iyiydi.', 'Aceleye geldi gibi; {m} vardı.', 'Bir dahakine {m}, unutma.'],
  myTurn: ['Sıra sende, acele etme.', 'Hadi bakalım, göster kendini.', 'Düşün taşın, sonra at.', 'Bu el önemli, dikkat.'],
  botMove: ['{n} hızlı oynadı.', '{n} bir şey biliyor galiba.', '{n} pek keyifli değil.', '{n}\'e dikkat et, sinsi oynuyor.', 'Şu {n}\'in eli iyi gibi.'],
  gain: ['İşte bu! Puanlar geliyor.', 'Oh be, bu el bizim.', 'Gördün mü, sabır kazandırır.'],
  loss: ['Eyvah, bu pahalıya patladı.', 'Olur böyle, toparlarız.', 'Canı sağolsun, sıradaki ele bak.'],
  lead: ['Öndeyiz, bozmayalım.', 'Rahat ol, masa senin.'],
  behind: ['Gerideyiz ama oyun bitmedi.', 'Biraz açılmamız lazım.'],
  idle: ['Ocakçı çayı iyi demlemiş bugün.', 'Eskiden bu masada sabaha kadar oynardık.', 'Şu tavla şakırtısı da olmasa…', 'Dışarıda yağmur başladı galiba.', 'Kâğıdın da kısmeti var, bekle.', 'Sen oyna, ben seyrederim.'],
  thanks: ['Sağ ol, eline sağlık!', 'Çay mı? Hiç hayır demem.', 'Eksik olma, demli olmuş.'],
  refill: ['Ocakçı, benim çay bitti!', 'Bir çay daha alayım.', 'Usta, bir tavşan kanı!'],
  win: ['Helal olsun! Kazandık!', 'Çaylar kaybedenden!'],
  lose: ['Bu sefer olmadı, rövanş!', 'Kaybettik ama iyi oynadın.'],
  start: ['Hadi bakalım, hayırlısı.', 'Kartlar dağılıyor, gözüm üstünde.', 'Bugün şanslı günündesin, hissediyorum.'],
};

export const YANCI_DEFAULT = { name: 'Şerif', avatar: 'a4' };

/** deps: { h, settings, cafe } */
export function createYanci(deps) {
  const { h, settings } = deps;
  let talk = ''; // sohbet modunda son söz
  let lastSaid = 0;
  let bubble = null;
  const mode = () => (settings.get('yanciMode') === 'sessiz' ? 'sessiz' : 'sohbet');
  let hint = null; // { nodes, until }
  let richFn = (t) => t;
  let hintT = 0;
  const name = () => settings.get('yanciName') || YANCI_DEFAULT.name;
  const fill = (t, o = {}) => t.replace('{m}', o.m ?? '').replace('{n}', o.n ?? '');

  /** Sohbet modunda söyle (sık konuşmasın): force önemli anlar için */
  function say(text, force = false) {
    if (mode() !== 'sohbet' || !text) return;
    const now = performance.now();
    if (!force && now - lastSaid < 3500) return;
    lastSaid = now;
    talk = text;
    sfx.msg();
    if (bubble?.isConnected) {
      if (hint) return; // ipucu gösterilirken sohbet araya girmez
      bubble.replaceChildren(h('div', { class: 'ytalk' }, richFn(talk)));
      bubble.parentElement.classList.remove('empty');
      bubble.parentElement.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 250 });
    }
  }

  /** Kahvehane ve oyun olayları (sohbet modunda) */
  const api = {
    mode,
    on: () => true,
    reset() {
      talk = '';
      lastSaid = 0;
    },
    start() {
      say(pick(L.start), true);
    },
    thanks() {
      if (mode() === 'sohbet') say(pick(L.thanks), true);
    },
    refill() {
      say(pick(L.refill), true);
    },
    /** İnsanın hamlesi değerlendirildikten sonra */
    afterMine(rev) {
      if (!rev) return;
      if (rev.good) say(pick(L.good), Math.random() < 0.5);
      else say(fill(pick(L.bad), { m: rev.betterLabel || 'başka bir şey' }), true);
    },
    /** Herhangi bir hamle sonrası: puan değişimi ve rakip hamleleri */
    afterMove({ seat, isBot, nameOf, sBefore, sAfter, myTurnNext }) {
      if (mode() !== 'sohbet') return;
      if (sBefore && sAfter && sAfter[0] !== sBefore[0]) {
        const d = sAfter[0] - sBefore[0];
        say(pick(d > 0 ? L.gain : L.loss), true);
        return;
      }
      if (isBot && Math.random() < 0.18) {
        say(fill(pick(L.botMove), { n: nameOf(seat) }));
        return;
      }
      if (sAfter && Math.random() < 0.06) {
        const me = sAfter[0];
        const best = Math.max(...sAfter.filter((_, i) => i !== 0));
        say(pick(me >= best ? L.lead : L.behind));
        return;
      }
      if (myTurnNext && Math.random() < 0.2) say(pick(L.myTurn));
      else if (Math.random() < 0.05) say(pick(L.idle));
    },
    end(won) {
      say(pick(won ? L.win : L.lose), true);
    },

    /** İpucu göster (resmine dokununca): balonda birkaç saniye kalır */
    showHint(nodes) {
      hint = { nodes, until: performance.now() + 9000 };
      clearTimeout(hintT);
      hintT = setTimeout(() => {
        hint = null;
        if (bubble?.isConnected) {
          bubble.replaceChildren(...(mode() === 'sohbet' && talk ? [h('div', { class: 'ytalk' }, talk)] : []));
          if (!(mode() === 'sohbet' && talk)) bubble.parentElement.classList.add('empty');
        }
      }, 9000);
      if (bubble?.isConnected) {
        bubble.replaceChildren(h('div', { class: 'ytalk plain' }, nodes));
        bubble.parentElement.classList.remove('empty');
        bubble.parentElement.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 250 });
      }
      sfx.msg();
    },
    /**
     * Yancının düğümü. lines: zorunlu satırlar (süre bitti gibi), drink: içeceği, onTap: resmine dokununca (ipucu)
     */
    node({ lines = [], drink = null, onTap = null, rich = (t) => t } = {}) {
      richFn = rich;
      let content;
      if (hint && performance.now() < hint.until) content = [h('div', { class: 'ytalk plain' }, hint.nodes)];
      else if (lines.length) content = lines;
      else content = mode() === 'sohbet' && talk ? [h('div', { class: 'ytalk' }, rich(talk))] : [];
      bubble = h('div', { class: 'ybin' }, content);
      const outer = h('div', { class: `ybubble${content.length ? '' : ' empty'}`, role: 'status' }, bubble);
      const mute = h('button', { class: `ymute${mode() === 'sessiz' ? ' on' : ''}`, type: 'button', title: mode() === 'sessiz' ? 'Konuşsun' : 'Sustur',
        onclick: (ev) => {
          ev.stopPropagation();
          const m = mode() === 'sessiz' ? 'sohbet' : 'sessiz';
          settings.set('yanciMode', m);
          talk = '';
          ev.currentTarget.classList.toggle('on', m === 'sessiz');
          ev.currentTarget.textContent = m === 'sessiz' ? '🔇' : '🔊';
          ev.currentTarget.title = m === 'sessiz' ? 'Konuşsun' : 'Sustur';
          if (bubble?.isConnected && !hint) {
            bubble.replaceChildren();
            bubble.parentElement.classList.add('empty');
          }
        } }, mode() === 'sessiz' ? '🔇' : '🔊');
      const face = h('button', { class: 'yface', type: 'button', title: `${name()}: dokun, ipucu versin`, onclick: () => onTap && onTap() },
        avatarNode(settings.get('yanciPhoto') || '', settings.get('yanciAvatar') || YANCI_DEFAULT.avatar));
      const av = h('div', { class: 'yav' }, face, h('span', { class: 'yname' }, name()), mute, drink ? h('span', { class: 'ydrink' }, drink) : null);
      return h('div', { class: 'yanci' }, outer, av);
    },
  };
  return api;
}
