# Nexus Chess — Faz 1a Teknik Mimari Planı

> Durum: taslak v1 · Kapsam: Faz 1a (tek oyunculu çekirdek) + Faz 1b veri modeli · Dil: Türkçe öncelikli, çok dilli

## 1. Özet

Nexus Chess, Chess.com ve Lichess ile **tek oyunculu deneyim** üzerinden rekabet eden, Türkçe öncelikli bir web satranç oyunudur. Faz 1a'nın hedefi: kişilikli botlara karşı oynanan, Duolingo tarzı bir seviye haritasıyla ilerlenen, oyun sonunda Türkçe koç yorumu veren ve oyuncunun kendi hatalarından "intikam bulmacaları" üreten bir çekirdek.

Bu PR ile gelen **ilk dilim**: tarayıcıda bir bota karşı baştan sona oyun (Stockfish Web Worker içinde), seviye haritası, konuşma balonları, oyun sonu koç raporu, 7 dilde arayüz, lint + typecheck + birim testleri + CI.

## 2. Teknoloji seçimleri

| Alan | Seçim | Gerekçe |
| --- | --- | --- |
| Uygulama | Vite + React + TypeScript (SPA) | SSR yok; aynı paket ileride Capacitor ile iOS/Android'e sarılabilir. |
| Kurallar | chess.js (BSD-2) | Hamle geçerliliği, mat/pat/beraberlik için tek "kural kaynağı". |
| Tahta | react-chessboard v5 (MIT) | Sürükle-bırak + dokunmatik, ok/kare vurgusu. Alternatif: cm-chessboard (MIT). **chessground (GPL) kullanılmaz.** |
| Motor | Stockfish 19 WASM, "lite single-threaded" (~1,8 MB) | Web Worker'da ayrı program olarak çalışır; COOP/COEP başlığı gerektirmez. |
| Çoklu dil | i18next + react-i18next + i18next-resources-to-backend | Dil başına tembel yükleme, çoğul kuralları, bağlam (context) desteği. |
| Analitik | PostHog (EU), yalnızca anahtar varsa ve tembel yüklenir | D1/D7/D30 elde tutma; otomatik yakalama ve oturum kaydı kapalı. |
| Arka uç | **Öneri: Supabase** (Postgres + Auth + RLS + Edge Functions) | 1a'da arka uç yok (misafir oyun, localStorage); arayüzler hazır. |
| Test | Vitest + Testing Library + jsdom | Hızlı, Vite ile aynı yapılandırma. |
| Lint | oxlint | Vite şablonunun varsayılanı, çok hızlı. |

### Supabase mı Hono mu?

- **Supabase (önerilen):** Auth, RLS ile satır bazlı yetki, Postgres, depolama (bulmaca dosyaları) ve Edge Functions tek pakette. Faz 1b'deki sınıf/öğrenci kodları için RLS + bir Edge Function yeterli. Az kodla başlarız.
- **Hono:** Tam kontrol, herhangi bir sunucuda (Cloudflare Workers, Node) çalışır; ama Auth, veritabanı ve yetkilendirmeyi kendimiz kurmamız gerekir.
- Karar ne olursa olsun istemci yalnızca `ProgressRepository` gibi **arayüzlerle** konuşur; arka uç değişirse yalnızca adaptör değişir.

## 3. Katmanlar

```
┌──────────────────────────── src/ui (React) ────────────────────────────┐
│ App · LevelMap · GameScreen · SpeechBubble · PromotionPicker · Switcher │
└───────────────▲───────────────────────────────────────▲────────────────┘
                │ durum aboneliği / jestler              │ t(), useLocalizedSan
┌───────────────┴──────────── src/core (saf TS) ─────────┴────────────────┐
│ game: GameSession, BotGameController   bots: kişilik, hamle seçimi, kitap│
│ engine: EnginePort, UCI ayrıştırıcı    progression: harita, ilerleme     │
│ coach: Feature Extractor, rapor        revenge: aday seçimi, SRS         │
│ puzzles: Lichess içe aktarma           classroom (1b), analytics port    │
└───────────────▲───────────────────────────────────────▲────────────────┘
                │ portlar (arayüzler)                    │
┌───────────────┴──────── src/platform (adaptörler) ────┴────────────────┐
│ StockfishEngine (Web Worker, UCI) · LocalProgressRepository · PostHog   │
└─────────────────────────────────────────────────────────────────────────┘
       src/i18n: dil kaydı, algılama, tembel yüklenen locale dosyaları
```

