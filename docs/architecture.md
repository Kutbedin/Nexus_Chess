# Nexus Chess — Faz 1a Teknik Mimari Planı

> Durum: taslak v2 · Kapsam: Faz 1a (tek oyunculu çekirdek) + Faz 1b veri modeli · Dil: Türkçe öncelikli, çok dilli

## 1. Özet

Nexus Chess, Chess.com ve Lichess ile **tek oyunculu deneyim** üzerinden rekabet eden, Türkçe öncelikli bir web satranç oyunudur. Faz 1a'nın hedefi: kişilikli botlara karşı oynanan, Duolingo tarzı bir seviye haritasıyla ilerlenen, oyun sonunda Türkçe koç yorumu veren ve oyuncunun kendi hatalarından "intikam bulmacaları" üreten bir çekirdek.

**İlk dilim (PR #1, birleştirildi):** tarayıcıda bir bota karşı baştan sona oyun (Stockfish Web Worker içinde), seviye haritası, konuşma balonları, oyun sonu koç raporu, 7 dilde arayüz, lint + typecheck + birim testleri + CI.

**İkinci dilim (bu milestone):** ~2.000 doğrulanmış Lichess bulmacası (puana göre sıralı, çevrimdışı), intikam bulmacaları (arka plan analizi + tekrar + hikâye), 4 botlu tam Dünya 1, "dikkatli acemi" Minik Mert, `EngineProvider` ve `StorageAdapter` arayüzleri, Hakkında sayfası (GPLv3 bildirimi), okul modunda tamamen kapalı çerezsiz analitik, beta dillerde "çeviri hatası bildir" düğmesi.

## 2. Teknoloji seçimleri

| Alan | Seçim | Gerekçe |
| --- | --- | --- |
| Uygulama | Vite + React + TypeScript (SPA) | SSR yok; aynı paket ileride Capacitor ile iOS/Android'e sarılabilir. |
| Kurallar | chess.js (BSD-2) | Hamle geçerliliği, mat/pat/beraberlik için tek "kural kaynağı". |
| Tahta | react-chessboard v5 (MIT) | Sürükle-bırak + dokunmatik, ok/kare vurgusu. Alternatif: cm-chessboard (MIT). **chessground (GPL) kullanılmaz.** |
| Motor | Stockfish 19 WASM, "lite single-threaded" (~1,8 MB) | Web Worker'da ayrı program olarak çalışır; COOP/COEP başlığı gerektirmez. |
| Çoklu dil | i18next + react-i18next + i18next-resources-to-backend | Dil başına tembel yükleme, çoğul kuralları, bağlam (context) desteği. |
| Analitik | PostHog (EU), çerezsiz + anonim, yalnızca anahtar varsa ve tembel yüklenir | Okul/öğrenci modunda tamamen kapalı (hiç yüklenmez). Otomatik yakalama ve oturum kaydı kapalı. |
| Depolama | `StorageAdapter` → şimdilik `localStorage` | Sonraki faz: Supabase anonim oturum (Safari 7 gün silme kuralı yüzünden). |
| Çevrimdışı | Elle yazılmış service worker (`public/sw.js`) | Bulmaca paketleri + motor kurulumda önbelleğe alınır; Capacitor'da dosyalar zaten pakette. |
| Arka uç | **Öneri: Supabase** (Postgres + Auth + RLS + Edge Functions) | 1a'da arka uç yok (misafir oyun, localStorage); arayüzler hazır. |
| Test | Vitest + Testing Library + jsdom | Hızlı, Vite ile aynı yapılandırma. |
| Lint | oxlint | Vite şablonunun varsayılanı, çok hızlı. |

### Supabase mı Hono mu?

- **Supabase (önerilen):** Auth, RLS ile satır bazlı yetki, Postgres, depolama (bulmaca dosyaları) ve Edge Functions tek pakette. Faz 1b'deki sınıf/öğrenci kodları için RLS + bir Edge Function yeterli. Az kodla başlarız.
- **Hono:** Tam kontrol, herhangi bir sunucuda (Cloudflare Workers, Node) çalışır; ama Auth, veritabanı ve yetkilendirmeyi kendimiz kurmamız gerekir.
- Karar ne olursa olsun istemci yalnızca `StorageAdapter` gibi **arayüzlerle** konuşur; arka uç değişirse yalnızca adaptör değişir.

## 3. Katmanlar

```
┌──────────────────────────── src/ui (React) ────────────────────────────┐
│ App (gezinme) · LevelMap · GameScreen · PuzzlesScreen · RevengeScreen   │
│ AboutScreen · PuzzleSolver · SpeechBubble · PromotionPicker · Switcher  │
└───────────────▲───────────────────────────────────────▲────────────────┘
                │ durum aboneliği / jestler              │ t(), useLocalizedSan
┌───────────────┴──────────── src/core (saf TS) ─────────┴────────────────┐
│ game: GameSession, BotGameController   bots: kişilik, hamle seçimi, kitap│
│ engine: EngineProvider, EnginePort, UCI progression: harita, ilerleme    │
│ coach: Feature Extractor, rapor        revenge: analiz, seçim, kuyruk, SRS│
│ puzzles: PuzzleSession, paketler       tactics: asılı taş, tek hamle mat │
│ storage: StorageAdapter                classroom (1b), analytics port    │
└───────────────▲───────────────────────────────────────▲────────────────┘
                │ portlar (arayüzler)                    │
┌───────────────┴──────── src/platform (adaptörler) ────┴────────────────┐
│ StockfishWasmProvider (Worker/UCI) · LocalStorageAdapter · PostHog EU   │
│ puzzlePacks (statik JSON) · schoolMode · public/sw.js (çevrimdışı)      │
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
    engine/       + EngineProvider (motor fabrikası + dağıtılan derleme bilgisi)
    bots/         kişilik tipi, kadro (roster, Türkçe özel adlar), hamle seçimi + güvenlik filtresi, kitap, tepkiler
    progression/  seviye haritası (Dünya 1: 4 bot + 3 bulmaca durağı), ilerleme reducer'ı
    coach/        Feature Extractor, koç raporu (dil bağımsız anahtarlar)
    tactics/      taş değerleri, asılı taş, tek hamlede mat (koç + bot güvenliği ortak)
    revenge/      arka plan analizi, "tek net kazandıran hamle", kuyruk, Leitner SRS
    puzzles/      PuzzleSession (çözüm akışı), paket manifestosu/kilit kuralları, Lichess CSV ayrıştırma
    storage/      StorageAdapter arayüzü + PuzzleStats
    notation/     yerelleştirilmiş SAN (taş harfleri)
    classroom/    Faz 1b veri modeli (yalnızca tipler + kod üretici)
    analytics/    AnalyticsPort ve olay tipleri
  platform/       stockfishEngine (+ StockfishWasmProvider), localStorageAdapter, analytics (PostHog), schoolMode, puzzlePacks
  i18n/           locales.ts (kayıt), i18n.ts (başlatma/algılama), locales/<dil>/{common,bots,coach,puzzles,about}.json
  config.ts       iletişim adresi, kaynak deposu bağlantısı (yer tutucular)
  ui/             App, components/, screens/, hooks/
scripts/copy-engine.mjs   Stockfish dosyalarını public/engine/'a kopyalar (postinstall)
scripts/build-puzzles.mjs Lichess CSV'sinden doğrulanmış bulmaca paketleri üretir (public/puzzles/)
public/sw.js              service worker (çevrimdışı)
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
- **`EngineProvider`** (`src/core/engine/provider.ts`): `get('play' | 'analysis')` amaca göre motor verir ve `info` ile dağıtılan derlemeyi tanımlar. Web: `StockfishWasmProvider` amaç başına bir worker açar; böylece arka plandaki intikam analizi botun hamlesini geciktirmez. iOS veya lisans gerekçesiyle izin verici lisanslı bir motor ya da sunucu motoru aynı arayüzle takılır; oyun kodu değişmez.
- **Dağıtılan derleme (tam):** npm `stockfish@19.0.1` (package.json'da tam sabitlenmiş), `nmrugg/stockfish.js` etiketi `v19.0.1`, commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`; dosya SHA-256 değerleri `docs/stockfish-source.md` içinde. Aynı bilgi Hakkında sayfasında `STOCKFISH_INFO` üzerinden gösterilir.
- İleride: güçlü cihazlarda tam NNUE (~94 MB, COOP/COEP gerekir) isteğe bağlı.

### 5.3 Kişilikli botlar

Her bot (`BotPersonality`):

- `search`: derinlik ve **MultiPV** sayısı (ör. 6 aday).
- `maxLossCp`: en iyi hamleye göre en fazla kaç santipiyon kaybettiren hamleleri kabul eder; `blunderChance` + `blunderLossCp`: ara sıra bilinçli "insan gibi" hata.
- `temperatureCp`: softmax sıcaklığı (yüksek = daha rastgele).
- `style`: `aggression` (şah/alma bonusu), `materialism` (alınan taş değeri bonusu).
- `book`: bota özel açılış kitabı (UCI geçmişi → ağırlıklı hamleler). Kitap hamlesi geçersizse atlanır; test tüm kitap girişlerinin geçerli olduğunu doğrular.

Seçim: adaylar tolerans dışındaysa elenir → stil bonusu eklenir → softmax ile örneklenir. Stockfish'in `Skill Level` / `UCI_Elo` ayarları bilinçli olarak kullanılmaz; kişilik bizim kodumuzda, test edilebilir.

**Dünya 1 kadrosu (3 normal + 1 boss):** **Minik Mert** (~400, "Çaylak"), **Atlı Ayşe** (~700, "At Ustası"), **Fil Filiz** (~950, "Çapraz Ustası": fianketto kitabı, uzun çaprazlar), **Sultan Kale** (Dünya 1 bossu, ~1200). Elo değerleri gösterim amaçlıdır; oyuncu verisiyle kalibre edilecek.

- **Özel adlar her dilde Türkçe kalır** (bir insan adı gibi): `name` alanı `roster.ts` içindedir, dil dosyalarında yoktur ve `lang="tr"` ile çizilir. Yalnızca unvan (`title`), tanıtım (`tagline`) ve konuşma satırları çevrilir. Test, hiçbir dil dosyasında `name` anahtarı olmadığını doğrular.
- **Minik Mert = "dikkatli acemi":** derinlik 2, MultiPV 8. Sığ arama 1 hamlelik almaları görür ama 2 hamlelik tehditleri (çatal, 2 hamlede mat) kaçırır. Ek olarak `safety` filtresi: (1) hamleden sonra vezir/kale **asılı kalıyorsa** (savunmasız ya da daha ucuz taşla saldırı altında; `findHangingPieces`) aday elenir; tüm adaylar böyleyse filtre devre dışı kalır; (2) "hata zarı" tutsa bile kayıp en iyi adaya göre **500 cp ile sınırlıdır** (`hardMaxLossCp`). Sonuç: taşlarını rastgele hediye etmez, ama kombinasyonları görmez.

### 5.4 Seviye haritası ve bosslar

- Dikey, zikzak yol (Duolingo tarzı). Düğüm türleri: `bot`, `puzzles`, `boss`. Her düğüm `requires` listesindeki düğümler tamamlanınca açılır.
- Dünya 1 yolu: Minik Mert → bulmaca durağı (1 hamlede mat ×3) → Atlı Ayşe → durak (çatal ×3) → Fil Filiz → durak (arka sıra matı ×3) → **Sultan Kale (boss)**.
- Galibiyet düğümü tamamlar (3 yıldız), beraberlik 1 yıldız; yıldızlar asla düşmez. Saf reducer: `recordGameResult`. Bulmaca durağı, temadan istenen sayıda bulmaca çözülünce tamamlanır (`recordPuzzleNodeCompleted`).
- Boss düğümleri daha büyük ve farklı renkte; bossun konuşma balonları daha "dramatik".
- Konuşma balonları olaylara bağlıdır (`greeting`, `botCaptures`, `playerCaptures`, `botGivesCheck`, `playerGivesCheck`, `botWins`, `botLoses`, `draw`); metinler **dil dosyalarında**, bot başına dizi olarak durur.

### 5.5 Bulmacalar (Lichess CC0)

- Kaynak: https://database.lichess.org/#puzzles (CC0). CSV'de FEN rakibin hamlesinden **önceki** konumdur; `parseLichessCsvRow` ilk hamleyi uygulayıp oyuncunun sırasıyla başlatır. Son hamlede alternatif mat da kabul edilir.
- **Veri hattı (uygulandı):** `node scripts/build-puzzles.mjs` Lichess `.csv.zst` dökümünü akış olarak indirir (pzstd'nin "skippable" çerçeveleri ayıklanıp Node'un yerleşik zstd çözücüsüyle açılır, ek araç gerekmez) ve şu filtreleri uygular: popülerlik ≥85, oynanma ≥500, puan sapması ≤90, çözüm ≤4 oyuncu hamlesi.
- **Seçim:** 11 tema (arka sıra matı, 1/2 hamlede mat, çatal, açmaz, şiş, açarak saldırı, korumasız taş, saptırma, kapana kısılmış taş, terfi), her tema için puan bantlarına kota (yeni başlayanlara ağırlık: <800 %25, 800–1100 %25, 1100–1400 %20, 1400–1700 %15, 1700–2000 %10, 2000+ %5). Sonuç: **2.009 bulmaca**, puan 416–2673.
- **Doğrulama (her bulmaca):** FEN geçerli, kurulum hamlesi ve tüm çözüm hamleleri yasal, son hamle oyuncunun, "mate" temalılar matla bitiyor, kimlikler benzersiz. Hem üretim scriptinde hem de `packs.test.ts` içinde (CI'da) tekrar kontrol edilir; 0 red.
- **Paketler:** puana göre sıralanıp **eşit parçalara** bölünür → 9 paket × 217–224 bulmaca (`public/puzzles/pack-NN.json`, toplam ~390 KB) + `index.json` manifestosu (puan aralığı, tema sayıları, kaynak/CC0 notu). `--repack` seçeneği indirmeden yeniden doğrular ve böler.
- **Kademeli zorluk:** Paket 1 açık; paket N, paket N-1'in yarısı çözülünce açılır. Paket içinde tema filtresi; çözülmemişler önce gelir. Çözüm durumu `PuzzleStats` ile (`ilk denemede mi`, paket kimliği) saklanır.
- **Çözüm akışı (`PuzzleSession`):** yanlış hamle uygulanmaz (tekrar denenir, "ilk deneme" kaybedilir), doğru hamleden sonra rakibin zorunlu cevabı otomatik oynanır, son hamlede alternatif mat kabul edilir, terfi seçici, ipucu ve "çözümü göster".
- **Çevrimdışı:** service worker kurulumda manifestoyu, tüm paketleri ve motoru önbelleğe alır; derlenmiş JS/CSS ve dil parçaları ilk kullanımda önbelleğe girer; sayfa gezinmesi ağ yoksa önbellekteki kabuğa düşer. Gerçek tarayıcıda ağ kapatılarak doğrulandı.

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

- **Arka plan analizi (`findRevengePuzzles`, uygulandı):** bota karşı her oyun bitince ayrı "analysis" motoruyla oyuncunun her hamlesinden önceki konum MultiPV 2, derinlik 12 ile incelenir. Tek net kazandıran hamle varsa ve oyuncu onu oynamadıysa, oynanan hamlenin değeri (sonraki konumun analizi, ters işaretli) hesaplanır; kayıp ≥150 cp ise bulmaca olur. Oyun başına en fazla 3 bulmaca; oyuncu en iyi hamleyi bulduysa ikinci analiz yapılmaz. Gerçek Stockfish ile Çoban Matı kaçırılan bir oyunda ~0,4 sn'de doğru bulmacayı (Vxf7#) üretti.
- **Hikâye kancası:** her bulmaca `kind` (`missedMate` / `missedWin`), mat mesafesi, bot kimliği, hamle numarası ve oynanan hamleyle saklanır → "Minik Mert karşısında kaçırdığın mat! 4. hamlede d3 oynamıştın; oysa 1 hamlede mat vardı. Şimdi bul!" (7 dilde, notasyon yerelleştirilmiş, bot adı Türkçe).
- **Ekran:** üst menüde "İntikam" ve vadesi gelen bulmaca sayısı rozeti; analiz sürerken ve yeni bulmacalar hazır olduğunda bildirim. Bulmaca ilk denemede çözülürse "doğru", yanlış hamle/ipucu/çözümü göster "yanlış" sayılır.
- Kuyruk: aynı kimlik veya aynı konum ikinci kez eklenmez; en fazla 200 kayıt.
- Yalnızca **tek net kazandıran hamle** olan konumlar kabul edilir (`singleClearWinningMove`): en iyi hamle ≥ +200 cp (veya mat) ve ikinci en iyiden ≥150 cp daha iyi; tek yasal hamle olan konumlar reddedilir.
- Tekrar zamanlaması: Leitner kutuları (0, 1, 3, 7, 16, 35 gün). Yanlış çözüm kutu 1'e döndürür; son kutu "ustalaşıldı".
- Veri `StorageAdapter` üzerinden (şimdilik `localStorage`); hesap gelince `revenge_puzzles` tablosuna taşınır.

### 5.8 Analitik ve gizlilik

- `AnalyticsPort` olayları: `app_opened`, `game_started`, `game_finished`, `level_completed`, `puzzle_solved` (`pack`/`revenge`), `revenge_created`, `language_changed`, `translation_report_opened`. **Kişisel veri, serbest metin, FEN/PGN gönderilmez.**
- **PostHog EU, varsayılan olarak çerezsiz ve anonim:** `api_host: eu.i.posthog.com`, `cookieless_mode: 'always'`, `persistence: 'memory'` (çerez/localStorage kimliği yok), `person_profiles: 'never'`, otomatik yakalama, sayfa görüntüleme, oturum kaydı ve anketler kapalı. Yalnızca `VITE_POSTHOG_KEY` tanımlıysa tembel yüklenir. PostHog projesinde "Discard client IP" ve çerezsiz sunucu tarafı ayarı açılmalı.
- **Okul/öğrenci modu analitiği tamamen kapatır:** `VITE_SCHOOL_MODE=true` ile derleme, ya da uygulamayı `?mode=school` ile açma (cihazda kalıcı; `?mode=home` ile kapanır). Bu modda PostHog **hiç indirilmez**, hiçbir olay gönderilmez (testle doğrulanır). Faz 1b'de sınıf koduyla giriş bu bayrağı otomatik açacak.
- **Kimliksiz elde tutma (D1/D7/D30):** kalıcı kullanıcı kimliği olmadığı için `app_opened` olayı `daysSinceFirstOpen` ve `firstOpenWeek` (ISO hafta) taşır; ilk açılış tarihi yalnızca cihazda tutulur, sunucuya kimlik gitmez. Elde tutma, hafta kohortu başına "N. günde açılış" sayılarının o kohortun 0. gün sayısına oranıyla hesaplanır (PostHog Trends + formül).
- KVKK/GDPR aydınlatma metni (çok dilli) sonraki adım; çerezsiz/anonim kurgu nedeniyle rıza ekranı gerekip gerekmediği hukukçuya sorulmalı.

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
- Ad alanları: `common` (arayüz), `bots` (unvan, tanıtım, konuşma satırları — **ad değil**), `coach` (koç şablonları), `puzzles` (bulmaca/intikam ekranları, tema adları), `about` (Hakkında/lisans metinleri). Bot konuşmaları ve koç şablonları **her dilde ayrı yazılır**, İngilizce parçalardan birleştirilmez.
- Bot özel adları (Minik Mert, Atlı Ayşe, Fil Filiz, Sultan Kale) çevrilmez; kodda tutulur.
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
5. Yeni dil eklemek: `LOCALES`'e bir girdi + `locales/<kod>/{common,bots,coach,puzzles,about}.json`. Başka kod değişikliği gerekmez.
6. **"Çeviri hatası bildir":** beta dillerde dil notunun yanında küçük bir bağlantı; `contact@nexuschess.com` adresine konu satırında dil ve ekran (`[translation][fr] puzzles`), gövdede doldurulacak şablonla e-posta açar. Serbest metin analitiğe gitmez; yalnızca `translation_report_opened { locale }` sayılır. İleride çeviri platformunun geri bildirim aracına bağlanabilir.
7. İleride: Crowdin/Weblate/Tolgee gibi bir çeviri platformu JSON dosyalarını doğrudan senkronlayabilir.

## 7. Arka uç ve veri modeli

- **`StorageAdapter`** (`src/core/storage/storageAdapter.ts`): ilerleme (`PlayerProgress`), bulmaca istatistikleri (`PuzzleStats`) ve intikam kuyruğu (`RevengeEntry[]`) için yükle/kaydet. Faz 1a uygulaması: `LocalStorageAdapter` (sürümlü anahtarlar, bozuk veride güvenli varsayılan) + `navigator.storage.persist()` isteği.
- **Neden sonraki faz Supabase anonim oturum:** Safari (ITP), 7 gün etkileşim olmayan sitelerin betikle yazılan depolamasını (localStorage, IndexedDB) siler; misafir oyuncunun ilerlemesi kaybolabilir. Plan: ilk açılışta `signInAnonymously()` → aynı arayüzü uygulayan `SupabaseStorageAdapter` (yerel önbellek + sunucu eşitleme) → isteğe bağlı hesap bağlama. UI ve çekirdek değişmez.
- Önerilen Supabase şeması: `supabase/migrations/0001_init.sql` (`player_progress`, `revenge_puzzles`, RLS politikaları). Henüz uygulanmadı.

## 8. Faz 1b — yalnızca veri modeli (UI yok)

- **Öğretmen / sunum modu** (ETAP/Pardus akıllı tahtalar): `PresentationDeck` → `PresentationSlide { fen, annotations[], note }`; ok/kare vurgusu dört renkle, büyük dokunma hedefleri. Tahta bileşeni zaten tıkla-tıkla hamleyi destekliyor.
- **Anonim sınıflar**: `Classroom { code: "KALE-4521", teacherId, label: "5-B" }`, `StudentSeat { code, classCode, avatar (emoji), progressId }`. Öğrenciler hakkında ad, e-posta, doğum tarihi **saklanmaz**; öğrenci hesabı yoktur, erişim koda dayalı bir Edge Function üzerinden olur. Şema ve RLS politikaları migration dosyasında.

## 9. Lisanslar

- **Uygulama kodu: özel mülk, tüm hakları saklıdır** (`LICENSE`, `package.json` → `"license": "UNLICENSED"`).
- chess.js: BSD-2-Clause · react-chessboard: MIT · i18next ailesi: MIT · posthog-js: MIT/Apache-2.0.
- **chessground (GPL) ve Lichess kodu kullanılmaz.** Kurallar `.cursor/rules/licensing.mdc` içinde.
- **Stockfish (GPL-3.0)** ayrı bir program olarak çalışır: `public/engine/` altında, Web Worker'da, yalnızca UCI ile. Yanında `Copying.txt` (GPL metni) ve `SOURCE.md` (kaynak bağlantıları + **yazılı kaynak teklifi**) dağıtılır. Yükümlülük: dağıttığımız motor ikilisinin tam kaynağını en az 3 yıl talep edene sağlamak; motor sürümü değişince bu dosyalar güncellenir. Mağaza (Capacitor) dağıtımında da aynı dosyalar uygulama içinde erişilebilir olmalı. Hukuki onay önerilir.
- **Hakkında sayfası (uygulandı, 7 dilde):** uygulama lisansı (tüm hakları saklıdır), Stockfish'in ayrı program olarak kullanıldığı ve GPLv3 ile lisanslandığı bildirimi, tam sürüm + derleme (paket/commit), kaynak bağlantısı (yer tutucu: `https://github.com/Kutbedin/stockfish-wasm-fork` — dağıttığımız commit'in herkese açık çatalı), üst proje bağlantısı, GPLv3 tam metni (`/engine/Copying.txt`), yazılı kaynak teklifi ve iletişim (`contact@nexuschess.com`, yer tutucu), üçüncü taraf bileşen listesi, gizlilik özeti. Yer tutucular `src/config.ts` içinde.
- Lichess bulmaca veritabanı: CC0 (Hakkında sayfasında ve bulmaca ekranında kaynak gösterilir).

## 10. Test stratejisi ve CI

- Odak: **kendi** oyun durumumuz ve ilerlememiz (oturum, kontrolcü, bot seçimi, kitap, harita, koç, intikam, SRS, bulmaca içe aktarma) ve **UI→motor entegrasyonu**: terfi (seçici, otomatik vezir yok, iptal), rok (`e1g1`), geçerken alma (alınan piyonun kalkması), motor terfisi (`a2a1q`).
- Bu milestone'da eklenenler: Minik Mert güvenlik filtresi, `PuzzleSession`, paket kilitleri, **paketlenmiş 2.009 bulmacanın tamamının doğrulanması**, intikam analizi (sahte motorla senaryolar), kuyruk/SRS, `LocalStorageAdapter`, okul modu + analitiğin hiç yüklenmemesi, çerezsiz PostHog ayarları, kimliksiz elde tutma özellikleri, Hakkında sayfası, "çeviri hatası bildir" bağlantısı, uygulama düzeyinde intikam bulmacasını tıklayarak çözme, bot düşünürken terk etme hatasına regresyon testi.
- chess.js kuralları **yeniden test edilmez**.
- `FakeEngine` ve `seededRng` ile deterministik testler; gerçek Stockfish testlerde çalışmaz.
- i18n testleri: anahtar eşliği, çoğul kategoriler, yer tutucular, bot satırlarının tamlığı, taş harflerinin benzersizliği, dil algılama, sabit metin koruması.
- Mimari sınır testi: `src/core` yasak import/global kullanmaz.
- CI (`.github/workflows/ci.yml`): `npm ci` → lint → typecheck → test → build.

## 11. Çalışanlar

### 11.1 İkinci dilim (bu milestone)

- **Bulmacalar:** 9 paket, 2.009 doğrulanmış bulmaca, puana göre kademeli kilit, tema filtresi, ipucu/çözüm, çevrimdışı.
- **İntikam:** bota karşı her oyundan sonra arka plan analizi (ayrı worker), hikâyeli bulmaca kartı, Leitner tekrarları, menüde rozet ve bildirim.
- **Dünya 1:** 4 bot (Minik Mert, Atlı Ayşe, **Fil Filiz**, Sultan Kale) + 3 bulmaca durağı; adlar her dilde Türkçe.
- **Minik Mert:** derinlik 2 + MultiPV 8 + vezir/kale asma filtresi + 500 cp tavan.
- **Mimari:** `EngineProvider` (Stockfish WASM, tam sürüm/commit), `StorageAdapter` (localStorage), okul modu, çerezsiz PostHog EU.
- **Hakkında** sayfası, `LICENSE` (tüm hakları saklıdır), beta dillerde "çeviri hatası bildir".
- Düzeltme: oyuncu bot düşünürken terk ederse botun geç gelen hamlesi "Game is over" hatası fırlatıyordu; artık yok sayılıyor.

### 11.2 İlk dilim (PR #1)

- Haritadan ilk bota (Minik Mert) karşı tarayıcıda tam oyun; Stockfish 19 lite Web Worker'da; sürükle-bırak ve tıkla-tıkla hamle; son hamle/seçili kare/şah vurgusu.
- Terfi seçici, rok, geçerken alma; terk etme; tekrar oyna.
- Bot konuşma balonları (olay bazlı, 7 dilde), oyun sonu koç raporu (7 dilde şablonlar).
- İlerleme ve kilit açma (localStorage), yıldızlar.
- 7 dil, tembel yükleme, tarayıcı dili algılama, kalıcı seçim, yerelleştirilmiş notasyon, beta etiketi.
- PostHog kancası (anahtar yoksa kapalı). Faz 1b tipleri ve SQL şeması.

**Henüz yok (sonraki adımlar):** Supabase anonim oturum + `SupabaseStorageAdapter`, KVKK aydınlatma metni, oyuncu bulmaca puanı (Glicko) ve kişisel öneri, Dünya 2, ses/animasyon, PWA manifestosu + Capacitor paketleme, `stockfish-wasm-fork` deposunun gerçekten açılması.

## 12. Açık kararlar (kullanıcıdan)

1. **Arka uç:** ~~Supabase mı Hono mu?~~ → Supabase anonim oturum sonraki fazda (karar verildi). Açık: hesap bağlama (e-posta/Apple/Google) ne zaman?
2. ~~Uygulama lisansı~~ → **özel mülk, tüm hakları saklıdır** (karar verildi). Açık: `contact@nexuschess.com` ve `Kutbedin/stockfish-wasm-fork` gerçek değerleri yayından önce onaylanmalı.
3. ~~Bot adları~~ → her dilde Türkçe (karar verildi). Açık: 4. bot "Fil Filiz" adı ve "Çapraz Ustası" unvanı uygun mu?
4. **Zorluk kalibrasyonu:** Gösterilen Elo'lar tahmini; ilk oyuncu verisiyle mi ayarlansın?
5. **Analitik:** ~~PostHog EU~~ (karar verildi, çerezsiz). Açık: KVKK aydınlatma metni; okul modu bayrağının sınıf koduyla otomatik açılması (Faz 1b).
6. **Beta çevirilerin gözden geçirilmesi:** Hangi diller için ana dili konuşan gözden geçirici bulunacak? Önceliklendirme (ör. önce de/ru)?
7. **Bulmaca barındırma:** Şimdilik statik dosya + service worker (~390 KB). Açık: kapsam büyüyünce (ör. 20.000+) CDN/Supabase Storage'a geçiş ve tema/puan bazlı ek paketler.
8. **Motor seçimi:** Lite (1,8 MB, daha zayıf) yeterli mi; analiz için tam NNUE (~94 MB, COOP/COEP) isteniyor mu?

## 13. Riskler

- Lite motor bazı cihazlarda yavaş olabilir → derinlik/movetime cihaz kapasitesine göre ayarlanmalı.
- Feature Extractor sezgiseldir (ör. asılı taş tanımı basit); yanlış pozitifler koçun güvenilirliğini düşürür → gerçek oyunlarla ayarlama ve gerektiğinde motorla teyit.
- Makine çevirisi kalitesi (özellikle koç şablonlarında dil bilgisi) → beta etiketi + inceleme süreci.
- react-chessboard v5 yeni bir sürüm; gerekirse cm-chessboard'a geçiş UI katmanıyla sınırlı kalır. (Bilinen tuzak: tahta `id`'si CSS seçicisinde kullanılıyor; `:` gibi karakterler uygulamayı çökertiyordu, artık temizleniyor ve testle korunuyor.)
- Safari'nin 7 günlük depolama silmesi → Supabase anonim oturum gelene kadar misafir ilerlemesi kaybolabilir.
- Arka plan analizi düşük güçlü cihazlarda pil/işlemci tüketir → derinlik cihaz kapasitesine göre düşürülebilir; analiz yalnızca oyun bittikten sonra çalışır.
