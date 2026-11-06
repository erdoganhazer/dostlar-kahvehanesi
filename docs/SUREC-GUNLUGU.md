# Süreç Günlüğü

## 2026-11-05 — v0.1: çekirdek, ortak bot sistemi, oyuncu ayarları
**Bağlam:** Kullanıcı, Avrora Pişti'ye benzeyen bir King (Rıfkı) istedi; sonra telefonda oynanması,
ileride Batak, Teksas Poker, Yanık, Papaz Kaçtı, Eşek, Fanti, Konken eklenmesi ve tüm oyunlarda aynı
bot oyuncuların çalışması istendi. PWA onaylandı.

**Yapılanlar**
- Avrora Pişti exe'si incelendi (Delphi, kaynaklar paketli, çalıştırılamadı). Görünüş kullanıcının
  ekran görüntülerinden alındı: #008000 masa, beyaz kartlar, mavi-kırmızı desenli arka yüz, "000" sayaç, beyaz menü çubuğu.
- Çekirdek: kart/deste, tohumlu rastgele, güvenli depolama, oyun sözleşmesi, masa motoru.
- Ortak bot sistemi: Kolay/Orta/Zor, 3 tarz, 3 hız, Monte Carlo (Zor), hafıza, oyun bazında istatistik.
- Oyuncu listesi (6 varsayılan bot, en fazla 12): ekle/düzenle/sil/sırala, pasife alma; tüm oyunlarda aynı liste.
- Arayüz: ana menü, Ayarlar (Oyuncular, Genel), kart önizleme. Mobil boyutta tarayıcıda denendi.
- King kuralları araştırıldı: `KING-KURALLARI.md`.
- Testler: 17 test geçiyor (sahte "Sayı Düellosu" oyunuyla botların Kolay < Orta < Zor olduğu 300'er maçla doğrulandı).

**Kararlar ve notlar**
- Yanık'ın kuralları kullanıcı tarafından da bilinmiyor; örnek olarak verildi. Sonra birlikte öğrenilecek.
- Service worker artifact ortamında engelli → gerçek PWA için barındırma kararı sonra.
- Kural farklarının çıkacağı yerler (King) Ayarlar'da seçenek olacak.

**Oyun listesine eklenenler (kullanıcı isteği, hepsi "yakında"):** Papaz Kaçtı, Eşek, Fanti, Konken, 51, Hoşkin,
Dost Kazığı, Pis 7'li, Blackjack, Solitaire, Golf, Spider, Freecell, Kambur, 66 (Altmışaltı), Blöf, Kaptıkaçtı.
Hoşkin, Dost Kazığı, Pis 7'li, Kambur, Blöf, Kaptıkaçtı ve Yanık'ın kuralları sırası gelince araştırılıp doğrulanacak.

**Sıradaki**
1. King modülü (kural motoru, `rateMove`, `determinize`, masa arayüzü).
2. King için kalan doğrulamalar (`KING-KURALLARI.md` sonundaki liste).
3. Batak.

## King oynanabilir (v0.2)
- js/games/king.js: tam kural motoru (20 el, ilan hakları, ceza/koz, yasal hamleler, puanlar, King, kız almaz yeniden dağıtım, erken bitiş).
- Bot: ilan için el değerlendirme (ortalama ele göre avantaj), oynayış için olasılık sezgisi (rateMove), Zor seviyede determinize + Monte Carlo (yalnızca o eli simüle eder: `horizon`).
- Test: Zor, 3 Kolay'a karşı ortalama +1100; Orta, Kolay'a karşı +350. Bot maçları toplamı 0.
- Arayüz: js/ui/king-table.js (dikey telefon masası, iki dokunuşla oynama, skor, kurallar, el sonu özeti).
- Engine artık onEvent'i `await` eder (arayüz bekleyebilsin). Ayarlar'a "King bitirir" seçeneği eklendi.
- Henüz yapılmadı: ceza oyunlarında kız/erkek zorunlu atma, "üstüne çıkma zorunlu" seçeneği, 12 el modu, kötü el yeniden dağıtımı.
- Kısıt: Zor seviye bot düşünürken arayüz kısa süre donabilir (Worker'a taşınacak).
- Kart resimleri: public domain Vector Playing Cards (hayeah/playing-cards-assets, MIT), assets/cards/{S,H,D,C}{2..14}.webp. Masa: yığın düzeni (kartlar oynayanın yönünden gelir, kazanan süpürür). Ana menü karo düzeni, King yönergesi.

## v0.3 — Pişti, Papaz Kaçtı, Eşek, avatar fotoğrafı
- Pişti (2/4 kişi): js/games/pisti.js, standart puanlama (pişti 10, valeli pişti 20, vale/as 1, sinek 2 → 2, karo 10 → 3, çok kart 3). Bot kart sayarak rakibin eşleme ihtimalini tahmin eder.
- Papaz Kaçtı (2-4): 3 papaz çıkarılır, 49 kart (kaynak: Milliyet/Trendyol "papaz kimde"). Şans oyunu; bot seviye farkı yok.
- Eşek (3-4): 4'lü toplama + tepki. Insan tepkisi tarayıcıda ms olarak ölçülür; botların tepkisi seviye/hıza göre (Kolay ~950, Orta ~700, Zor ~480 ms). Dört harf (E-Ş-E-K) dolduran eşek olur. Kaynak: Vikipedi "Eşşek (iskambil oyunu)".
- Ortak masa iskeleti: js/ui/table-kit.js (yeni oyun = oyun modülü + küçük bir *-table.js).
- Avatar: emoji ya da yüklenen fotoğraf (96x96 JPEG, veri adresi olarak oyuncu kaydında). Ayarlar > Oyuncular > Düzenle ve Genel > Avatarın.
- Ayarlar > Genel: Pişti/Papaz/Eşek kişi sayısı.
- Testler: 25.

## v0.4 — Animasyon sistemi baştan yazıldı (Opus)
İncelemede bulunan gerçek dışı durumlar:
- Kart, oynayanın yerinden değil sabit bir ofsetten (çapraz) geliyordu; insanın kartı elindeki yerinden çıkmıyordu.
- Her yeniden çizimde CSS animasyonları baştan oynuyordu; kartlar "boş doğup" sonra doluyordu.
- Toplanan el, alan oyuncuya değil sabit bir yöne kayıp soluyordu; kartlar ortadan beliriyor/soluyordu.
- Dağıtım hiç yoktu: eller bir anda beliriyordu. Pişti'de deste görünmüyordu.
- Hedefteki el ve sayılar kart inmeden değişiyordu (Eşek, Papaz, Pişti, King yeni dağıtım).
- Elden kart çıkınca diğer kartlar sıçrıyordu. Az kartlı elde kartlar gereksiz üst üste biniyordu.
- Papaz Kaçtı'da çiftler görünmeden kayboluyordu.
Çözüm: statik çizim + ölçülü uçuş katmanı (js/ui/anim.js), ortak koreografiler (dağıtım, toplama), FLIP ile el düzeni,
geçici görünüm (disp/pend/adj). Kurallar docs/ANIMASYON-KURALLARI.md, model talimatı CLAUDE.md.
Yeni: King/Pişti/Papaz/Eşek açılış dağıtımı; Pişti destesi; Papaz'da çiftler ortaya açık atılır (oyun durumu `discarded` tutar);
Eşek'te kart önce önüne kapalı konur, sonra hepsi aynı anda soldakine geçer; el sonunda kartlar ortada toplanıp yeniden dağıtılır.

## v0.4.1 — Yer tutucu görünürlük hatası
- Hata: çekilen/dağıtılan/gelen kart, uçuş bitmeden elinde görünüyordu (Papaz'da kullanıcı fark etti; King, Pişti, Eşek'te de vardı).
- Sebep: `.kc { all: unset }` CSS'te `.pend` gizlemesinden sonra geldiği için onu siliyordu.
- Düzeltme: `.pend` `!important` ve dosya sonunda; table-kit her çizimden sonra yer tutucuların görünmez olduğunu denetliyor.
- Ek bulgu: maç ekran sayfaya eklenmeden başlıyordu (açılış ölçümleri boş çıkabilirdi); artık sonraki karede başlıyor.
- Kurallar: docs/ANIMASYON-KURALLARI.md §9, §10. Tarayıcı testi: uçuş anlarında 450+ kontrol, görünen yer tutucu 0.

## v0.5 — Batak, Blackjack, Blöf, Teksas Poker (Opus)
- **Batak** (4 kişi, ihale + koz, 5 el): `js/games/batak.js`, bot: tahmini el sayısıyla ihale, koz seçimi, yükseltme zorunluluğu; Zor seviye Monte Carlo (yalnızca oynama aşamasında, `mcPhase`).
- **Blackjack** (1-4 kişi, çip, 10 el): temel strateji botu, krupiye kapalı kartı yerinde çevrilir, kartlar desteden uçar.
- **Blöf** (3-4 kişi): kapalı kart atma, "yalan!" çağrısı, yığın alan oyuncuya uçar; sana gelen kartlar yolda yüzünü çevirir.
- **Teksas Poker** (2-4 kişi): yan havuzlar, 7 karttan en iyi 5, Monte Carlo eşitlikli bot. İlk botlar sürekli all-in yapıyordu: puanlar havuz birimine sıkıştırıldı (gürültü şişmesin), yükseltme savaşı sınırlandı.
- **Kambur**: kuralları internette bulunamadı, uydurulmadı; kullanıcıdan kural bekliyor.
- Ortak değişiklikler: `bot.js` `mcPhase`; `table-kit.js` 1 kişilik düzen ve çoklu seçim (`selected` Set); `anim.js` `jitter` karma fonksiyonu (benzer kimlikli kartlar aynı yere düşüyordu); Ayarlar'a Blackjack/Blöf/Poker kişi sayısı.
- Animasyon kuralı eklendi: §11 (motor sonraki ele hemen geçiyorsa olay içinde `roundEnd`/`handEnd` görüntüsü verilir).
- Testler: 35. Tarayıcıda her oyun 390px genişlikte oynatıldı; uçuş anlarında görünen yer tutucu 0, konsol hatası yok.
- Bilinen sınırlar: Blackjack'te split/sigorta yok. Poker'de 6 kişilik masa ve çip animasyonu yok. Batak'ta yerel varyasyonlar (ör. kozun ilk elde açılmaması) uygulanmadı.

## v0.5.1 — Yeni oyunların animasyon incelemesi
Bulunan gerçek dışı durumlar ve düzeltmeler:
- **Poker:** Flop/turn/river ve dağıtım masanın ortasından (ortak kart sırasının içinden) çıkıyordu → masaya deste kondu, kartlar desteden gelir;
  pas geçenin ve el sonunda toplanan kartlar desteye gider. Showdown'da açılan kartlar hem kutuda hem sırada görünüyordu → kutu, kartlar kalkınca boşalır.
  El sonunda showdown'a kalmayan rakibin kapalı kartları kutusunda kalıp aniden kayboluyordu → desteye uçar. Pas verdiğin kartlar açık kalkıp yolda kapanır.
- **Blöf:** Elinden kapalı attığın kart kalkışta birden arka yüze dönüyordu → açık kalkar, yolda kapanır. "Yalan!" denince açılan kartların hepsi
  aynı noktadan çıkıyordu → her biri yığındaki kendi yerinden. Rakibin kart sayısı kart çıkınca/inince güncellenir (önce bütün yığın alınınca topluca değişiyordu).
- **Blackjack:** Deste sayısı kartlar daha yoldayken düşüyordu, el sonunda 52'ye sıçrıyordu → kartlar inince düşer.
- **Eski oyunlarda aynı sorun:** Eşek'te önüne koyduğun kart ve toplanan kartların, Papaz'da senden çekilen kartın kalkışta yüz değiştirmesi düzeltildi.
- Yeni yardımcılar: `ctx.fly(..., { conceal })`, `ctx.bumpCount(koltuk, ±1)`; kurallar §12, §13.
- Batak King ile aynı koreografiyi kullandığı için sorun çıkmadı. Bütün oyunlar tarayıcıda tekrar denetlendi: görünen yer tutucu 0, konsol hatası yok.

## v0.6 — Fanti, Konken, Yönerge
- **Fanti** (2/4 kişi) ve **Konken** (2-4 kişi) eklendi; kurallar docs/FANTI-KURALLARI.md, docs/KONKEN-KURALLARI.md. Fanti'de birden çok 11 seçeneği varsa oyuncu yerden kartları seçer.
- **Kişi sayısı sorusu:** Pişti, Fanti, Konken'de "Yeni oyun"a basınca kaç kişi sorulur (`spec.askPlayers`).
- **Yönerge (eğitici):** js/ui/tutor.js. Sıra sendeyken önerilen hamle ve nedeni, hamlenden sonra "İyi hamle" ya da "Daha iyisi şuydu". Öneri botların sezgisinden (`rateMove`); açıklamalar oyuna özel. Menüden açılıp kapanır.
- Hatalar: motor açılış olayını beklemiyordu (insan başlıyorsa dağıtım bitmeden sıra ona geçiyordu) → `await onEvent('start')`. Poker'de düğme paneli taşıyordu → tek ızgara.

## v0.7 — Yeni görünüm (D · Salon), süre halkası, sohbet
- Kullanıcının seçtiği tasarım (tasarım tuvali "Kart Salonu — yeni arayüz tasarımları", D): koyu ahşap zemin, bordo çerçeveli yeşil çuha,
  üstte/altta isim plakaları, yanlarda dikey sekmeler, büyük el kartları, krem pencereler, üst çubukta geri / sohbet / ☰ menü. Tema css/avrora.css sonundaki "TEMA D" bloğu.
- **Online hissi:** sırası gelenin avatarında azalan süre halkası (yeşil → turuncu → kırmızı). Botlar hızlarına göre 0,5-4 sn değişken düşünür, ara sıra uzun düşünür.
  Senin hamle süren 30/15 sn ya da yok (Ayarlar); bitince önerilen hamle oynanır. Pencere açıkken süre durur.
- **Sohbet:** js/ui/chat.js. Botlar oyun anlarına göre konuşur: övünme, laf sokma, tebrik, sitem, pişti/fanti/yalan yakalama/all-in/eşek/papaz gibi özel anlar.
  Tarz: atak laf sokar, temkinli tebrik eder. Hazır mesajlar ve yazma; botlar bazen cevap verir. Ayarlar'dan kapatılır.

## v0.7.1 — Ekran sığdırma ve sabit yerleşim (kullanıcı geri bildirimi, PC ekranı)
- Elin kartları ekrana sığmıyordu (hesap 62 px kartla yapılıyordu, kart 68 px) ve sayfa kayıyordu → hesap 68 px, masa ekranı kaymaz, masa alanı küçülebilir.
- Yönerge şeridi gelip gidince masa büyüyüp küçülüyordu → şerit yönerge açıkken sabit 52 px yer kaplar (boşken görünmez); el sırası sabit 120 px.
- Karar panelleri (ihale, çek/al, bahis) yerleşimi itmez, masanın altının üstünde açılır.
- Joker kartı "JOKER" yazısı ve yıldızla çizilir.
Kural (SERVIS-MANUELI): masadaki öğeler içerik değişince yükseklik değiştirmemeli; değişen içerik sabit kutuda ya da üstte katman olarak gösterilir.

## v0.8 — Duyarlı yerleşim ve büyük harfli kartlar
- **Dikey/yatay:** Dikeyde önceki düzen (tablet dikeyde 720 px). Yatayda (en/boy ≥ 5/4) masa ekranı ikiye bölünür: solda masa ve el (.lmain), sağda bilgi,
  sen, yönerge ve karar panelleri (.lside, 280 px; alçak ekranda 240 px). Alçak yatay ekranda (≤520 px yükseklik, yan çevrilmiş telefon) el kartları 50×72, avatarlar küçük.
  Bölme JS'te (table-kit `landscape()`), koşul `LANDSCAPE` ile CSS @media aynı. Ekran dönünce/boyut değişince yeniden çizilir (kart uçarken beklenir).
  El kartı ölçüsü CSS `--hand-w/--hand-h`, `handRow` aralığı bunu okur.
- **Büyük harfli kartlar** (kullanıcı örneği): sol üstte büyük tırnaklı sayı/harf, sağ üstte küçük renk, ortada büyük renk; resimsiz. Yazı boyları `cqw` ile kart genişliğine göre.
  Eski resimli kartlar Ayarlar > Kart görünümü: Klasik.

## v0.9 — Kart tasarımı v2 ve fotoğraf arkalık
- Kartlar js/ui/card-art.js ile çizilir: renk işaretleri ve amblemler SVG (her cihazda aynı, emojiye dönüşmez). Sol üstte büyük harf ve hemen altında küçük renk
  (üst üste binen elde ikisi birlikte okunur), ortada büyük renk. Papaz/kız/vale: krem zemin + amblem (sivri taç / incili taç / kalkan). Joker mor.
- Yazı tipleri gömülü (assets/fonts, css/fonts.css): Roboto Slab (kart, Apache 2.0) ve Nunito Sans (arayüz, SIL OFL); Google Fonts bağlantısı kaldırıldı, internetsiz çalışır.
- Dört renkli deste seçeneği (karo mavi, sinek yeşil). Oynanamayan kart soldurulmaz, zemini koyulaşır. İnce iç çerçeve ve sol kenar gölgesi.
- Kart arkası: bordo zemin, altın baklava deseni, krem çerçeve, ortada KS; ya da avatar fotoğrafı / yüklenen fotoğraf (Ayarlar > Kart arkası, 170×238 kırpılır).
- Klasik resimli kartlar Ayarlar > Kart görünümü > Klasik ile duruyor.
- v0.9.1: 10 kartının sayısı küçük görünüyordu → diğerleriyle aynı yükseklikte, yatayda %78 sıkıştırılarak yazılır (.fr.two).

## v1.0 — 66, Yanık, Kahvehane
- **66** (2 kişi): koz, evlilik 20/40, koz 9 değişimi, kapatma, 1/2/3 oyun puanı, 7'ye. Zor bot Monte Carlo (determinize'de açık koz kartının rakipte olabileceği hesaba katıldı).
- **Yanık** (2-4 kişi): açma (2 per / 4 çift, 100 sınırı), işleme, joker alma, işlenebilir kart atma cezası, çift 2 kat, yanma. Yerdeki perler masanın sağında küçük kartlarla.
- **Kahvehane** (js/ui/kahvehane.js): her oyuncunun yanında çay, Türk kahvesi, oralet, salep, ayran, soda ya da su; hamle yaptıkça azalır, bitince botlar ocakçıdan yenisini ister,
  ara sıra biri "Çaylar benden!" der. ☕ düğmesi: kendine söyle ya da herkese ısmarla. Sıcak içeceklerde süs buharı (CSS animasyonu; kart animasyonu değil, hareket azaltılmışsa kapalı).
  İçecek gelince yeniden çizim uçuş bitene kadar bekler (yer tutucu kuralı).
- Kalan oyunlar: 51, Hoşkin, Dost Kazığı, Pis 7'li, Kambur, Kaptıkaçtı, Solitaire, Golf, Spider, Freecell.

## v1.1 — Mola ve paralı Yanık
- Kullanıcı: "en önemlisi oyunu durdurabileyim" → tüm oyunlarda ⏸ Mola: botlar, sayaç ve animasyon sırası bekler; uygulama arka plana atılınca kendiliğinden durur.
- Kullanıcı: "Yanık paralı olsun, 10 ele bağlama, orijinaline sadık kalalım" → 10 el kaldırıldı; giriş 50, yanan ya çekilir ya 2 katını koyup girer, son kalan çanağı alır. Para oyundan oyuna taşınır.
- Yönerge ve botlar tekrar girme/çekilme kararını çanak payı ve bedelin paraya oranıyla tartıyor (ilk formül 950 parayla 100'lük girişte bile "çekil" diyordu, düzeltildi).
- Mola düğmesindeki ⏸ emojisi bazı sistemlerde kare görünüyordu → CSS ile iki çizgi.

## v1.2 — Yatay düzen, el düzenleme, Gin Rummy
- Kullanıcı (PC ekran görüntüsü): yönerge sağ üstte, kartlar altta; göz gidip geliyor. → Yatayda yan sütun kaldırıldı: masanın altında [sen · Düzenle | durum | yönerge] bandı, hemen altında el. Karar panelleri elin üstüne biner. Elin alt kenarı kesilmiyor.
- "Profil fotoları da büyüsün", "ui toparlansın", "yerdeki kartlar da büyümeli": avatarlar ve masa kartları ekran boyuna göre büyüdü (--tc-w/--tc-h; masa ofsetleri aynı oranda açılır). Yüksek PC ekranında el kartları 82×118.
- "Yerden kart çekme desteye ya da yerdeki karta tıklayınca olsun": Konken, Yanık, Gin'de çekme panel düğmesi yerine desteye / yerdeki karta dokunarak (sakin ince çerçeve, yanıp sönme yok).
- "Perli oyunlarda kartları taşıyabilmek ya da düzenle butonu": ikisi de. Kart sürüklenir (diğerleri kayarak yer açar), Düzenle per → renk → sayı dizer; sıra el boyunca korunur, yeni kart sona eklenir.
- "51'den önce Gin Rummy": eklendi (kapı, gin, alt kesme, işleme, 100 puan, oyun ve kutu bonusu). Bot: dağınık + rakibin topladığı kartlara göre tehlike; erken kapıya meyilli.

## v1.2.1
- Kullanıcı Gin ekranında "7 atmamı mı önerdi?" diye sordu: öneri doğruydu (6-7-8-9♥ serisi, ♦7 dağınık) ama el eski sırada 7-7-7 yan yana duruyordu. → El, oyuncu kart sürüklemedikçe her çizimde seçili dizilişe (per/renk/sayı) göre kendiliğinden yeniden dizilir; sürükleyince sıra donar.

## v1.3 — Yancı
- Kullanıcı: yönergeler bir yancıdan sohbet balonuyla gelsin, oyuncunun sağ altında otursun; resmi ayarlansın; oyuna dair sürekli konuşsun ya da yönerge versin; açma-kapama ve yönerge modu olsun; çay ısmarlama onu da kapsasın.
- Yönerge şeridi kalktı; yerine yancı (varsayılan "Hüsnü Abi" 👴): sağda avatar + adı + kendi çayı, solunda kuyruklu balon.
- Modlar: Yönerge (önceki öneri/yorum, "Bence …" diye), Sohbet (hamlene tepki, rakip hamleleri, puan değişimi, kahvehane muhabbeti; ders vermez), Kapalı. ☰ menüde "Yancı: …" tıklandıkça döner; Ayarlar > Yancı'da mod, ad, simge/fotoğraf.
- Kahvehane: yancının da çayı var, bitince ocakçıya seslenir; "Çaylar benden" deyince ona da gelir, teşekkür eder.
- Kullanıcı "siparişlerin bir faydası olsun mu sence?" diye sordu → seçenekler sunuldu, karar bekleniyor.

## v1.3.1
- Kullanıcı: "Benim sohbet seçeneklerimde hiç taunt yok" → 💬 panelinde "Sohbet / Laf sok" sekmeleri; 12 laf sokma cümlesi. Laf yiyen bot tarzına göre (atak/dengeli/temkinli) karşılık verir, bazen bir başkası güler. Aynı anda konuşan balonlar artık üst üste binmiyor.

## v1.3.2
- Kullanıcı (geniş ekran): bant kötü görünüyor; balon sağa dayalı gelsin, göz oraya bakıyor. → Yatay bantta durum kutusu zeminsiz ve büyük yazı; yancının balonu yazı kadar genişleyip sağdaki yancıya yaslanıyor (eskiden boşluğu dolduran geniş, soluk kutuydu). Yancının çayı avatarın sağında.

## v1.3.3
- Kullanıcı çay bardağı ve Türk kahvesi fincanı resimleri gönderdi, "çay bardağında rakı istiyorum" dedi. → İçecek çizimleri yenilendi (kendi SVG çizimimiz, resimlerden kopya değil): ince belli bardak, kaşık, kırmızı süslü porselen tabak; altın ağızlı, kırmızı kuşaklı, madalyonlu fincan, köpüklü kahve. Yeni içecek: Rakı (çay bardağında), beyaz ve kaşıksız. Sipariş edince masadakiler fark edip laf atar. İçecekler biraz büyüdü.

## v1.4 — Yazboz, deste yanında, mola menüsü
- Kullanıcı: "Deste ortaya atılan kartların solunda dursun", "ekranda bir yazboz olsun; puan/ceza sistemi karışık, kahvede yazıldığı gibi yazılsın", "pause yapınca ayarlara ve yazboza girebilelim".
- Konken, Gin: deste yerdeki kartların hemen solunda. Yanık: sol altta deste, yanında yandaki kart, perler sağda.
- Yazboz: masanın sol üst köşesinde çizgili kâğıt (isim + toplam); dokununca tam sayfa: her elin satırı (King'de oyun adı, Batak'ta ihale ✓/✗, Yanık'ta ceza + 🔥), çift çizgi altında TOPLAM. Oyuncu kutularında yalnız toplam kaldı. Blackjack, Poker, Blöf, Papaz Kaçtı, Eşek'te yazboz yok (fiş/tek el).
- Mola penceresi: Devam et / Yazboz / Ayarlar. ☰ menüde de Yazboz ve Ayarlar. Ayarlar oyunun üstünde katman olarak açılır, oyun kapanmaz; açıkken süre sayacı durur.
- Kullanıcı içecekler için "vektör değil png daha iyi olmaz mı" diye sordu → cevaplandı, karar bekleniyor.

## v1.5 — Dostlar Kahvehanesi, sesler, sade yancı, doğal dil
- Kullanıcı: yancı balonu hâlâ karışık, sadece sohbet balonu olsun → balonda tek söz: sıra sendeyse "Bence Sinek 2 at. …", değilse son hamlenin kısa yorumu ("Aferin…" / "Daha iyisi vardı: …"). ✓/✗ ve kalın yazı yok.
- "Kart önerilerini adıyla yazsın, Sinek 2 at gibi" → yönerge kart adlarını yazıyla söyler (Maça As, Kupa Kız…).
- "Yığın gibi ifadeler doğallığı bozuyor, günlük hayattaki gibi konuşulsun" → yönerge açıklamaları ve masa notları kahvehane ağzıyla yeniden yazıldı ("yerdekileri aldı", "ortada 12 kart", "pişti yaptı!"). Fanti'de as ile 11 yapınca "yerdeki ası kaparsın" diyen hata ve Blackjack'teki yanlış "asla" kelimesi düzeltildi.
- Ses efektleri (Web Audio ile üretilir, dosya yok): kâğıt kayması (her kart uçuşunda: dağıtma, çekme, atma, toplama), sıra sende çanı + bot sırasında hafif tok, süre azalıyor tiki (son 5 sn, son 3'te tizleşir), mesaj sesi (bot, sen, yancı). Ayarlar'da "Ses efektleri" kutusu.
- Ana menü tepesine amblem (yelpaze kâğıt + ince belli çay bardağı) ve "Dostlar Kahvehanesi" yazısı, altta "dev. Hazer Erdoğan". Sekme adı ve simgesi de değişti.

## v1.5.1
- Kullanıcı: her mesaj "Bence" ile başlamasın, atılacak/alınacak kart adı renkli yazsın. → Öneri girişleri dönüşümlü (düz emir, Bence, Bana kalırsa, Şöyle yap, Hadi, Bak; arka arkaya aynısı gelmez). Balondaki kart adları simgeli ve renkli (Kupa/Karo kırmızı, Maça/Sinek lacivert, Joker mor). "Yerden al (Karo As)" → "Yerden Karo As al".

## v1.6 — GitHub Pages ve kurulabilir uygulama
- Kullanıcı: eski Android'leri unut; Windows ve güncel Android yeterli. Google Sites'tan vazgeçti, "GitHub yapalım". GitHub kullanıcısı: erdoganhazer. Godot'ya geçiş ileride gerekirse.
- Eklendi: manifest (ad, simgeler, tam ekran), servis işçisi (122 dosyayı cihaza indirir, internetsiz açılır; yeni sürüm bir sonraki açılışta devreye girer, oyun ortasında yenilenmez), amblemden üretilmiş simgeler (192, 512, maskable, Apple), ana menüde "📲 Uygulama olarak yükle" düğmesi (tarayıcı izin verince), GitHub Actions yayın akışı (test → sw.js → Pages).
- Denendi: yerelde servis işçisi devreye giriyor, internet kesikken menü ve Gin açılıyor.
- 06.11.2026: Depo erdoganhazer/dostlar-kahvehanesi oluşturuldu (kullanıcı), ilk gönderim yapıldı, Pages kaynağı GitHub Actions (kullanıcı açtı). Yayın: https://erdoganhazer.github.io/dostlar-kahvehanesi/
- Bundan sonra güncellemeler bu depoya gönderilir; claude.ai önizlemesi ikincil.

## v1.7 — Kullanıcı istek listesi (06.11 akşam), 1. aşama
- Konken: başkası kart atınca sürükleme kesiliyordu → sürükleme durumu çizimden bağımsız (pencere dinleyicileri, her çizimde kart yeniden yakalanır).
- Çay/kahve buharı her kartta baştan başlıyordu → içecek öğeleri kalıcı, buhar Web Animations ile.
- Deste arkasındaki "KS" yazısı kaldırıldı.
- Yancı: adı Şerif; ayarı yalnız altındaki 🔇/🔊 (sessiz ya da sohbet). Resmine dokununca o anın ipucu (sıra sendeyse ne yapacağın, değilse gidişat). Yönerge modu kaldırıldı.
- İçecek ısmarlama: bir oyuncunun içeceğine dokun → yalnız ona; kendi içeceğine dokun → kendine ya da herkese.
- İçecek çizimleri düzenlenebilir dosyalar: assets/drinks/<tür>.svg (id="sivi" içecek; seviye oyunda ayarlanır). Sıfırlamak: node tools/export-drinks.mjs.
- Emoji avatarlar kaldırıldı; 8 çizim yüz (a1–a8). Hazır oyuncu en fazla 3 (masada 4 kişi). Varsayılan oyuncu adı "Oyuncu".
- Kaybeden botlar sinirlenir (ayar): üst üste kayıpta söylenir, kutusu kızarır, çok sinirliyse yüzü kızarır.
- Menü grupları: Kahvehane / Kumarhane / Tek kişilik, her grup alfabetik. Yeni "yakında" kutuları: Kılıç, At Yarışı, Bakara, Türk Pokeri, Kart Barbutu, Üç Kart Poker, Casino Savaşı.
- Kurulunca ad her yerde "Dostlar Kahvehanesi".
- Bekleyen kararlar: 3 botun adları (fotoğraflar telif nedeniyle depoya konmayacak; kullanıcı kendi cihazında yükleyecek), Kılıç / Türk Pokeri / Kart Barbutu kuralları.

## v1.8 — Tek kişilik oyunlar (istek listesi, 2. aşama)
- Solitaire (Klondike, 1 ya da 3 kart açma), Golf, FreeCell, Spider (1/2/4 renk) oynanır oldu. Menüde "Tek kişilik" grubunda.
- Ortak masa `sol-table.js`: kart boyu ekrana göre (390 px'te Spider'da 10 sütun sığar), üst üste binen kartta sayı ve renk yan yana okunur. Kartlar her hamlede eski yerinden yenisine kayar, desteden açılan kart yolda döner, altındaki kapalı kart yerinde çevrilir. Açılışta kartlar desteden dağılır.
- Dokunma: temele gidebilen kart dokununca gider; tek yeri olan oraya gider; birden çok yeri varsa seçilir, gidebileceği yerler hafifçe çerçevelenir.
- Geri al düğmesi, hamle kalmayınca "Bitir". Klondike'de her şey açılınca "Topla"; FreeCell'de sütunlar sıralanınca "Topla".
- Yancı Şerif burada da: resmine dokununca "Kupa As'ı temele çıkar" gibi ipucu (kart adları ekleriyle). Tek kişilikte her hamleyi yorumlamaz, süre ve sıra sesi yok.
- İpucu kalitesi: ipucuyla oynanınca Klondike ~%27, FreeCell ~%55, Spider (tek renk) ~%40 kazanılıyor; gidip gelme önerisi engellendi.
- Testler: 44/44 (4 yeni: kart korunumu, geri al, kurallar, kazanma).
