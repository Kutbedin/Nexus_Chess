# Bulut yedeği kurulumu (Supabase) — adım adım

Bu rehber, GambitZone'daki oyuncu ilerlemesinin (seviyeler, çözülen bulmacalar, intikam bulmacaları) internete
yedeklenmesini açar. Teknik bilgi gerekmez; yaklaşık 15 dakika sürer.

**Önce bilmen gerekenler**

- Oyuncu hiçbir şey yapmaz: kayıt ekranı yok. Uygulama ilk açılışta oyuncuya **anonim** bir kimlik verir.
- Ad, e-posta, doğum tarihi gibi kişisel veri **toplanmaz**. Sadece oyun verisi yedeklenir.
- İlerleme yine önce cihazda saklanır; internet yokken oyun aynen çalışır, bağlantı gelince yedeklenir.
- Okul modunda (`?mode=school`) bulut yedeği ve istatistikler tamamen kapalıdır.
- Bu ayarları yapmazsan uygulama bugünkü gibi tamamen cihazda çalışmaya devam eder. Hiçbir şey bozulmaz.

---

## 1. Ücretsiz Supabase projesi oluştur

1. <https://supabase.com> adresine git, **Start your project** düğmesine tıkla.
2. **Continue with GitHub** ile giriş yap (GitHub hesabın zaten var).
3. **New project** düğmesine tıkla ve şunları doldur:
   - **Name:** `gambitzone`
   - **Database Password:** **Generate a password** ile güçlü bir şifre oluştur ve bir yere kaydet
     (şifre yöneticisi veya güvenli bir not). Bu şifreyi uygulamaya **yazmayacağız**; sadece sende kalsın.
   - **Region:** **Central EU (Frankfurt)** seç (veriler AB'de kalsın; KVKK/GDPR için daha uygun).
   - **Plan:** **Free**
4. **Create new project** düğmesine tıkla. Proje 1–2 dakikada hazırlanır; ekran yeşil olana kadar bekle.

> Ücretsiz planda proje 1 hafta hiç kullanılmazsa "duraklatılır". Supabase sana e-posta atar;
> panelde **Restore** düğmesine basman yeterli, veriler silinmez.

## 2. Anonim girişi aç

1. Sol menüde **Authentication** (insan simgesi) → **Sign In / Providers** sayfasını aç.
2. **Allow anonymous sign-ins** anahtarını **açık** yap.
3. Aynı sayfada **Allow new users to sign up** anahtarının da açık olduğundan emin ol.
4. Sayfanın altındaki **Save changes** düğmesine bas.

> Menü adları Supabase güncellendikçe biraz değişebilir. Aradığın ifade: "anonymous sign-ins".

## 3. Veritabanı tablolarını oluştur (migration)

1. Bilgisayarında şu dosyayı **Not Defteri** ile aç (sağ tık → Birlikte aç → Not Defteri):
   `D:\Cursor Dosyalar\Nexus_chess\supabase\migrations\0001_cloud_backup.sql`
   (Ya da GitHub'da depoda aynı dosyayı aç ve **Raw** düğmesine bas.)
2. Tüm metni seç ve kopyala: **Ctrl+A**, sonra **Ctrl+C**.
3. Supabase panelinde sol menüden **SQL Editor**'ü aç → **New query**.
4. Boş alana yapıştır (**Ctrl+V**) ve sağ alttaki **Run** düğmesine bas (veya **Ctrl+Enter**).
5. Supabase "bu sorgu tehlikeli işlem içeriyor" gibi bir uyarı gösterirse **Run this query** ile onayla.
   (Dosya, aynı kuralları güvenle yeniden kurmak için `drop ... if exists` satırları içerir; veri silmez.)
6. Alt kısımda **Success. No rows returned** yazısını görmelisin.

**Kontrol:** Sol menüden **Table Editor**'ü aç. Üç tablo görmelisin: `player_progress`, `puzzle_stats`,
`revenge_puzzles`. Her birinde "RLS enabled" (veya kilit simgesi) görünmeli. RLS, her oyuncunun yalnızca
kendi satırlarını görebilmesini sağlayan güvenlik kuralıdır.

> Dosyayı ikinci kez çalıştırmak zararsızdır; mevcut verilere dokunmaz.

## 4. İki anahtarı kopyala

1. Sol alttaki **Project Settings** (dişli simgesi) → **Data API** (veya **API**) sayfasını aç.
   **Project URL** değerini kopyala. Şuna benzer: `https://abcdefghijkl.supabase.co`
2. **Project Settings** → **API Keys** sayfasını aç. Şu iki anahtardan **birini** kopyala:
   - **Publishable key** (`sb_publishable_...` ile başlar) — yeni projelerde bu var, bunu tercih et; ya da
   - **anon public** anahtarı (`eyJ...` ile başlayan uzun metin; "Legacy API keys" sekmesinde).

> **Asla** `secret`, `service_role` anahtarını veya veritabanı şifresini kopyalama ve dosyaya yazma.
> Publishable/anon anahtarı ise zaten tarayıcıda görünecek şekilde tasarlanmıştır; güvenliği RLS kuralları sağlar.

## 5. Anahtarları `.env.local` dosyasına yaz (Windows)

Proje klasörün: `D:\Cursor Dosyalar\Nexus_chess`

**Yöntem A — Cursor ile (önerilen):**

1. Cursor'da **File → Open Folder** ile `D:\Cursor Dosyalar\Nexus_chess` klasörünü aç.
2. Soldaki dosya listesinde en üstteki boş alana sağ tıkla → **New File**.
3. Dosya adı olarak tam olarak `.env.local` yaz (başında nokta var) ve **Enter**'a bas.
4. İçine şu iki satırı yaz; kendi değerlerinle değiştir:

   ```
   VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx
   ```

   - Tırnak işareti koyma, `=` işaretinin etrafında boşluk bırakma.
   - İstersen klasördeki `.env.example` dosyasının içeriğini kopyalayıp sadece bu iki satırı doldurabilirsin.
5. **Ctrl+S** ile kaydet.

**Yöntem B — Not Defteri ile:**

1. Not Defteri'ni aç, yukarıdaki iki satırı yaz.
2. **Dosya → Farklı Kaydet**. Klasör olarak `D:\Cursor Dosyalar\Nexus_chess` seç.
3. **Kayıt türü:** **Tüm Dosyalar (\*.\*)** seç. **Dosya adı:** `.env.local` yaz. **Kaydet**.
4. Dosya Gezgini'nde **Görünüm → Göster → Dosya adı uzantıları**'nı aç ve dosyanın adının
   `.env.local.txt` **olmadığından** emin ol. Öyleyse sağ tık → Yeniden adlandır → sondaki `.txt`'yi sil.

> `.env.local` dosyası GitHub'a **gönderilmez** (`.gitignore` bunu engeller). Anahtarlar sadece senin bilgisayarında kalır.

## 6. Uygulamayı yeniden başlat

Vite, `.env.local` dosyasını sadece başlarken okur. Cursor'da **Terminal → New Terminal** aç ve sırayla çalıştır:

```
cd "D:\Cursor Dosyalar\Nexus_chess"
git pull origin main
npm install
npm run dev
```

Zaten çalışan bir `npm run dev` varsa önce terminalde **Ctrl+C** ile durdur. Sonra tarayıcıda
<http://localhost:5173> adresini aç.

## 7. Çalıştığını kontrol et

1. Uygulamada bir bulmaca çöz veya bir oyun oyna. Birkaç saniye bekle.
2. Supabase panelinde **Authentication → Users**: "Anonymous" olarak işaretli yeni bir kullanıcı görmelisin.
3. **Table Editor → puzzle_stats** (veya `player_progress`): yeni satırlar görünmeli.
4. Uygulamada **Hakkında** sayfasındaki "Gizlilik" metni artık "anonim bir kimlikle bulutta yedeklenir" der.

**Okul modunu dene (isteğe bağlı):** <http://localhost:5173/?mode=school> adresini aç. Bu cihazda artık yedekleme
ve istatistik yapılmaz. Kapatmak için: <http://localhost:5173/?mode=home>.

## 8. Canlı siteye (yayına) eklemek

Site bir barındırma hizmetinde (ör. Vercel, Netlify, Cloudflare Pages) yayınlanıyorsa, aynı iki değeri o hizmetin
paneline de ekle: **Settings → Environment Variables** benzeri bir sayfada

- `VITE_SUPABASE_URL` = proje adresin
- `VITE_SUPABASE_ANON_KEY` = publishable/anon anahtarın

Kaydettikten sonra siteyi yeniden yayınla (**Redeploy**). GitHub'daki otomatik testler (CI) için hiçbir anahtar
gerekmez; anahtar yokken uygulama tamamen yerel çalışır.

## Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| Users sayfasında kullanıcı yok | `.env.local` adı ve içeriği doğru mu (adım 5)? `npm run dev`'i yeniden başlattın mı (adım 6)? |
| Tarayıcı konsolunda "Anonymous sign-ins are disabled" | Adım 2'yi yap ve **Save changes**'e bas. |
| "relation ... does not exist" / tablo bulunamadı | Adım 3'teki SQL'i çalıştır. |
| Okul modunda yedek yok | Bu bilinçli bir tercih: okul cihazlarında yedekleme kapalı. |
| İnternet yokken | Normal: oyun cihazda kaydeder, bağlantı gelince otomatik yedekler. |

## Bilmen gereken bir sınır

Anonim kimlik de tarayıcıda saklanır. Oyuncu tarayıcı verilerini silerse (veya Safari siteyi 7 gün hiç açılmadığı
için temizlerse) cihaz yeni bir anonim oyuncu olur; eski yedek sunucuda kalır ama o cihazdan otomatik geri gelmez.
Yedeği başka cihaza taşımak ve silmeden sonra geri getirmek için sıradaki adım **"Hesabını bağla" (e-posta)**
özelliğidir; altyapısı hazır, ekranı henüz kapalı (`VITE_ACCOUNT_LINKING=true` ile Hakkında sayfasında
"Yakında" kutusu görünür).
