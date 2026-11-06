# Animasyon kuralları (Kart Salonu)

Bu kurallar **bütün oyunlar** için geçerlidir. Yeni bir oyun ya da ekran yazmadan önce baştan sona oku.
Amaç: masa gerçek bir masa gibi davranmalı. Kart ancak gerçekte gidebileceği yoldan gider.

## 1. Temel ilke: statik çizim + ayrı katmanda uçuş
- Ekran (`spec.render`) her zaman **statik** çizilir. CSS `@keyframes`, `animation`, `.new` gibi
  "yeniden çizimde oynayan" animasyon sınıfları **yasak** (`css/avrora.css` içinde hiç yok, öyle kalmalı).
- Hareket eden her kart `js/ui/anim.js` ile ekranın üstündeki `#fx` katmanında uçar.
  Kart hedefinde statik olarak zaten çizilmiştir ama `pend` (görünmez) durumundadır; uçuş bitince `ctx.reveal(id)`.
- Yeniden çizim (render) hiçbir zaman bir animasyonu baştan başlatmaz.

## 2. Kaynak ve hedef ÖLÇÜLÜR, tahmin edilmez
- Kaynak, yeniden çizimden **önce** ölçülür: `ctx.cardBox(kart)` (elindeki kart, yığındaki kart),
  `ctx.seatBox(koltuk)` (rakibin kutusundaki küçük kartlar), `ctx.deckBox()`, `ctx.centerBox()`.
- Hedef, kart `pend` olarak yerine çizildikten **sonra** ölçülür: `ctx.pend.add(id); ctx.render(); ctx.cardBox(id)`.
- Sabit ofsetle "5 kat uzaktan gelsin" gibi uydurma başlangıç noktası kullanılmaz.

