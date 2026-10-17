// RAG evaluation set: realistic Turkish small-business texts and questions.
//
// Each query names the document it belongs to and `expect`: a substring that
// must appear in the retrieved chunk for the answer to be there. `generic`
// queries (hours, address, payment...) are legitimately answerable by several
// businesses, so they're not used as cross-business negatives.

export interface EvalDoc {
  id: string
  text: string
}

export interface EvalQuery {
  doc: string
  q: string
  expect: string
  generic?: boolean
}

export const DOCS: EvalDoc[] = [
  {
    // v0.1's failing case: one unformatted paragraph, many topics.
    id: 'kafe-kisa',
    text:
      'Kahve Durağı kafemiz Kadıköy Moda Caddesi 12 numarada. Hafta içi 08:00-22:00, hafta sonu 09:00-23:00 açığız. Pazartesi günleri kapalıyız. Filtre kahve 85 TL, latte 110 TL, San Sebastian cheesecake 160 TL. Glutensiz brownie de bulunur. Evcil hayvan dostuyuz, bahçemizde köpeğinizle oturabilirsiniz. Rezervasyon için 0216 555 12 34 numarasını arayın.',
  },
  {
    id: 'kafe-menu',
    text: `KAHVE DURAĞI MENÜ

SICAK İÇECEKLER
Türk kahvesi 70 TL
Filtre kahve 85 TL
Americano 95 TL
Latte 110 TL
Cappuccino 110 TL
Flat white 120 TL
Sıcak çikolata 115 TL
Bitki çayları (papatya, ıhlamur, adaçayı) 75 TL

SOĞUK İÇECEKLER
Iced latte 120 TL
Cold brew 125 TL
Ev yapımı limonata 90 TL
Taze portakal suyu 100 TL

TATLILAR
San Sebastian cheesecake 160 TL
Tiramisu 150 TL
Havuç kek 110 TL
Günün kurabiyesi 60 TL

GLUTENSİZ VE VEGAN SEÇENEKLER
Glutensiz brownie 120 TL
Vegan muzlu kek 115 TL
Tüm kahvelerimiz yulaf, badem veya soya sütü ile hazırlanabilir, bitkisel süt farkı 15 TL'dir.

KAHVALTI
Serpme kahvaltı (2 kişilik) 850 TL. Hafta sonu 09:00-14:00 arası servis edilir.
Avokadolu tost 210 TL
Menemen 180 TL

Bilgiler:
Kartla ve nakit ödeme alıyoruz, yemek kartlarından Multinet ve Sodexo geçerlidir.
Misafirlerimiz için ücretsiz Wi-Fi vardır, şifreyi kasadan isteyebilirsiniz.
Bahçemiz evcil hayvan dostudur; köpekler için su kabı bulunur.
Doğum günü ve özel günler için 10 kişiye kadar rezervasyon alıyoruz.`,
  },
  {
    id: 'kuafor',
    text: `Makas Kuaför Fiyat Listesi

## Kadın
- Saç kesimi: 450 TL
- Fön: 250 TL
- Dip boya: 900 TL
- Komple boya (orta boy saç): 1.400 TL
- Balyaj / ombre: 2.500 TL'den başlayan fiyatlarla, saç uzunluğuna göre değişir
- Keratin bakım: 2.000 TL

## Erkek
- Saç kesimi: 300 TL
- Sakal tıraşı: 150 TL
- Saç + sakal: 400 TL
- Çocuk saç kesimi (12 yaş altı): 200 TL

## Gelin ve Özel Gün
Gelin başı ve makyaj paketi 6.000 TL'dir. Prova dahildir; prova düğünden en az bir hafta önce yapılır. Nişan ve mezuniyet için topuz 1.200 TL.

## Randevu ve İptal
Randevularınızı 0212 444 00 11 numarasından veya WhatsApp üzerinden alabilirsiniz. Randevu saatinden en az 3 saat önce haber vermeden gelinmeyen randevular için bir sonraki randevuda 200 TL ücret alınır. 15 dakikadan fazla gecikmelerde randevunuz kaydırılabilir.

## Çalışma Saatleri
Salı-Pazar 10:00-20:00 arası açığız. Pazartesi günleri kapalıyız.

## Ödeme
Nakit ve kredi kartı geçerlidir; kredi kartına 3 taksit imkânı vardır.`,
  },
  {
    id: 'iade',
    text: `İADE VE DEĞİŞİM POLİTİKASI

1. İade Süresi
Satın aldığınız ürünü, teslim tarihinden itibaren 14 gün içinde iade edebilirsiniz. Kampanyalı ürünlerde de bu süre geçerlidir.

2. İade Koşulları
Ürünün kullanılmamış, etiketi koparılmamış ve orijinal ambalajında olması gerekir. Faturanın aslı ürünle birlikte gönderilmelidir.

3. İade Edilemeyen Ürünler
Hijyen nedeniyle iç giyim, mayo, küpe ve kozmetik ürünleri ambalajı açıldıysa iade alınmaz. Kişiye özel üretilen ürünler de iade edilemez.

4. Kargo Ücreti
Anlaşmalı kargo firmamız Yurtiçi Kargo ile gönderilen iadelerde kargo ücretsizdir. Farklı firma ile gönderilen iadelerde kargo ücreti müşteriye aittir.

5. Para İadesi
İade edilen ürün depomuza ulaştıktan sonra 3 iş günü içinde kontrol edilir. Onaylanan iadelerde ödeme kredi kartınıza 7 iş günü içinde yansır; bankanıza bağlı olarak bu süre uzayabilir.

6. Değişim
Beden veya renk değişimi için ürünü iade edip yeni sipariş oluşturmanızı öneririz. Mağazalarımızdan da faturayla değişim yapabilirsiniz.

7. Hasarlı veya Yanlış Ürün
Ürün hasarlı ya da yanlış geldiyse teslimattan itibaren 48 saat içinde fotoğrafla birlikte destek@ornekmagaza.com adresine yazın; kargo ücreti bizden.`,
  },
]

