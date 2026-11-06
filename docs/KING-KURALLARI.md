# King (Rıfkı) — araştırılan kurallar

Birkaç Türkçe kaynaktan derlendi (Milliyet, Posta, CHIP forum, cikcik.com, oyunkutuphanesi.com,
yapayguc.com, rekabet.app, uludagsozluk, okavak/king-skor). Ana hatlar tutarlı; ayrıntılarda bölge farkı var.
Farklı çıkan yerler "Seçenek" olarak işaretli, Ayarlar'a konacak.

## Temel
- 4 oyuncu, 52'lik deste (jokersiz), herkese 13 kart. Dağıtım ve oyun yönü saat yönünün tersi.
- Sıralama: 2 en küçük … 10, Vale, Kız, Papaz, As en büyük.
- 20 el oynanır. Her oyuncu **3 ceza + 2 koz** söyler (toplam 12 ceza, 8 koz).
- Her ceza türü bütün oyuncular tarafından **en fazla 2 kez** söylenebilir (6 tür × 2 = 12).
- İlk elde elinde **karo 2** olan oyuncu oyunu söyler; sonraki ellerde söyleyen sıra döner.
  (Not: bazı kaynaklar ilk dört eli herkes için "ceza zorunlu" yapıyor — Seçenek.)
- Her el: söyleyen ilk kartı atar. Seri varsa verilir; yoksa herhangi bir kart (koz oyununda koz).
  En büyük kart eli alır, eli alan sonraki eli açar.

## Puanlar (standart)
| Oyun | Birim | Puan |
| --- | --- | --- |
| Koz | alınan her el (13) | **+50** |
| El almaz | alınan her el (13) | −50 |
| Kupa almaz | alınan her kupa (13) | −30 |
| Kız almaz | alınan her kız (4) | −100 |
| Erkek almaz | alınan her vale ve papaz (8) | −60 |
| Rıfkı | kupa papazı | −320 |
| Son iki | son iki elin her biri | −180 |

20 elde toplam ceza = toplam koz = 5200. Oyun sonunda toplamı **0 ve üstü** olanlar kazanır, altı kaybeder.

## Ceza oyunlarının özel kuralları
- **Kupa almaz ve Rıfkı:** Kupa çıkana kadar kimse bir ele kupa ile başlayamaz.
  Elinde yerdeki seriden kart olmayan oyuncu kupa atmak zorundadır.
- **Rıfkı:** Elinde yerdeki seriden olmayan oyuncunun kupa papazını atması zorunludur.
  Kupa papazı alınınca el (ve Rıfkı oyunu) biter.
- **Son iki:** İlk 11 elin kimin olduğu önemsiz; ceza son iki elde.
- **Kız almaz:** Dört oyuncunun her biri bir kız alırsa oyun yeniden oynanır.
- **Koz:** Elinde yerdeki seriden olmayan koz atıp eli alabilir.

## King (oyunu tek başına bitirmek)
Bir oyuncu bir turda bütün elleri alırsa "King yapmış" sayılır, tek başına çıkar, diğerleri batar.
Seçenek: bazı yerlerde eşik koz elinde 10 el (okavak/king-skor varsayılanı).

## Seçenekler (kaynaklar ayrışıyor — Ayarlar'da açılıp kapanacak)
1. **Koz oyununda üstüne çıkma zorunluluğu:** Bir kaynak "çıkma zorunlu değil" diyor (yapayguc),
   başka kaynak "9 gerekir" diyor (merakhanevi). Varsayılan: zorunlu değil.
2. **Kötü el yeniden dağıtımı:** Ceza hakkını kullanmış oyuncunun elinde 10'dan büyük kart yoksa
   yeniden dağıtım (Posta). Varsayılan: kapalı.
3. **12 el modu:** 1 koz + 2 ceza hakkı, en yüksek puan kazanır (cikcik.com). Varsayılan: kapalı.
4. **King eşiği:** tüm eller / koz elinde 10 el. Varsayılan: tüm eller (13).
5. **Çift cezalı King, konturlu King:** bölgesel versiyonlar; sonraya.
6. **Rıfkı öncesi bozma:** Elinde tek rıfkı ya da tek kupa ası olan oyuncunun oyunu bozabilmesi
   (Konturlu King versiyonunda geçiyor). Varsayılan: kapalı.

## Henüz doğrulanmadı (oyunu yazmadan önce tek tek kontrol edilecek)
- Kız almaz / erkek almazda "kartı atma zorunluluğu" tam kuralı (yerde büyük kart varsa serbest mi).
- Koz seçilince kozun oyuncuda olmadığı durumda ceza oyunlarında kozun olmaması (ceza oyunlarında koz yok: doğrulandı).
- Aynı ele iki ceza söyleme (çift cezalı) tamamen ayrı versiyon olarak ele alınacak.

## Botlar için notlar (js/core/game-api.js sözleşmesine göre)
- `scores()` = toplam puan (ceza eksi). Büyük = iyi, sözleşmeyle uyumlu.
- Gizli bilgi: rakip elleri. `determinize()` görünmeyen kartları dağıtır (Zor seviye bununla çalışır).
- `rateMove()`: ceza oyunlarında "ceza yemeyecek en yüksek kart", koz oyunlarında "eli alacak en küçük kart" gibi sezgiler.
