// Oyun kaydı. Yeni oyun eklemek = js/games/<oyun>.js yazıp buraya bir satır eklemek.
// status: 'ready' (oynanabilir) | 'soon' (menüde görünür, henüz kapalı)
// Menü grupları (her grup kendi içinde alfabetik)
export const GROUPS = [['kahvehane', 'Kahvehane oyunları'], ['kumarhane', 'Kumarhane oyunları'], ['tek', 'Tek kişilik']];
export const GAMES = [
  { id: 'king', group: 'kahvehane', name: 'King', desc: '4 kişilik el alma oyunu', players: '4', status: 'ready' },
  { id: 'pisti', group: 'kahvehane', name: 'Pişti', desc: 'Yerdekileri al, pişti yap', players: '2-4', status: 'ready' },
  { id: 'batak', group: 'kahvehane', name: 'Batak', desc: 'İhaleli koz oyunu', players: '4', status: 'ready' },
  { id: 'teksas', group: 'kumarhane', name: 'Teksas Poker', desc: 'Texas Hold’em, çiple', players: '2-4', status: 'ready' },
  { id: 'yanik', group: 'kahvehane', name: 'Yanık', desc: 'Per aç, işle, 100\'ü geçme', players: '2-4', status: 'ready' },
  { id: 'papazkacti', group: 'kahvehane', name: 'Papaz Kaçtı', desc: 'Eşleştirip elden çıkarma, papaz sende kalmasın', players: '2-4', status: 'ready' },
  { id: 'esek', group: 'kahvehane', name: 'Eşek', desc: 'Kart atma oyunu, son kalan eşek olur', players: '3-4', status: 'ready' },
  { id: 'fanti', group: 'kahvehane', name: 'Fanti', desc: '11 yap, kartları topla', players: '2 veya 4', status: 'ready' },
  { id: 'konken', group: 'kahvehane', name: 'Konken', desc: 'Elini per ve seriyle bitir', players: '2-4', status: 'ready' },
  { id: 'gin', group: 'kahvehane', name: 'Gin Rummy', desc: 'Kapı de ya da gin yap, 100\'e ilk ulaş', players: '2', status: 'ready' },
  { id: '51', group: 'kahvehane', name: '51', desc: 'Per açma oyunu (kuralları birlikte doğrulayacağız)', players: '4', status: 'soon' },
  { id: 'hoskin', group: 'kahvehane', name: 'Hoşkin', desc: 'İhaleli açma ve el alma oyunu (kuralları araştırılacak)', players: '3-4', status: 'soon' },
  { id: 'dostkazigi', group: 'kahvehane', name: 'Dost Kazığı', desc: 'Kuralları araştırılacak', players: '?', status: 'soon' },
  { id: 'pis7', group: 'kahvehane', name: 'Pis 7’li', desc: 'Kuralları araştırılacak', players: '?', status: 'soon' },
  { id: 'kambur', group: 'kahvehane', name: 'Kambur', desc: 'Kuralları araştırılacak', players: '?', status: 'soon' },
  { id: 'altmisalti', group: 'kahvehane', name: '66 (Altmışaltı)', desc: 'Evlilik ve koz puanlı el alma', players: '2', status: 'ready' },
  { id: 'blof', group: 'kahvehane', name: 'Blöf', desc: 'Kartları kapalı at, yalan söyle, yakalanma', players: '3-4', status: 'ready' },
  { id: 'kaptikacti', group: 'kahvehane', name: 'Kaptıkaçtı', desc: 'Kuralları araştırılacak', players: '?', status: 'soon' },
  { id: 'blackjack', group: 'kumarhane', name: 'Blackjack', desc: '21 oyunu, kasaya karşı', players: '1-4', status: 'ready' },
  { id: 'kilic', group: 'kahvehane', name: 'Kılıç', desc: 'Kılıç atmak (kuralları birlikte doğrulayacağız)', players: '?', status: 'soon' },
  { id: 'atyarisi', group: 'kumarhane', name: 'At Yarışı', desc: 'Bir renge bahis yap, ilk tamamlanan at kazanır', players: '2-4', status: 'soon' },
  { id: 'bakara', group: 'kumarhane', name: 'Bakara', desc: 'Oyuncu mu kasa mı, 9\'a en yakın kazanır', players: '1-4', status: 'soon' },
  { id: 'turkpoker', group: 'kumarhane', name: 'Türk Pokeri', desc: 'Kuralları birlikte doğrulayacağız', players: '2-4', status: 'soon' },
  { id: 'barbut', group: 'kumarhane', name: 'Kart Barbutu', desc: 'Kuralları birlikte doğrulayacağız', players: '2-4', status: 'soon' },
  { id: 'ucpoker', group: 'kumarhane', name: 'Üç Kart Poker', desc: 'Üç kartla kasaya karşı', players: '1-4', status: 'soon' },
  { id: 'casinosavasi', group: 'kumarhane', name: 'Casino Savaşı', desc: 'Büyük kart kazanır, eşitlikte savaş', players: '1-4', status: 'soon' },
  { id: 'solitaire', group: 'tek', name: 'Solitaire', desc: 'Klondike, bilinen klasik', players: '1', status: 'ready' },
  { id: 'golf', group: 'tek', name: 'Golf', desc: 'Bir büyüğü ya da küçüğü at, masayı temizle', players: '1', status: 'ready' },
  { id: 'spider', group: 'tek', name: 'Spider', desc: 'İki deste, papazdan asa sekiz dizi', players: '1', status: 'ready' },
  { id: 'freecell', group: 'tek', name: 'FreeCell', desc: 'Kartlar açık, dört boş hücre', players: '1', status: 'ready' },
];

// Oyun aileleri (ortak yardımcılar buna göre yazılacak):
//  el alma:     king, batak
//  bahis:       teksas
//  per açma:    yanik, fanti, konken, gin, 51
//  elden atma:  papazkacti, esek, pis7
//  ihale/açma:  hoskin, dostkazigi (kurallar araştırılınca ailesi netleşir)
//  kasaya karşı: blackjack (bahis ailesiyle ortak çip sistemi)
//  tek kişilik: solitaire, golf, spider, freecell (bot yok; motor tek insan koltuğuyla çalışır)

/** Oynanabilir oyunun modülünü yükler. Henüz hiçbiri hazır değil. */
export async function loadGame(id) {
  const meta = GAMES.find((g) => g.id === id);
  if (!meta || meta.status !== 'ready') throw new Error(`'${id}' henüz hazır değil`);
  const mod = await import(`./${id}.js`);
  return mod.default;
}