export const QUERIES: EvalQuery[] = [
  // kafe-kisa (single paragraph)
  { doc: 'kafe-kisa', q: 'Glutensiz tatlınız var mı?', expect: 'Glutensiz' },
  { doc: 'kafe-kisa', q: 'Köpeğimi getirebilir miyim?', expect: 'köpeğinizle' },
  { doc: 'kafe-kisa', q: 'Pazartesi açık mısınız?', expect: 'Pazartesi', generic: true },
  { doc: 'kafe-kisa', q: 'Cheesecake kaç lira?', expect: 'cheesecake' },
  { doc: 'kafe-kisa', q: 'Kafeniz nerede?', expect: 'Moda Caddesi', generic: true },
  { doc: 'kafe-kisa', q: 'Rezervasyon nasıl yapabilirim?', expect: '0216 555', generic: true },

  // kafe-menu
  { doc: 'kafe-menu', q: 'Glutensiz tatlınız var mı?', expect: 'Glutensiz brownie' },
  { doc: 'kafe-menu', q: 'Vegan seçenekleriniz neler?', expect: 'Vegan' },
  { doc: 'kafe-menu', q: 'Latte ne kadar?', expect: 'Latte 110' },
  { doc: 'kafe-menu', q: 'Soğuk kahve var mı?', expect: 'Cold brew' },
  { doc: 'kafe-menu', q: 'Badem sütüyle yapabilir misiniz?', expect: 'badem' },
  { doc: 'kafe-menu', q: 'Kahvaltı saat kaçta bitiyor?', expect: '09:00-14:00' },
  { doc: 'kafe-menu', q: 'Wifi şifresi nedir?', expect: 'Wi-Fi' },
  { doc: 'kafe-menu', q: 'Yemek kartı geçiyor mu?', expect: 'Multinet', generic: true },
  { doc: 'kafe-menu', q: 'Köpeğimle gelebilir miyim?', expect: 'evcil hayvan' },
  { doc: 'kafe-menu', q: 'Doğum günü için yer ayırtabilir miyim?', expect: 'Doğum günü', generic: true },
  { doc: 'kafe-menu', q: 'Tatlı olarak ne var?', expect: 'Tiramisu' },
  { doc: 'kafe-menu', q: 'Türk kahvesi fiyatı?', expect: 'Türk kahvesi 70' },

  // kuafor
  { doc: 'kuafor', q: 'Erkek saç kesimi kaç para?', expect: 'Saç kesimi: 300' },
  { doc: 'kuafor', q: 'Sakal tıraşı ne kadar?', expect: 'Sakal tıraşı' },
  { doc: 'kuafor', q: 'Balyaj fiyatınız nedir?', expect: 'Balyaj' },
  { doc: 'kuafor', q: 'Gelin paketi var mı?', expect: 'Gelin başı' },
  { doc: 'kuafor', q: 'Randevuyu iptal edersem ücret alınır mı?', expect: '3 saat önce' },
  { doc: 'kuafor', q: 'Geç kalırsam ne olur?', expect: '15 dakikadan' },
  { doc: 'kuafor', q: 'Pazartesi açık mısınız?', expect: 'Pazartesi günleri kapalıyız', generic: true },
  { doc: 'kuafor', q: 'Taksit yapıyor musunuz?', expect: 'taksit', generic: true },
  { doc: 'kuafor', q: 'Çocuk saç kesimi ne kadar?', expect: 'Çocuk' },
  { doc: 'kuafor', q: 'Keratin bakımı yapıyor musunuz?', expect: 'Keratin' },

  // iade
  { doc: 'iade', q: 'Ürünü kaç gün içinde iade edebilirim?', expect: '14 gün' },
  { doc: 'iade', q: 'İade kargo ücretini kim ödüyor?', expect: 'Yurtiçi Kargo' },
  { doc: 'iade', q: 'Paramı ne zaman geri alırım?', expect: '7 iş günü' },
  { doc: 'iade', q: 'Mayo iade edilebilir mi?', expect: 'mayo' },
  { doc: 'iade', q: 'Etiketi kopardım, yine de iade olur mu?', expect: 'etiketi' },
  { doc: 'iade', q: 'Beden değişimi nasıl yapılır?', expect: 'Beden' },
  { doc: 'iade', q: 'Ürün kırık geldi ne yapmalıyım?', expect: 'hasarlı' },
  { doc: 'iade', q: 'İndirimli ürünler iade edilebilir mi?', expect: 'Kampanyalı' },
]

// Off-topic for every document.
export const OFF_TOPIC: string[] = [
  "Türkiye'nin başkenti neresi?",
  'Bugün hava nasıl olacak?',
  'Bana bir fıkra anlatır mısın?',
  'Otopark var mı?',
  'İş başvurusu yapmak istiyorum',
  'Bitcoin almalı mıyım?',
  'Sınav sonuçları ne zaman açıklanır?',
  'Araba kiralamak istiyorum',
]
