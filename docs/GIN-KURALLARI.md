# Gin Rummy kuralları (Kart Salonu sürümü)

Kaynaklar: Wikipedia "Gin rummy", pagat.com "Gin Rummy", rummyrulebook.com. Puan değerleri kaynaklarda 10-25 arasında değişiyor; burada yaygın modern değerler seçildi (gin 25, alt kesme 25, kutu 25).

- 52 kart, 2 kişi. Herkese 10 kart; bir kart yere açık konur.
- İlk tur: önce dağıtmayan, sonra dağıtan açık kartı alabilir (alıp bir kart atar) ya da pas der. İkisi de pas derse dağıtmayan desteden çeker.
- Sonra sırayla: desteden ya da yerdeki son karttan çek, bir kart at. Yerden alınan kart aynı tur atılamaz.
- Per: aynı sayıdan 3-4 kart. Seri: aynı renkten ardışık 3+ kart. As yalnız 1 (A-2-3 olur, Q-K-A olmaz).
- Dağınık ceza: as 1, 2-10 kendi değeri, resimler 10.
- Kapı (knock): atarken dağınık ≤ 10 ise. Eller açılır; rakip kendi perlerini dizer ve dağınıklarını kapı diyenin perlerine işler.
  - Rakibin cezası fazlaysa kapı diyen farkı alır.
  - Rakibin cezası eşit ya da azsa alt kesme: rakip farkı + 25 alır.
- Gin: dağınık 0. Rakip işleyemez; gin yapan rakibin cezası + 25 alır.
- Destede 2 kart kalınca kimse kapı demediyse el berabere, aynı kişi dağıtır. Eli kazanan bir sonrakini dağıtır.
- 100 puana ilk ulaşan oyunu kazanır: +100 oyun bonusu (rakip hiç el almadıysa 200). İki taraf da aldığı her el için +25 kutu bonusu alır.
- Arayüz: desteye / yerdeki karta dokunarak çekilir. Kart seçilince kapı mümkünse "Kapı de / Sadece at" çıkar.
  El sürüklenerek ya da "Düzenle" (per / renk / sayı) ile dizilir.

Dosyalar: `js/games/gin.js` (per bulucu `solve`, işleme `layOff`/`defend`), `js/ui/gin-table.js`.