Kurallar (`.cursor/rules/architecture.mdc`, testle zorlanır: `src/core/boundaries.test.ts`):

- `src/core` React, DOM, `window`, `localStorage`, `Worker`, i18n veya UI'ı **import edemez**. `Math.random()` yasak; rastgelelik `Rng` olarak enjekte edilir.
- UI yalnızca durumu çizer ve jestleri `BotGameController`'a iletir; satranç mantığı bileşenlere girmez.
- SSR'a bağımlılık yok; modül üst seviyesinde tarayıcı global'lerine erişim yok.

## 4. Klasör yapısı

```
src/
  core/
    game/         GameSession, BotGameController, tipler
    engine/       EnginePort, UCI ayrıştırma, skor dönüşümü
    bots/         kişilik tipi, kadro (roster), hamle seçimi, açılış kitabı, tepkiler
    progression/  seviye haritası (Dünya 1), ilerleme reducer'ı
    coach/        Feature Extractor, koç raporu (dil bağımsız anahtarlar)
    revenge/      "tek net kazandıran hamle" seçimi, Leitner SRS
    puzzles/      Lichess CSV satırı ayrıştırma, çözüm kontrolü
    notation/     yerelleştirilmiş SAN (taş harfleri)
    classroom/    Faz 1b veri modeli (yalnızca tipler + kod üretici)
    analytics/    AnalyticsPort ve olay tipleri
  platform/       stockfishEngine, progressStore (localStorage), analytics (PostHog)
  i18n/           locales.ts (kayıt), i18n.ts (başlatma/algılama), locales/<dil>/{common,bots,coach}.json
  ui/             App, components/, screens/, hooks/
scripts/copy-engine.mjs   Stockfish dosyalarını public/engine/'a kopyalar (postinstall)
supabase/migrations/      önerilen şema (henüz uygulanmadı)
```

## 5. Modüller

### 5.1 Oyun oturumu ve kontrolcü

- `GameSession` chess.js'i sarar: tahta jestini hamleye çevirir (`tryDrop`), terfide **otomatik vezir yapmaz** (`needs-promotion` döner), motorun UCI hamlelerini uygular (`e1g1` rok, `a2a1q` terfi), terk etmeyi yönetir.
- `BotGameController` bir oyunu yönetir: oyuncu hamlesi → tepki → bot hamlesi (önce açılış kitabı, sonra motor) → oyun sonu → koç raporu. React'ten bağımsızdır; UI `useSyncExternalStore` ile abone olur.
- Tıkla-tıkla hamle de desteklenir (akıllı tahtalar ve dokunmatik ekranlar için).

### 5.2 Motor (Stockfish)

- `public/engine/stockfish-19-lite-single.{js,wasm}` statik dosya olarak sunulur, `new Worker(url)` ile yüklenir, yalnızca UCI metin mesajlarıyla konuşulur. Uygulama paketine **import edilmez** (GPL sınırı).
- `analyse(fen, { multiPv, depth })` → sıralı aday listesi (`CandidateLine[]`). Aramalar kuyruklanır.
- İleride: analiz/intikam bulmacası üretimi için ayrı bir worker; güçlü cihazlarda tam NNUE (~94 MB, COOP/COEP gerekir) isteğe bağlı.

### 5.3 Kişilikli botlar

Her bot (`BotPersonality`):

- `search`: derinlik ve **MultiPV** sayısı (ör. 6 aday).
- `maxLossCp`: en iyi hamleye göre en fazla kaç santipiyon kaybettiren hamleleri kabul eder; `blunderChance` + `blunderLossCp`: ara sıra bilinçli "insan gibi" hata.
- `temperatureCp`: softmax sıcaklığı (yüksek = daha rastgele).
- `style`: `aggression` (şah/alma bonusu), `materialism` (alınan taş değeri bonusu).
- `book`: bota özel açılış kitabı (UCI geçmişi → ağırlıklı hamleler). Kitap hamlesi geçersizse atlanır; test tüm kitap girişlerinin geçerli olduğunu doğrular.

