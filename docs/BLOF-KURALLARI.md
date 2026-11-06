# Blöf ("Yalan / Cheat") kuralları (Kart Salonu sürümü)

Bu isimle yaygın bilinen "Bluff / Cheat / BS" oyunu uygulandı. Registry'deki "Blöf" için kullanıcıdan farklı bir kural gelirse güncellenir.

- 3-4 oyuncu, 52 kartın hepsi eşit dağıtılır (3 kişide ilk iki koltuk 18 kart alır).
- Sırayla, söylenmesi gereken sayıyı söyleyerek 1-4 kartı yüzü kapalı yığına atarsın. Sayılar sırayla: As, 2, 3 ... 10, Vale, Kız, Papaz, tekrar As. Gerçekte o sayıyı atmak zorunda değilsin (blöf).
- Her atıştan sonra diğer oyuncular atanın solundan başlayarak sırayla "Yalan!" diyebilir ya da inanabilir.
- Yalan denirse son atılan kartlar açılır: hepsi söylenen sayıysa diyen, değilse atan bütün yığını alır. Sıra, atanın solundakine geçer.
- Elindeki kartları ilk bitiren, son atışına kimse yalan demezse (ya da dedikleri boşa çıkarsa) kazanır.
- 260 atıştan sonra oyun biterse en az kartı olan kazanır (sonsuz oyunu önlemek için).
- Aynı sayılı kartlar bot için denktir; hamle listesi sayı çoklu kümelerine göre üretilir (`moveKey`).

Dosyalar: `js/games/blof.js`, `js/ui/blof-table.js`.
