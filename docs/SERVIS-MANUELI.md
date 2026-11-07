# Kart Salonu — Servis Manueli

Teknik bakım ve geliştirme notları. Bir şey bozulursa ya da oyun eklenecekse buradan başla.

## Klasör yapısı
```
index.html                  giriş
css/avrora.css              Avrora Pişti görünümü (masa, kartlar, düğmeler, sayaç)
js/core/rng.js              tohumlu rastgele (aynı seed = aynı oyun)
js/core/cards.js            kart modeli, deste, dağıtım
js/core/storage.js          güvenli depolama (localStorage yoksa bellek)
js/core/game-api.js         OYUN SÖZLEŞMESİ (zorunlu/isteğe bağlı fonksiyonlar)
js/core/engine.js           Table: bir oyunu insan ve botlarla oynatır
js/players/bot.js           ortak Bot (Kolay/Orta/Zor, tarz, hız, Monte Carlo)
js/players/roster.js        oyuncu listesi, istatistik, masa koltuk seçimi
js/players/settings.js      genel ayarlar
js/games/index.js           oyun kaydı (hangi oyun hazır / yakında)
js/ui/app.js                menü ve ayarlar ekranları
tests/                      Node testleri (sahte oyunla bot ve oyuncu listesi)
docs/                       hedef, süreç günlüğü, bu manuel, King kuralları
```

## Çalıştırma
- Windows: `Baslat.bat` (çift tık) → `sunucu.ps1` PowerShell ile http://localhost:8642 açar, tarayıcıyı başlatır; kurulum gerekmez. Port doluysa sonrakini dener.
- Diğer: klasörü herhangi bir statik sunucuyla aç (`python3 -m http.server`). `index.html`'e doğrudan çift tıklamak (file://) ES modüllerini açmaz.
- Testler: `node tests/run.js` (Node 18+). Tüm testler geçmeli.

## Yeni oyun ekleme (adım adım değil, özet)
1. `js/games/<oyun>.js` yaz; `export default` ile `game-api.js`'deki sözleşmeyi uygula.
2. `js/games/index.js`'de oyunun `status`'unu `'ready'` yap.
3. Kural testini `tests/` altına ekle; bot testinde yalnızca yasal hamle seçildiğini doğrula.
Oyun ailesine göre ortak yardımcılar ileride `js/core/` altına gelecek (el alma, per açma, bahis).

## Bot sistemi
- Seviye: **Kolay** (bazen rastgele, çok dikkatsiz), **Orta** (sezgisel `rateMove`, az dikkatsiz),
  **Zor** (varsa `determinize` ile Monte Carlo; yoksa sezgisel).
- Tarz (Temkinli/Dengeli/Atak) `rateMove`'a `risk` olarak geçer: 0.2 / 0.5 / 0.8.
- Hız: botun "düşünme" beklemesi (250 / 700 / 1300 ms), genel hız çarpanıyla ölçeklenir.
- Hafıza: `bot.memory`, her maç başında sıfırlanır; oyun `botObserve` verirse onu doldurur.
- Bir oyun `rateMove` ya da `determinize` vermezse bot rastgele yasal hamle seçer (oyun yine çalışır).
- İstatistik: oyuncu başına oyun bazında oynanan/kazanılan (`roster.recordResult`).

## Depolama
- Anahtarlar: `kartsalonu.roster.v1`, `kartsalonu.settings.v1`.
- Sürüm değişirse (`.v2`) eski veriyi okuyup taşıyan kod yaz; sessizce silme.
- Claude artifact sayfasında ve bazı gizli sekmelerde localStorage çalışmayabilir; uygulama bellek yedeğiyle açılır ve
  Genel sekmesinde uyarı gösterir.

## Bilinen sınırlar (v0.1)
- Henüz oynanabilir oyun yok; menüde "yakında".
- Service worker yok; bu yüzden çevrimdışı kurulum (PWA) henüz çalışmıyor. Claude artifact barındırması
  service worker'ı engeller; gerçek PWA için kendi barındırma gerekir (ör. GitHub Pages).
- Uygulama yalnızca Türkçe.

## Sorun giderme
- Ayarlar kayboluyor → tarayıcı depolamayı engelliyor (gizli sekme / artifact). Genel sekmesindeki uyarıya bak.
- Masada yeterli oyuncu yok hatası → Ayarlar > Oyuncular'da pasif oyuncuları etkinleştir.
- Test düşerse → önce `tests/run.js` çıktısındaki ilk FAIL satırına bak; çoğu zaman oyun modülü sözleşmeyi bozmuştur.