Seçim: adaylar tolerans dışındaysa elenir → stil bonusu eklenir → softmax ile örneklenir. Stockfish'in `Skill Level` / `UCI_Elo` ayarları bilinçli olarak kullanılmaz; kişilik bizim kodumuzda, test edilebilir.

Başlangıç kadrosu: **Minik Mert** (~400), **Atlı Ayşe** (~800), **Sultan Kale** (Dünya 1 bossu, ~1200). Elo değerleri gösterim amaçlıdır; oyuncu verisiyle kalibre edilecek.

### 5.4 Seviye haritası ve bosslar

- Dikey, zikzak yol (Duolingo tarzı). Düğüm türleri: `bot`, `puzzles`, `boss`. Her düğüm `requires` listesindeki düğümler tamamlanınca açılır.
- Galibiyet düğümü tamamlar (3 yıldız), beraberlik 1 yıldız; yıldızlar asla düşmez. Saf reducer: `recordGameResult`.
- Boss düğümleri daha büyük ve farklı renkte; bossun konuşma balonları daha "dramatik".
- Konuşma balonları olaylara bağlıdır (`greeting`, `botCaptures`, `playerCaptures`, `botGivesCheck`, `playerGivesCheck`, `botWins`, `botLoses`, `draw`); metinler **dil dosyalarında**, bot başına dizi olarak durur.

### 5.5 Bulmacalar (Lichess CC0)

- Kaynak: https://database.lichess.org/#puzzles (CC0). CSV'de FEN rakibin hamlesinden **önceki** konumdur; `parseLichessCsvRow` ilk hamleyi uygulayıp oyuncunun sırasıyla başlatır. Son hamlede alternatif mat da kabul edilir.
- Planlanan hat (sonraki PR): çevrimdışı script ile CSV filtrelenir (popülerlik, oynanma sayısı, tema, puan bandı) → tema/puan bandına göre küçük JSON parçaları → statik barındırma veya Supabase Storage. İstemci yalnızca ihtiyacı olan parçayı indirir.

### 5.6 Oyun sonu koçu

1. **Feature Extractor** (deterministik, motorsuz): oyuncunun her hamlesi için
   - `hangingPiece`: savunmasız kalan veya daha ucuz taşla saldırılan taş (piyon/şah hariç),
   - `materialLoss`: hamle + rakip cevabı sonrası ≥2 puan malzeme kaybı,
   - `forkSuffered`: rakibin cevabındaki taşın ≥2 değerli hedefe (şah dahil) aynı anda saldırması,
   - `mateThreatAllowed`: hamleden sonra rakibin tek hamlede mat imkânı.
2. **Rapor**: öncelik sırasıyla (mat tehdidi > çatal > asılı taş > malzeme) en fazla 3 an seçilir; her an **dil bağımsız** bir mesajdır: `{ key, params, pieceParams, sanParams }`.
3. **Şablonlar**: her dilin kendi `coach.json` dosyası; taş adları ve notasyon UI'da o dile çevrilir. Şablonlara `context` olarak taş sembolü verilir; çevirmenler gerekirse `hangingPiece_q` gibi cinsiyete/hâl ekine göre varyant ekleyebilir.
4. **LLM (sonra, isteğe bağlı)**: LLM yalnızca Feature Extractor çıktısını süsleyebilir; ürettiği her iddia `verifyFeatures` ile tahtaya karşı yeniden doğrulanır, doğrulanamayan cümle gösterilmez.

### 5.7 İntikam bulmacaları

- Oyun sonunda arka planda: oyuncunun değerlendirmeyi ≥150 cp düşüren hamlelerinden **önceki** konum MultiPV ≥2 ile analiz edilir.
- Yalnızca **tek net kazandıran hamle** olan konumlar kabul edilir (`singleClearWinningMove`): en iyi hamle ≥ +200 cp (veya mat) ve ikinci en iyiden ≥150 cp daha iyi; tek yasal hamle olan konumlar reddedilir.
- Tekrar zamanlaması: Leitner kutuları (0, 1, 3, 7, 16, 35 gün). Yanlış çözüm kutu 1'e döndürür; son kutu "ustalaşıldı".
- 1a'da veri `localStorage`'da; hesap gelince `revenge_puzzles` tablosuna taşınır.