## 3. Görüntü, kart inmeden değişmez
- Kartı alan tarafın görüntüsü (eli, kart sayısı, yığını) kart **inince** değişir. Kartı veren tarafınki kart **çıkınca** değişir.
- Motor durumu hemen ilerler; ekran geçici bir görünümle (`disp`) gerçeği takip eder. Koreografi bitince `disp = null`.
- Rakibin kart sayısı geçici olarak `ctx.adj[koltuk]` ile düzeltilir (dağıtımda −n'den başlar, her inişte +1).
- Yeni dağıtım, önceki elin son kartı toplanmadan görünmez.

## 4. Gizli bilgi
- Rakibin elindeki kart kapalı (arka yüz) hareket eder. Masaya açık oynanan kart açık uçar.
- Sana gelen kart yolda yüzünü çevirir (`flipTo` / `reveal: true`). Senin verdiğin kapalı kart (Eşek) kapalı gider.
- Senin görmediğin bir kartı animasyon da göstermez.

## 5. Sıra ve eşzamanlılık
- Gerçekte sırayla olan şeyler sırayla: oynama → okuma molası (`T.read`) → toplama.
- Gerçekte aynı anda olanlar aynı anda, küçük kaydırmayla (`delay`): Eşek'te kart verme, toplamada `collectStagger`, dağıtımda `dealStagger`.
- Dağıtım sırası gerçekteki gibi: tek tek, koltuk koltuk, desteden.

## 6. Hareketin kendisi
- Süreler `anim.js` içindeki `T` tablosundan alınır, elle sayı yazılmaz (`A.dur('play')`). Ayarlardaki hız çarpanı buna uygulanır.
  `prefers-reduced-motion` açıksa süreler %15'e iner.
- Eğriler `EASE`: inişte `land` (yavaşlayarak oturur), kalkışta `leave`, oyuncudan oyuncuya `move`. Zıplama, esneme, sallanma yok.
- Kartlar ortadan "belirmez" ve "solmaz". Tek istisna: bir oyuncunun aldığı destesine karışırken son %20'de kaybolma (`fadeEnd`).
- Masadaki kartın yeri ve açısı sabittir (`A.jitter(id)` ya da oyuna özel yuva tablosu). Her çizimde aynı yerde durur.
- Eldeki kart çıkınca diğerleri boşluğu kayarak kapatır (FLIP; `render()` bunu kendiliğinden yapar). Kartlar sıçramaz.
- Vurgu, parlama, yanıp sönme, "attı" etiketi yok (kullanıcı istemedi). Sıra kimdeyse kutusu çok hafif açık zemin alır, o kadar.

## 7. Etkileşim
- Seçim gerektirmeyen oyunlarda karta tek dokunuş yeter. Yanlış kart pahalıysa (King) iki dokunuş: ilk dokunuş kartı kaldırır.
  Tek yasal kart varsa tek dokunuş.
- Animasyon sürerken insan hamlesi istenmez (`ctx.awaiting` yalnızca koreografi bitince doğrudur; `disp` doluyken el pasif).
- Elde az kart varsa kartlar açılır, çok kartta üst üste biner (`handRow` aralığı kendisi hesaplar).

## 8. Yeni oyun için kontrol listesi
1. `js/ui/<oyun>-table.js`, `createMatchScreen` (table-kit.js) kullanır; kendi `Table` döngüsü yazmaz.
2. `render(ctx)` statik: masadaki kart `ctx.pileCard`, el `ctx.handRow`, deste `ctx.deck`, koltuklar `ctx.table({count})`.
3. `onStart(ctx)`: açılış dağıtımı (`choreo.deal`).
4. `onMove(e, ctx, before)`: her hamle için koreografi. Şablon:
   ```js
   const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);   // 1) kaynak (çizimden önce)
   disp = { ...önceki görünüm, kart hedefte };                      // 2) geçici görünüm
   ctx.pend.add(c); ctx.render();                                    // 3) hedef yerine görünmez çizilir
   await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur('play'), easing: A.EASE.land });
   ctx.reveal(c);                                                    // 4) iner, görünür
   ...gerekirse: await ctx.wait('read'); await choreo.collect(ctx, kartlar, alan);
   disp = null;                                                      // 5) gerçek duruma dön
   ```
5. Tarayıcıda kare kare kontrol: uçuş sırasında ekran görüntüsü al (`#fx .fxw` varken), kaynak ve hedefin doğru olduğuna bak.
   Sorulacak sorular: kart doğru yerden mi çıktı? Hedef kart inmeden değişti mi? Bir şey ışınlandı mı? Gizli kart göründü mü?

## 9. Yer tutucu gerçekten görünmez olmalı (hata dersi, v0.4.1)
**Olay:** Papaz Kaçtı'da çektiğin kart önce elinde belirdi, sonra animasyon aynı kartın üstüne uçtu.
Aynı hata King/Pişti/Eşek'te dağıtılan ve sana gelen kartlarda da vardı.
**Sebep:** Eldeki kart düğmesi `.kc { all: unset }` ile yazılmıştı. `all: unset` dosyada `.pend { visibility: hidden }`
kuralından SONRA geldiği için gizlemeyi siliyordu. Masadaki kartlarda (`.pc`) sorun yoktu, o yüzden fark edilmedi.
**Kurallar:**
- `.pend` gizlemesi `!important` ve CSS dosyasının en sonundadır; başka hiçbir kural `visibility`'yi ezemez.
- Yeni bileşende `all: unset` / `visibility` / `display` kullanırken `.pend` ile birlikte dene.
- `table-kit.js` her çizimden sonra `ctx.pend` içindeki kartların gerçekten görünmez olduğunu kontrol eder
  (`assertPendHidden`); görünüyorsa konsola `[animasyon kuralı §9]` hatası yazar ve zorla gizler.
  Tarayıcı testinde bu hata görülürse oyun hatalı sayılır.
- Kontrol testi: uçuş sırasında (`#fx .fxw` varken) `document.querySelectorAll('.pend')` öğelerinin hepsinin
  `getComputedStyle(e).visibility === 'hidden'` olduğunu doğrula. Bu kontrol her oyunun tarayıcı testinde yapılır.

## 10. Ölçüm ancak ekran sayfadayken yapılır (aynı incelemede bulundu)
Maç, ekran sayfaya eklenmeden başlıyordu; açılış dağıtımı ölçümleri sıfır çıkabiliyordu (kartlar sol üst köşeden gelebilirdi).
`table-kit.js` artık maçı ekran sayfaya eklendikten sonraki karede başlatır. Kendi döngüsünü yazan ekran olmayacak;
olursa aynı kuralı uygular: `body.isConnected` olmadan `getBoundingClientRect` ile ölçüm yapma.

## 11. Motor sonraki ele hemen geçiyorsa: sonuç görüntüsü olayda gelir
Blackjack ve Poker'de son hamle eli bitirir ve `applyMove` aynı anda yeni eli kurar. Ekran hâlâ biten elin kartlarını göstermeli
(krupiyenin kartı açılacak, showdown yapılacak, kartlar toplanacak). Bu yüzden oyun modülü `publicEvent` içinde bitmiş elin
görüntüsünü verir (`roundEnd` / `handEnd`: eller, açılacak kartlar, ödemeler, bakiye) ve ekran bu görüntüyle geçici bir sahne (`disp`) kurar.
Yeni elin dağıtımı bu sahne toplandıktan sonra, yeni durumdan çizilir. Kural: ekran bitmiş elin bilgisini `e.state`'ten okumaz.
Gizli kart (krupiyenin kapalı kartı) yer tutucu kimliğiyle (`hole`) çizilir; gerçek kart ancak açılış anında `flipInPlace` ile gösterilir.

## 12. Kart kalkışta yüz değiştirmez (v0.5.1 incelemesi)
Açık duran bir kart (elindeki kart) kapalı gidecekse açık kalkar ve **yolda kapanır**: `ctx.fly(c, from, to, { conceal: true })`.
Kapalı bir kart sana geliyorsa kapalı kalkar, yolda açılır: `{ reveal: true }` (ya da `flipTo`). Kalkış anında yüz/arka değiştirmek
(elinden açık kart çıkıp havada birden arkası görünmesi) ışınlanma sayılır. Örnekler: Blöf'te kapalı attığın kartlar,
Eşek'te önüne kapalı koyduğun kart, Papaz'da senden çekilen kart, Poker'de pas geçtiğinde bıraktığın kartlar.

## 13. Kart nereden gelirse oraya döner, sayılar anında güncellenir
- Desteden dağıtılan oyunlarda deste masada görünür ve dağıtım, açılan ortak kartlar, toplanan kartlar **desteden/desteye** gider
  (Poker'de flop artık ortak kart sırasının ortasından değil, masadaki desteden gelir).
- Rakibin kutusundaki kart sayısı yeniden çizim beklemeden, kart kalkınca azalır, inince artar: `ctx.bumpCount(koltuk, ±1)`.
  Uçuş sürerken `ctx.render()` çağırma (kaynakta `ctx.hide` ile gizlenen kartlar yeniden görünür).
- Destenin üstündeki sayı kart inince düşer, önce değil (Blackjack: masadaki inmiş kartlardan hesaplanır).
- Açılan kartlar (Blöf'te "yalan!") yığındaki **kendi** yerlerinden kalkar. Showdown'da rakibin kartları kutusundan kalkınca kutu boşalır.