## King servis notları
- Kurallar: js/games/king.js üstündeki sabitler (puanlar `dealDelta`, haklar `PEN_LIMIT`, `PEN_PER_PLAYER`, `KOZ_PER_PLAYER`).
- Bot ilan dengesi: `BASELINE` (rateAnnounce). Kartlar metin: 'H13'.
- Zor seviye süresi: `profile.mcBudget` (varsayılan 400 simülasyon/hamle).
- Test: `node tests/run.js` (21 test).

## Yeni oyun ekleme (özet)
1. js/games/<id>.js (sözleşme: game-api.js), 2. js/ui/<id>-table.js (table-kit.js'in createMatchScreen'i), 3. index.js'te status 'ready', 4. app.js routes'a ekle, 5. test.
Fotoğraf sınırı: 60 KB (validPhoto).

## Animasyon sistemi (v0.4)
- Kurallar: docs/ANIMASYON-KURALLARI.md (zorunlu). Proje kökündeki CLAUDE.md her modele bunu okutur.
- js/ui/anim.js: `T` süre tablosu, `EASE` eğrileri, `fly()` (kaynak kutudan hedef kutuya, #fx katmanında), `measure/flipFrom` (eldeki boşluk kapanması), `jitter` (masadaki sabit sapma).
- js/ui/table-kit.js: `ctx.pend` (görünmez yer tutucu), `ctx.adj` (geçici kart sayısı), `ctx.cardBox/seatBox/deckBox/centerBox`, `ctx.fly/reveal/hide`, `choreo.deal/collect`.
- Hız: Ayarlar > Genel'deki hız çarpanı tüm süreleri çarpar.
- King artık table-kit üstünde (eski ayrı döngü kaldırıldı).

## v0.5 oyunları (Batak, Blackjack, Blöf, Poker)
- Kural motorları `js/games/{batak,blackjack,blof,poker}.js`, ekranlar `js/ui/*-table.js`. Kurallar `docs/*-KURALLARI.md`.
- Ayarlar: `blackjackPlayers` (1-4), `blofPlayers` (3-4), `pokerPlayers` (2-4). Batak her zaman 4 kişi.
- Bot sözleşmesine eklenen isteğe bağlı alan: `mcPhase(view)`; false dönerse Zor seviye Monte Carlo yerine sezgiye düşer (Batak'ta ihale/koz).
- `table-kit.js`: `handRow(..., { selected })` artık `Set` kabul eder (Blöf'te çoklu kart seçimi); 1 kişilik düzen (Blackjack).
- Blöf'te `moveKey` kartları sayıya göre normalleştirir (aynı sayılı kartlar denk), böylece hamle listesi küçük kalır.
- Poker bot ayarı: `rateMove` puanları `tanh(EV / (havuz+görme+kör))` ile sıkıştırır; yoksa seviye gürültüsü büyük raise'lerle şişer.
- Tarayıcı test betikleri (geçici, /tmp): `g7.py`, `g8.py`, `pendcheck.py`; yeni oyunda yer tutucu denetimi için çalıştır.

## v0.6-v0.7 eklentileri
- **Yönerge** `js/ui/tutor.js`: `advise(game, view, moves)` en yüksek `rateMove` hamlesini ve açıklamasını döner; `review(adv, move)` değerlendirir.
  Yeni oyunda `LABEL` ve `EXPLAIN` tablolarına bir satır ekle. table-kit şeridi elin üstüne koyar; süre bitiminde önerilen hamle oynanır.
- **Sohbet** `js/ui/chat.js`: söz havuzları `L`, cevaplar `REPLY`. `onMove` oyuna özel anları (`gameId` ile) ve genel puan farkını yakalar.
  Yeni oyunun özel anı varsa `onMove` başına bir satır ekle. Balonlar `#chatfx` katmanında, konuşanın kutusunun (`.ks[data-seat]`) yanında.
- **Süre halkası** table-kit `startClock(seat, ms, onTimeout)`: avatar sarmalayıcısı `.avw` üzerinde `--t` (0-1) ve `--c` her karede güncellenir. CSS animasyonu yok.
- **Motor** `pace(info, { seat, moves, view })` alır; `onEvent('start')` beklenir.
- **Ayarlar:** `turnLimit` (0/15/30), `chat`, `tutor`, `konkenScoring`/`konkenJoker`/`konkenCifte`, kişi sayıları (`fantiPlayers`, `konkenPlayers`, `pistiPlayers`; soruyla değişir).
- **Tema:** css/avrora.css sonunda "TEMA D" bloğu; renkler `:root` değişkenleri. `.pend` kuralı her zaman dosyanın en sonunda kalmalı.
## v1.1 — Mola, paralı Yanık
- **Mola** (table-kit): üst çubukta ⏸ (CSS iki çizgi, emoji değil) ve menüde "Mola ver". `paused` iken `whilePaused()` sözü `pace` (bot düşünmesinden sonra) ve `ctx.wait` içinde beklenir;
  sayaç `.overlay` varken zaten durur. Uygulama arka plana geçince (`visibilitychange`) kendiliğinden mola. `stop()`/`destroy()` bekleyenleri bırakır, dinleyiciyi kaldırır.
- **Paralı Yanık:** motorda `money`, `pot`, `entry`, `out`, `queue`, `phase:'rebuy'`; hamleler `{t:'rebuy'}`/`{t:'quit'}`. `publicEvent.newRound` yeni dağıtımı söyler;
  ekran el sonunda faz `rebuy` ise dağıtmaz, son karar hamlesinde `newRound` gelince dağıtır. Çekilen oyuncuya kart dağıtılmaz. `makeConfig` cüzdanı `settings.wallet`'tan verir,
  `endHead` oyun sonunda geri yazar. Test için `LIMIT` geçici olarak düşürülüp kopya klasörde denenir (asıl dosyada değil).
## v1.2 — Yatay düzen, el düzeni, masa kartı ölçüsü
- **Yatay:** table-kit `landscape()` tek sütun: `.lmain` = üst, masa, ek düğümler, `.lband` (botrow + kinfo + tutor), paneller (mutlak, `--band-h`'e göre), el. Yan sütun yok; `handRow` tam genişliği kullanır.
- **Masa kartı:** `--tc-w`/`--tc-h` (dikey 60×86, yatay 72×103, yüksek PC 92×132, alçak 52×74). `pileCard` dx/dy'yi `--tc-w/52` ile ölçekler; özel kart sınıfları (Yanık ypc/ymc, 66 trumpc) değişkeni kullanır. Poker/Blackjack kendi küçük ölçüsünde.
- **Dokunarak çekme:** `ctx.tapDraw(el, fn)` → `.drawtap` (sabit ince çerçeve). Destede yalnız en üst katman çerçevelenir.
- **El düzeni:** spec `arrange: true` botrow'a "Düzenle" koyar. Ekran `ctx.ordered(hand, autoFn)` ile çizer, dağıtımda `ctx.resetOrder()`. `handRow({drag:true})` işaretçi olaylarıyla sürükler (10 px eşik, sonra click yok sayılır), bırakınca `render()` FLIP ile kaydırır.
- **Gin:** `js/games/gin.js` per bulucu bütün aday perleri DFS ile dener (10-11 kart, hızlı); savunma için bütün dizilişler + zincirleme işleme.
## v1.3 — Yancı
- `js/ui/yanci.js` `createYanci({h, settings})`: `mode()`, `node({lines, drink})`, `start/afterMine/afterMove/end/thanks/refill/reset`. Sohbet sözleri balonun iç kutusunu (`.ybin`) yerinde günceller; yeniden çizim beklemez.
- table-kit `yanciStrip()` eski `tutorStrip()`'in yerine: yönerge satırlarını (review + advice) yancıya verir; `tutorOn()` = mod 'yonerge'. Yatayda `.lband` içinde, dikeyde elin üstünde.
- Ayarlar: `yanciMode` ('yonerge'|'sohbet'|'kapali'), `yanciName`, `yanciAvatar`, `yanciPhoto`. Eski `tutor:false` yüklemede `yanciMode:'kapali'`ya taşınır.
- Kahvehane `drinks` artık nesne; 'y' anahtarı yancının içeceği (`cafe.node('y')`).
## v1.4 — Yazboz, oyun içi ayarlar
- table-kit yazboz: `sheetRecord(e, before)` her hamlede; satır yalnız `roundEnd`/`dealEnd`/oyun sonu olaylarında ve toplam değiştiyse (fark yazılır). Oyun özelleştirmesi: `spec.tally(state)` → `{head, totals, note}`, `spec.yazbozRow(e, before)` → `{label, cells}`, `spec.yazboz: false`.
- `sheetMini()` `.toprow` içinde (sol üst, `.toprow:has(.ybz.mini)` ile üstteki oyuncu sağa kayar), `showSheet(after)` tam kâğıt.
- `pauseDialog()` mola penceresi; `openSettings(onClose)` app.js'ten gelir: `generalTab()` katmanda (`.setov`), içerideki yenilemeler `rs()` ile yalnız katmanı tazeler (`settingsRefresh`). Saat `.overlay, .setov` varken durur.
- `.deck.nearpile`: deste ortada, yerdeki kartların solunda.
## v1.5 — Ses, amblem
- `js/ui/sfx.js`: `initSfx(settings)` (app.js), `sfx.card/turn/turnBot/tick/msg`. AudioContext ilk dokunuşta açılır; her ses kendi arasında aralık sınırlı (`gate`). `anim.fly` her uçuşta `sfx.card()` çalar (`opts.silent` ile susturulur). Ayar: `sound`, `soundVol`.
- `js/ui/logo.js` `logoSvg(size)`: ana menü `brand()` ve sekme simgesi.
- Yancı balonu: table-kit `yanciStrip()` tek `ytalk plain` satırı üretir; `lastReview.better` = o anki öneri etiketi.
## v1.6 — Yayın (GitHub Pages) ve kurulabilir uygulama
- Depo: `erdoganhazer/dostlar-kahvehanesi` (önerilen ad). Settings › Pages › Kaynak: **GitHub Actions**. `main`'e her gönderim `.github/workflows/pages.yml`'ı çalıştırır: `node tests/run.js` → `node tools/build-sw.mjs` → `_site` (index, manifest, sw.js, css, js, assets) → Pages.
- `tools/build-sw.mjs`: `tools/sw.template.js`'ten `sw.js` üretir; dosya listesi + içerik özetinden sürüm. Yerelde yeni dosya eklediysen çalıştır (Actions zaten çalıştırır).
- Servis işçisi yalnız kendi adresinde (https/localhost) ve gömülü değilken kurulur (claude.ai önizlemesinde kurulmaz). Önce önbellek; yeni sürüm arka planda iner, sonraki açılışta geçerli.
- Simgeler `assets/icons/` (amblem `js/ui/logo.js`'ten Playwright ile basıldı). Yükle düğmesi `beforeinstallprompt` gelince menüde çıkar.
## v1.7 — Yancı Şerif, içecek dosyaları, avatarlar, sinir, gruplar
- Yancı: `createYanci({h, settings})` → `mode()` ('sohbet'|'sessiz'), `node({lines, drink, onTap, rich})`, `showHint(nodes)` (9 sn), `say` sık konuşmaz. table-kit `hintText()` resme dokununca: öneri (sıra sendeyse) ya da gidişat. Sürekli öneri yok (`tutorOn() = false`).
- İçecekler: `assets/drinks/<tür>.svg` (`id="sivi"` sıvı katmanı, `data-sivi-ust/alt`, kahve-salep `data-sivi-mod="kaydir"`). `loadDrinkFiles()` app.js'te; dosya yoksa yerleşik çizim. Öğeler kalıcı (`els[i]`), buhar WAAPI.
- Avatarlar: `js/ui/avatar.js` LOOKS a1–a8 (çizim). Roster `AVATARS`, `MAX_BOTS = 3`; geçersiz avatar yüklemede a1–a8'e çevrilir.
- Sinir: chat.js `trackAnger`, `angerOf(i)` (ayar `anger`); kutu sınıfı `angry`/`furious`.
- Menü: `GROUPS` (index.js) + her oyunda `group`; grup içinde `localeCompare('tr')`.
## v1.8 — Tek kişilik oyunlar
- Motor: `js/games/sol-common.js` `withUndo(game)` 1 koltuk sarmalayıcı: `{t:'undo'}`, `{t:'resign'}`, `hist` (300), `moves`, `last`, `stuck` (geri al/bitir dışında hamle yok; oyun bitmez). `rateMove` sarmalı son hamleyi geri çeviren hamleye −60.
- Yığın kimlikleri: `t0..` sütun, `f0..` temel, `c0..` hücre, `s` deste, `w` açık. Hamle `{t:'mv', from, to, n}`, `{t:'draw'}` (Klondike/Golf), `{t:'deal'}` (Spider). Çift deste kimliği `S14a`.
- Ekran: `js/ui/sol-table.js` `createSolScreen(deps, opt)`; `opt.layout(state)` → `{cols, need, piles:[{id, col, row, cards:[{c,up}], fan:'down'|'right'|'stack', label}]}`; `opt.status/auto/mid/stuckText/fmtScore/rules/menu`. Oyunlar `js/ui/sol-games.js`. `spec.solo` table-kit'te: süre yok, sıra sesi yok, yancı hamle yorumu yok. `ctx.newGame(confirm)`.
- Animasyon: hamle öncesi `.solc` konumları ölçülür → yeni durum çizilir → kayan kart WAAPI ile eski yerinden (FLIP; yüz değişirse yolda scaleX), yerinde açılan kart `A.flipInPlace`. Spider'da tamamlanan dizi önce sütunda görünür (`opt.mid`), sonra kalkar.
- İpucu metinleri `js/ui/sol-tutor.js` (tutor.js LABEL/EXPLAIN'e eklenir): belirtme/ilgi ekleri rakamın okunuşuna göre ("Maça 3'ü", "Kupa 6'nın").
- Ayarlar: `solDraw` (1|3), `spiderSuits` (1|2|4); oyun menüsünden değişir.
## v1.9 — Kılıç ve kumarhane oyunları
- `js/games/casino-common.js`: `BETS`, `START_CHIPS`, `ROUNDS`, `deckFor(seed, round)`, `betMoves`, `rateBet(v, ctx)` (risk iştahına göre hedef miktar). Motorlar: `kilic.js`, `atyarisi.js` (`race(deck)`), `bakara.js` (`coup`, `bankerDraws`, `payout`), `ucpoker.js` (`evalHand`, `cmp`, `qualifies`, `shouldPlay`), `savas.js`.
- El sonu olayı `roundEnd` (tüm açılan kartlar ve sonuç), dağıtım olayı `dealLog` (Üç Kart Poker, Savaş). Ekran `disp` ile eli adım adım oynatır, sonra `null`.
- `js/ui/kasa-kit.js`: `cardRow` (kapalı kart kimliği `x:<kim>:<sıra>`), `dealIn`, `dealAll`, `turnUp`, `collect`, `betPanel`, `money`. Blackjack satır sınıfları (`.bjrow/.bjc`) kullanılır.
- table-kit: `spec.chance` (şans oyunu: yancı hamleyi eleştirmez); bahis hamlesi (`t:'bet'`) hiçbir oyunda eleştirilmez.
- Ayarlar: `atyarisiPlayers` (2–4), `bakaraPlayers`, `ucpokerPlayers`, `savasPlayers` (1–4); oyun açılırken sorulur.
- Menü kimliği `savas` (eski 'casinosavasi'); `turkpoker`, `barbut` kaldırıldı.
## v1.10
- Roster yüklemede `RENAME`: bot-1/2/3 eski varsayılan adlardaysa Sezai/Kartal/Hilmi ve a1/a2/a3.
- `sfx.win()`; table-kit `finish` insan kazanınca ya da `spec.wonByScore(res)` doğruysa çalar.
- v1.10.1: a1–a4 artık resim: `assets/avatars/<key>.webp` (avatarSvg SVG içinde `<image>` döndürür). Değiştirmek için aynı adla 256×256 webp koy. portraits.js kaldırıldı.
## v1.11
- İpucu vurgusu: table-kit `mark` ({src, dst, piles}); `spec.hintMarks(move, state)` yoksa hamledeki `c`/`cards`/`card` (kaynak) ve `take` (hedef). Render sonrası `applyMarks()` sınıf ekler: `.hintsrc`, `.hintdst` (css sonunda). sol-table `hintMarks` yığın kimliğiyle (`data-pile`).
- Yancı: `TALK_MS` (6 sn) sonra söz solar (`fadeOut`), `talkLive()`.
## v1.12
- Çıkış onayı: table-kit `busy()` (oyun sürüyor mu); app.js `guard` + `onRoute()` hashchange'i yakalar, `history.pushState` ile adresi geri alır, `.overlay.leaveask` sorar.
- Zemin: `settings.bg`, app.js `BACKGROUNDS`, `applyBg()` → `html[data-bg]`; css `--bgA/--bgB/--bgC` ve `.window` radial-gradient. Yeni renk: BACKGROUNDS'a satır + css'e `html[data-bg=…]` satırı.
- Sürükle: sol-table `dragStart/dragMove/dragEnd` (pointer olayları), hedef `elementsFromPoint` → `[data-pile]`; bırakınca FLIP o konumdan yerine kaydırır.
- Elden masaya sürükleme: `handRow({..., onDrop(c)})` — oynandıysa true döndür. table-kit `dragable(btn, c, drop)`; bırakınca yukarı 70 px'ten fazla çekildiyse ya da `.center/.ktable` üstündeyse `drop`, olmazsa render (FLIP ile geri kayar).