### 5.8 Analitik ve gizlilik

- `AnalyticsPort` olayları: `app_opened`, `game_started`, `game_finished`, `level_completed`, `puzzle_solved`, `language_changed`. **Kişisel veri, serbest metin, FEN/PGN gönderilmez.**
- PostHog yalnızca `VITE_POSTHOG_KEY` tanımlıysa tembel yüklenir; anahtar yoksa pakete hiç girmez. Varsayılan: izin verilene kadar gönderim kapalı (`opt_out_capturing_by_default`), `persistence: memory`, otomatik yakalama ve oturum kaydı kapalı, IP saklanmaz (PostHog projesinde "Discard client IP" de açılmalı). EU barındırma.
- D1/D7/D30: PostHog "Retention" içgörüsü, başlangıç olayı `app_opened`, dönüş olayı `app_opened`. KVKK/GDPR için açık rıza ekranı (çok dilli) sonraki adım.

## 6. Çoklu dil (i18n)

### 6.1 Diller

| Kod | Dil | Durum |
| --- | --- | --- |
| `tr` | Türkçe | **varsayılan**, tam kalite, referans dil |
| `en` | English | tam kalite |
| `de`, `fr`, `es`, `ru`, `zh-Hans` | Almanca, Fransızca, İspanyolca, Rusça, Basitleştirilmiş Çince | **beta**: yapay zekâ çevirisi, ana dili konuşan biri tarafından gözden geçirilmeli |

Beta diller `LOCALES` kaydında `status: 'beta'` ile işaretlidir; dil seçicide "(beta)" etiketi ve seçildiğinde "otomatik çeviri" notu gösterilir.

### 6.2 İlkeler

- **Kodda sabit kullanıcı metni yok.** Görünen her metin, `aria-label`, `title`, `alt` `t()` üzerinden gelir. `src/i18n/noHardcodedStrings.test.ts` bunu `src/ui` için zorlar.
- Ad alanları: `common` (arayüz), `bots` (bot adı, tanıtım, konuşma satırları), `coach` (koç şablonları). Bot konuşmaları ve koç şablonları **her dilde ayrı yazılır**, İngilizce parçalardan birleştirilmez.
- Çekirdek yalnızca anahtar + ham parametre döndürür (taş sembolü, SAN, kare); çeviri UI katmanında yapılır.
- Çoğullar i18next kurallarıyla (`_one`, `_few`, `_many`, `_other`); test her dilin `Intl.PluralRules` kategorilerinin hepsini sağladığını kontrol eder.

### 6.3 Yükleme, algılama, kalıcılık

- Her `dil/adalanı.json` ayrı bir parça (chunk) olarak derlenir ve **yalnızca etkin dil** indirilir (`i18next-resources-to-backend` + dinamik `import()`). Tr/en için yedek dil yüklenmez (anahtar eşliği testle garanti); beta dillerde güvenlik ağı olarak İngilizce yedek kullanılır.
- İlk ziyaret: kayıtlı seçim → `navigator.languages` içindeki ilk desteklenen dil (`de-AT`→`de`, `zh-CN`/`zh`→`zh-Hans`; geleneksel Çince eşlenmez) → Türkçe.
- Seçim `localStorage` (`nexus.locale`) içinde saklanır; `<html lang dir>` güncellenir.

### 6.4 Satranç notasyonu

Taş harfleri her dilin `common.json` → `notation` alanındadır ve hamle listesi ile koç cümlelerinde kullanılır (`localizeSan`):

| Dil | Şah | Vezir | Kale | Fil | At |
| --- | --- | --- | --- | --- | --- |
| tr | Ş | V | K | F | A |
| en | K | Q | R | B | N |
| de | K | D | T | L | S |
| fr | R | D | T | F | C |
| es | R | D | T | A | C |
| ru | Кр | Ф | Л | С | К |
| zh-Hans | 王 | 后 | 车 | 象 | 马 |

Motor ve depolama her zaman UCI/İngilizce SAN kullanır; yerelleştirme yalnızca gösterimdedir.

### 6.5 Yerleşim, uzun metinler, CJK, RTL hazırlığı

- CSS'te yalnızca mantıksal özellikler (`margin-inline`, `padding-block`, `border-start-start-radius`); metin kutularında sabit genişlik yok, `overflow-wrap: anywhere`; butonlar sarılabilir (Almanca/Rusça uzun metinler).
- CJK: `zh-Hans` için kayıtta özel yazı tipi yığını (PingFang SC, Microsoft YaHei, Noto Sans SC…) `--locale-font` ile uygulanır; satır yüksekliği artırılır.
- RTL (ör. Arapça) **şimdi uygulanmıyor** ama hazır: kayıtta `dir` alanı var, `<html dir>` otomatik ayarlanıyor, CSS mantıksal özelliklerle yazıldı, tahta her zaman `direction: ltr` (koordinatlar aynalanmaz). Arapça eklemek = kayıt girdisi + dosyalar + görsel kontrol.

### 6.6 Çeviri iş akışı

1. Yeni metin önce `src/i18n/locales/tr/*.json` dosyasına eklenir (referans dil), sonra `en`'e.
2. Beta diller için yapay zekâ çevirisi üretilir (aynı anahtarlar, aynı `{{yer tutucular}}`, dilin çoğul biçimleri). Çevirmene not: taş adlarının cinsiyet/hâl uyumu gerektirdiği yerde cümle "e4'teki taş (fil)" gibi kurulur veya `_<taş>` bağlam varyantı eklenir.
3. `npm test` eksik/fazla anahtarı, eksik çoğul biçimini, uyumsuz yer tutucuyu ve boş metni yakalar.
4. Ana dili konuşan gözden geçirici onayladığında dilin `status`'u `stable` yapılır (beta etiketi kalkar).
5. Yeni dil eklemek: `LOCALES`'e bir girdi + `locales/<kod>/{common,bots,coach}.json`. Başka kod değişikliği gerekmez.
6. İleride: Crowdin/Weblate/Tolgee gibi bir çeviri platformu JSON dosyalarını doğrudan senkronlayabilir.

## 7. Arka uç ve veri modeli

- Faz 1a: hesap yok; ilerleme `LocalProgressRepository` ile `localStorage`'da. Tüm erişim `ProgressRepository` arayüzü üzerinden.
- Önerilen Supabase şeması: `supabase/migrations/0001_init.sql` (`player_progress`, `revenge_puzzles`, RLS politikaları). Henüz uygulanmadı.

## 8. Faz 1b — yalnızca veri modeli (UI yok)

- **Öğretmen / sunum modu** (ETAP/Pardus akıllı tahtalar): `PresentationDeck` → `PresentationSlide { fen, annotations[], note }`; ok/kare vurgusu dört renkle, büyük dokunma hedefleri. Tahta bileşeni zaten tıkla-tıkla hamleyi destekliyor.
- **Anonim sınıflar**: `Classroom { code: "KALE-4521", teacherId, label: "5-B" }`, `StudentSeat { code, classCode, avatar (emoji), progressId }`. Öğrenciler hakkında ad, e-posta, doğum tarihi **saklanmaz**; öğrenci hesabı yoktur, erişim koda dayalı bir Edge Function üzerinden olur. Şema ve RLS politikaları migration dosyasında.

## 9. Lisanslar

- chess.js: BSD-2-Clause · react-chessboard: MIT · i18next ailesi: MIT · posthog-js: MIT/Apache-2.0.
- **chessground (GPL) ve Lichess kodu kullanılmaz.** Kurallar `.cursor/rules/licensing.mdc` içinde.
- **Stockfish (GPL-3.0)** ayrı bir program olarak çalışır: `public/engine/` altında, Web Worker'da, yalnızca UCI ile. Yanında `Copying.txt` (GPL metni) ve `SOURCE.md` (kaynak bağlantıları + **yazılı kaynak teklifi**) dağıtılır. Yükümlülük: dağıttığımız motor ikilisinin tam kaynağını en az 3 yıl talep edene sağlamak; motor sürümü değişince bu dosyalar güncellenir. Mağaza (Capacitor) dağıtımında da aynı dosyalar uygulama içinde "Lisanslar" ekranından erişilebilir olmalı. Hukuki onay önerilir.
- Lichess bulmaca veritabanı: CC0.

## 10. Test stratejisi ve CI

- Odak: **kendi** oyun durumumuz ve ilerlememiz (oturum, kontrolcü, bot seçimi, kitap, harita, koç, intikam, SRS, bulmaca içe aktarma) ve **UI→motor entegrasyonu**: terfi (seçici, otomatik vezir yok, iptal), rok (`e1g1`), geçerken alma (alınan piyonun kalkması), motor terfisi (`a2a1q`).
- chess.js kuralları **yeniden test edilmez**.
- `FakeEngine` ve `seededRng` ile deterministik testler; gerçek Stockfish testlerde çalışmaz.
- i18n testleri: anahtar eşliği, çoğul kategoriler, yer tutucular, bot satırlarının tamlığı, taş harflerinin benzersizliği, dil algılama, sabit metin koruması.
- Mimari sınır testi: `src/core` yasak import/global kullanmaz.
- CI (`.github/workflows/ci.yml`): `npm ci` → lint → typecheck → test → build.

## 11. Bu PR'da çalışanlar

- Haritadan ilk bota (Minik Mert) karşı tarayıcıda tam oyun; Stockfish 19 lite Web Worker'da; sürükle-bırak ve tıkla-tıkla hamle; son hamle/seçili kare/şah vurgusu.
- Terfi seçici, rok, geçerken alma; terk etme; tekrar oyna.
- Bot konuşma balonları (olay bazlı, 7 dilde), oyun sonu koç raporu (7 dilde şablonlar).
- İlerleme ve kilit açma (localStorage), yıldızlar.
- 7 dil, tembel yükleme, tarayıcı dili algılama, kalıcı seçim, yerelleştirilmiş notasyon, beta etiketi.
- PostHog kancası (anahtar yoksa kapalı). Faz 1b tipleri ve SQL şeması.

**Henüz yok (sonraki adımlar):** bulmaca ekranı ve veri hattı, intikam bulmacası üretim hattı (mantık hazır, UI ve arka plan analizi yok), rıza ekranı, Supabase adaptörü, bot-başına daha zengin kitaplar, ses/animasyon, PWA/Capacitor.

## 12. Açık kararlar (kullanıcıdan)

1. **Arka uç:** Supabase (önerilen) mı, Hono mu? Ne zaman hesap/oturum açma eklenecek?
2. **Uygulama lisansı:** Kapalı kaynak mı, açık kaynak mı? (Stockfish ayrı program olduğu için her iki seçenek de mümkün; kaynak teklifinde iletişim adresi gerekiyor.)
3. **Bot kadrosu ve isimleri:** Minik Mert / Atlı Ayşe / Sultan Kale ve diğer dillerdeki karşılıkları uygun mu? Dünya başına kaç bot + 1 boss?
4. **Zorluk kalibrasyonu:** Gösterilen Elo'lar tahmini; ilk oyuncu verisiyle mi ayarlansın?
5. **Analitik:** PostHog EU bulut mu, kendi sunucumuz mu? Rıza ekranı metni ve KVKK aydınlatma metni.
6. **Beta çevirilerin gözden geçirilmesi:** Hangi diller için ana dili konuşan gözden geçirici bulunacak? Önceliklendirme (ör. önce de/ru)?
7. **Bulmaca barındırma:** Statik CDN mi, Supabase Storage mı? Başlangıçta kaç bulmaca (ör. tema başına 500)?
8. **Motor seçimi:** Lite (1,8 MB, daha zayıf) yeterli mi; analiz için tam NNUE (~94 MB, COOP/COEP) isteniyor mu?

## 13. Riskler

- Lite motor bazı cihazlarda yavaş olabilir → derinlik/movetime cihaz kapasitesine göre ayarlanmalı.
- Feature Extractor sezgiseldir (ör. asılı taş tanımı basit); yanlış pozitifler koçun güvenilirliğini düşürür → gerçek oyunlarla ayarlama ve gerektiğinde motorla teyit.
- Makine çevirisi kalitesi (özellikle koç şablonlarında dil bilgisi) → beta etiketi + inceleme süreci.
- react-chessboard v5 yeni bir sürüm; gerekirse cm-chessboard'a geçiş UI katmanıyla sınırlı kalır.
