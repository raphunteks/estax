# Estaka RM-E — PRD & Rencana Besar v5

Tanpa kredensial di dokumen ini. Akun awal dibuat skrip seed dari `.env.local`.

## 0. Perubahan v5 (jawaban final)
- **Data master dinamis oleh superadmin** (bagian 19): poliklinik, jenis bayar (Umum/Mandiri, asuransi swasta, BPJS), jadwal praktik **per dokter**, tarif. Tidak ada yang ditanam di kode.
- **Batal/ubah janji oleh pasien: minimal 1 jam sebelumnya** (angka ini juga bisa diubah superadmin).
- **Mesin jadwal & slot** (bagian 20): anti-dobel-booking, tahan slot sementara, cuti/libur, kuota, pengingat, no-show.
- Fase 0–2 diperbarui mengikuti ini; sisa keputusan tinggal mengisi `.env.local` lalu mulai.

## 0b. Perubahan v4
- **Halaman publik `/masuk` dan `/daftar`** di landing, **reCAPTCHA v2** (checkbox) + penyederhanaan alur (bagian 14).
- **Peta routing lengkap per role** (bagian 15) dan aturan akses di middleware.
- **Prinsip sederhana**: satu pintu masuk untuk semua role, satu shell dashboard, menu menyesuaikan role; tidak ada pemilih role di form.

## 0a. Perubahan v3 (dari jawaban Anda)
- Keputusan final: 2FA (wajib superadmin+dokter, opsional lainnya, bisa diwajibkan per role), Redis Upstash, Vercel Blob untuk foto/rontgen **dan foto profil semua role**, kasir/resepsionis = sub-peran staf, SMTP Gmail.
- **NON = gigi tidak ada** (tidak pernah tumbuh/agenesis), berbeda dari **MIS** = hilang (dicabut/tanggal). Tabel arti kode diperbarui di bagian 8.
- **Pendaftaran pasien mandiri + dibantu staf** mengikuti formulir 3 langkah dari gambar Anda (bagian 9), ditambah email dan perbaikan.
- Fase 0–2 diperinci sebagai PRD (bagian 11): user story, kriteria terima, daftar layar, tes.

## 0b. Perubahan v2 dari v1
1. **Fase 0–2 dikerjakan tuntas** (siap pakai, bukan kerangka).
2. **Upstash Redis** sebagai database (bukan Supabase). RLS tidak ada, jadi RBAC ditegakkan di lapisan server (bagian 3).
3. **Email via Nodemailer + SMTP Gmail** (undangan, verifikasi, reset, pengingat).
4. **Role baru: `pasien`** (portal member) beserta fitur dan izinnya.
5. **Odontogram dikembangkan** dari referensi (bagian 6).
6. **2FA TOTP 6 digit** pada setiap login bagi akun yang mengaktifkannya (bagian 4).

## 1. Stack
Next.js (ada) · Upstash Redis (`@upstash/redis`, sudah terpasang) · auth buatan sendiri: sesi cookie httpOnly + `jose` (JWT), `bcryptjs` (hash kata sandi), `otplib` (TOTP) + QR, `nodemailer` · shadcn/ui + shadcn Charts (Recharts) · GSAP · zod · Vercel (+ **Vercel Blob privat** untuk foto/rontgen, karena Redis tidak untuk berkas).

### Catatan jujur tentang Redis sebagai DB rekam medis
- Cocok untuk MVP satu klinik: cepat, sederhana. Risiko: tidak ada query relasional/agregat, semua indeks dibuat manual (set/sorted set), tidak ada migrasi skema.
- Mitigasi: lapisan repositori tunggal (`lib/db/*`) supaya nanti bisa pindah ke Postgres tanpa ubah UI; **backup harian terjadwal** (ekspor JSON terenkripsi ke Vercel Blob) karena RM wajib awet; analitik memakai agregat harian yang dihitung saat data ditulis.
- Pastikan paket Upstash punya persistence/durabilitas dan kuota cukup (RM + audit log tumbuh terus). **Perlu Anda cek paket dan batasannya.**

## 2. Role
| Role | Dibuat oleh | 2FA TOTP |
|---|---|---|
| `superadmin` | skrip seed (hanya superadmin yang boleh membuat superadmin) | wajib |
| `dokter` (umum/spesialis, spesialisasi, STR/SIP) | superadmin | wajib |
| `staf` (sub-peran: perawat, resepsionis, kasir) | superadmin atau dokter | opsional, dianjurkan |
| `apoteker` (opsional, bisa dimatikan) | superadmin atau dokter | opsional, dianjurkan |
| `pasien` | daftar sendiri (verifikasi email) atau dibuatkan staf | opsional |
Superadmin dapat mewajibkan 2FA untuk role mana pun lewat Pengaturan. Akun dinonaktifkan, tidak dihapus.

## 3. Mesin RBAC (tanpa RLS)
- Semua akses data lewat **satu service layer server** (`lib/db/*` + `can(user, "modul:aksi", resource)`); route/Server Action tidak boleh memanggil Redis langsung (aturan lint/tes).
- Izin berbentuk `modul:aksi`, disimpan di Redis (`rbac:role:<role>` = set izin) dan dapat diubah superadmin. Kepemilikan: pasien hanya `own`, dokter dapat `own` atau `clinic`.
- Cek berlapis: middleware (login + 2FA lolos + role) → service layer (izin + kepemilikan) → hasil disaring per field (staf tidak melihat catatan klinis).
- Setiap baca/tulis data pasien menulis `audit` (siapa, apa, kapan, IP). Superadmin membuka RM = wajib isi alasan.
- Tes otomatis per role untuk setiap endpoint (matriks izin sebagai tes).

## 4. Autentikasi & 2FA (alur)
1. Login email + kata sandi (bcrypt, batas percobaan per IP/akun lewat Upstash Ratelimit, penundaan eksponensial).
2. Jika `totp_enabled`: layar **kode 6 digit** wajib setiap login (jendela ±1 langkah, kode tidak boleh dipakai ulang). Tanpa kode benar, tidak ada sesi.
3. Aktivasi 2FA: scan QR (Google/Microsoft Authenticator), konfirmasi 1 kode, tampilkan **10 kode cadangan** sekali (disimpan sebagai hash). Rahasia TOTP dienkripsi (AES-GCM, kunci dari `.env.local`).
4. Reset 2FA hanya oleh superadmin (dicatat); superadmin lain yang mereset superadmin.
5. Sesi: cookie httpOnly+Secure+SameSite, kedaluwarsa idle 30 menit, bisa dicabut dari daftar perangkat; ganti kata sandi mencabut semua sesi.
6. Undangan: email berisi tautan sekali pakai (berlaku 48 jam) untuk membuat kata sandi; login pertama memaksa ganti kata sandi bila dibuat admin.
7. Email: Nodemailer ke `smtp.gmail.com:465` (SSL) dengan **App Password** (akun Google harus 2-Step Verification). Batas Gmail ± 500 email/hari; cukup untuk satu klinik. Variabel: `SMTP_USER`, `SMTP_APP_PASSWORD`, `MAIL_FROM`.

## 5. Sidebar (kiri) tab > subtab (staf)
Sidebar bisa diciutkan, Ctrl+K pencarian, breadcrumb. Motion GSAP per subtab (transisi halaman, count-up, grafik menggambar, stagger tabel, drawer, centang tergambar, Draggable di kalender). Reduced-motion = cross-fade.
1. **Beranda** — KPI hari ini, area kunjungan 30 hari, bar tindakan, pie pasien baru/lama, radial target bulanan, pengingat.
2. **Pasien** — Daftar · Daftarkan pasien · Profil (ringkasan, timeline, berkas, tagihan).
3. **Pemeriksaan** — Anamnesis & vital · Odontogram · SOAP & diagnosis · Rencana perawatan · Tindakan · Foto/rontgen · Consent · Resep/surat/rujukan.
4. **Janji & Antrian** — Kalender · Permintaan booking web · Antrian hari ini · Pengingat.
5. **Kasir** — Invoice · Pembayaran/cicilan · Tarif tindakan · Laporan.
6. **Farmasi & Stok** — Obat · Bahan/alat · Restock · Opname.
7. **Analitik** — Kunjungan · Pendapatan · Tindakan · Retensi · Waktu tunggu (gauge) · Per dokter · Funnel booking.
8. **Asisten AI** — Dikte SOAP · Perapi catatan · Ringkasan pasien · Balasan WA · Tanya laporan.
9. **Tim & Akses** — Pengguna · Peran & izin · Jadwal praktik · Absensi.
10. **Pengaturan** — Klinik · Template · Integrasi (email, WA, 9Router) · Kebijakan 2FA · Backup · Log audit.
11. **Akun saya** — Profil · Keamanan & 2FA · Sesi · Notifikasi · Tampilan.

## 6. Matriks RBAC (C/R/U/D lunak, — tidak ada, own = milik sendiri)
| Modul | Superadmin | Dokter | Staf | Apoteker | Pasien |
|---|---|---|---|---|---|
| Kelola superadmin | CRUD | — | — | — | — |
| Kelola dokter | CRUD | R, U diri | — | — | — |
| Kelola staf/apoteker | CRUD | CRUD | R/U diri | R/U diri | — |
| Akun pasien | CRUD | R | CRU | — | U own |
| Identitas pasien | CRUD | CRU | CRU | R minimal | R/U own (terbatas) |
| RM klinis | R (alasan, diaudit) | CRU milik sendiri, R dokter lain | R sebagian + anamnesis/vital | — | R ringkasan own |
| Odontogram | R | CRU | R | — | R own (baca saja) |
| Rencana & consent | R | CRU | R, bantu TTD | — | R + setuju/TTD own |
| Resep | R | CRU | R | R + dispensing | R own |
| Foto/rontgen | R | CRU | CR | — | R own (yang dibagikan dokter) |
| Janji & antrian | CRUD | CRU jadwal sendiri | CRUD | R | CR own (booking, batal/ubah sesuai aturan) |
| Kasir | CRUD | R | CRU (void butuh persetujuan) | R | R own + bayar |
| Stok/farmasi | CRUD | R + permintaan | CRU bahan/alat | CRUD obat | — |
| Analitik | Semua | Milik sendiri + agregat klinik | Operasional | Farmasi | — |
| AI | Semua | Semua | Terbatas | Terbatas | Chatbot FAQ saja |
| Pengaturan/Audit | CRUD | R aktivitas sendiri | — | — | Riwayat login sendiri |

## 7. Fitur per role
**Superadmin**: kelola semua akun, izin, kebijakan 2FA; pengaturan klinik, template, integrasi; analitik & keuangan penuh; audit & backup; reset 2FA; retensi data.
**Dokter**: jadwal & antrian sendiri; input RM lengkap; odontogram; dikte AI & ringkasan; resep/rujukan/surat; daftarkan staf/apoteker; analitik pribadi; kontrol ulang.
**Staf**: registrasi pasien, konfirmasi janji, check-in & antrian, anamnesis awal & vital, unggah foto, kasir, stok bahan, balasan WA (draf AI).
**Apoteker**: antrean resep, dispensing & label, cek alergi/interaksi, stok & kedaluwarsa, laporan obat.
**Pasien (portal)**: registrasi + verifikasi email (tautkan ke No. RM oleh staf lewat nama + tgl lahir); booking/ubah/batal janji; lihat jadwal & antrian; riwayat kunjungan ringkas; **odontogram milik sendiri (baca saja)**; resep & instruksi pasca-tindakan; tagihan & bukti bayar; setuju/TTD consent; unduh surat/ringkasan; notifikasi email/WA; edit profil & kontak darurat; keluarga (tautkan anggota); **hak PDP**: unduh data sendiri, ajukan koreksi/penghapusan; keamanan & 2FA; chatbot FAQ.

## 8. Odontogram interaktif (SVG) — referensi + pengembangan
Dari referensi: pilih alat dari palet kategori, klik area gigi untuk menerapkan; baris dewasa dan gigi susu (FDI); swipe horizontal; **teks terjemahan hasil otomatis**; kolom "Gigi/Regio" di tabel tindakan; panduan kode.
- Geometri: tiap gigi = SVG 5 area (O/I, M, D, B/F, L/P); anterior "dasi kupu". Label kode seluruh gigi di atas nomor, penanda segitiga/panah sesuai kode.
- **Pengembangan**: (a) tampilan arch realistis opsional (mode skematis ↔ mode gambar gigi); (b) hover/tooltip nama kode dan arti; (c) zoom per kuadran + minimap di layar kecil; (d) undo/redo, pilih banyak gigi, salin dari kunjungan lalu; (e) **riwayat per kunjungan + mode bandingkan (diff, gigi yang berubah menyala)**; (f) tautan gigi → tindakan/billing otomatis (Gigi/Regio terisi); (g) teks hasil otomatis dwibahasa; (h) ekspor PDF/PNG dan versi pasien yang disederhanakan; (i) animasi GSAP: gigi pop saat terisi, ripple status, transisi antar versi; (j) keyboard + ARIA; (k) gigi susu otomatis disarankan menurut usia (hanya saran, dokter yang memutuskan).
- Data: `odo:<visit>` hash `tooth:surface → code`, versi riwayat append-only; kode divalidasi zod.
- **Arti kode (NON sudah dikonfirmasi; sisanya dugaan dari singkatan umum, mohon koreksi bila ada yang beda)**: SOU sehat · NON gigi tidak ada (tidak pernah tumbuh) · UNE belum erupsi · PRE erupsi sebagian · IMV impaksi · ANO anomali · DIA diastema · ATT atrisi · ABR abrasi · CFR fraktur mahkota · NVT non-vital · RRX sisa akar · MIS hilang · CAR karies · AMF amalgam · GIF glass ionomer · COF komposit · FIS fissure sealant · INL inlay · ONL onlay · FMC full metal crown · POC porcelain crown · MPC metal-porcelain crown · GMC gold metal crown · RCT perawatan saluran akar · IPX implan · MEB bridge logam · POB bridge porselen · PON pontik · ABU abutment · PRD gigi tiruan sebagian lepasan · FLD gigi tiruan penuh · ACR akrilik. **Mohon dikoreksi.**

## 9. Pendaftaran pasien (mandiri atau dibantu staf)
Mengikuti gambar Anda: **wizard 3 langkah** dengan indikator langkah, validasi per langkah, simpan draf otomatis, bisa kembali. Pasien mandiri membuat akun sekaligus; staf mendaftarkan atas nama pasien dengan formulir yang sama.

**Langkah 1 — Informasi Pasien & Reservasi**
- Identitas (WNI/WNA) → WNI: **NIK 16 digit** (validasi format + checksum tanggal lahir); WNA: nomor paspor.
- Nama lengkap, **email** (wajib untuk akun mandiri; verifikasi), jenis kelamin, tempat lahir (pilihan kota dengan pencarian), **tanggal lahir lewat kalender** (pemilih tanggal, bisa ketik; menghitung umur otomatis dan menandai pasien anak/lansia → memunculkan wali), No HP (WhatsApp, normalisasi ke +62), alamat singkat.
- **Reservasi**: tanggal (kalender hanya hari buka), poliklinik (Dokter Gigi Umum / Spesialis Konservasi), pilihan dokter (opsional), jam kosong, jenis bayar (Umum/Mandiri, asuransi swasta; **BPJS hanya bila klinik terdaftar** — tanya Anda), keluhan utama singkat.
- Tautan "Sudah punya rekam medis? Reservasi" → masuk dengan No. RM + tanggal lahir (atau login) tanpa mengisi ulang.
**Langkah 2 — Informasi Alamat**: provinsi → kabupaten/kota → kecamatan → kelurahan (berjenjang, dataset wilayah; paket dipilih dan diverifikasi saat implementasi), RT/RW, kode pos, alamat lengkap, patokan, tautan peta opsional.
**Langkah 3 — Informasi Tambahan & Kesehatan**: pekerjaan, golongan darah, status menikah (opsional), **alergi** (obat/lateks/makanan), penyakit sistemik (diabetes, hipertensi, jantung, gangguan perdarahan/hemofilia, hepatitis, asma, lainnya), obat rutin, hamil/menyusui (bila relevan), merokok, kontak darurat/wali (nama, hubungan, HP), **persetujuan pengolahan data (UU PDP)** dan persetujuan hubungi via WhatsApp/email (terpisah, tidak dicentang otomatis).
**Perbaikan dari saya**: NIK dienkripsi per-field, tidak ditampilkan penuh (mis. 7371••••••••1234) kecuali izin khusus dan tercatat audit; deteksi duplikat (NIK, atau nama+tgl lahir+HP) sebelum membuat pasien baru; honeypot + rate limit (Cloudflare Turnstile opsional); teks pertanyaan kesehatan jelas dan opsional bila perlu (pasien bisa "isi saat datang"); layar sukses dengan ringkasan janji + tambah ke kalender; input besar dan ramah HP.
**Status**: pendaftaran mandiri = pasien *belum terverifikasi* → email verifikasi → staf mencocokkan identitas saat datang (cek KTP) → **No. RM diterbitkan** → akun terhubung ke RM. Pasien yang didaftarkan staf langsung terverifikasi dan menerima undangan akun lewat email.

## 10. Berkas & foto (Vercel Blob privat)
- Foto profil semua role; foto klinis, rontgen, dokumen (consent, surat).
- Tipe: JPG/PNG/WebP/PDF (DICOM ditunda). Batas ukuran, validasi isi file (bukan hanya ekstensi), EXIF/lokasi dibuang, kompres di browser, pratinjau, versi thumbnail.
- Akses lewat URL bertanda tangan berumur pendek yang dibuat server setelah cek izin (`can()`); tidak ada URL publik. Nama file diacak; metadata di Redis; foto profil boleh diunggah sendiri oleh tiap role, foto klinis hanya role klinis.
- Pasien hanya melihat berkas yang dibagikan dokter.

## 9b. Model data Redis (garis besar)
Kunci berawalan `clinic:<id>:`. `user:<id>` (hash: role, hash sandi, totp terenkripsi, status) · `user:email:<email>` (indeks) · `session:<id>` (TTL) · `invite:<token>` (TTL 48 jam) · `patient:<id>` + `patient:norm:<no>` + `patients:idx` (sorted set) + indeks nama/telepon (token n-gram) · `visit:<id>` · `odo:<visit>` · `soap:<visit>` · `plan:<id>` · `appt:<id>` + `appts:<dokter>:<tanggal>` (sorted set) · `queue:<tanggal>` · `inv:<id>` · `stock:<id>` · `rbac:role:<role>` · `audit:<tanggal>` (stream/list, append-only) · agregat `stat:<yyyymmdd>:*`. Berkas medis di Vercel Blob privat, kunci disimpan di Redis, URL bertanda tangan umur pendek. Data klinis dienkripsi level-field untuk bidang sensitif.

## 11. PRD Fase 0–2 (tuntas, siap pakai; menyertakan data master bagian 19 dan mesin jadwal bagian 20)
Tiap item: *user story → kriteria terima*. Semua layar punya state kosong/memuat/galat, mode terang/gelap, dwibahasa (ID/EN), keyboard + ARIA, motion GSAP dengan reduced-motion.

### Fase 0 — Fondasi & autentikasi
Layar: **/masuk, /daftar (+reCAPTCHA v2), /lupa-sandi**, Login · Kode TOTP · Lupa/atur sandi · Aktivasi 2FA (QR + kode cadangan) · Layout dashboard (sidebar kiri, Ctrl+K, tema, bahasa) · Akun saya (profil + foto profil, keamanan, sesi, notifikasi).
- Sebagai pengguna, saya login dengan email+sandi, lalu kode 6 digit bila 2FA aktif → *tanpa kode benar tidak ada sesi; kode tidak bisa dipakai ulang; 5 gagal = kunci sementara*.
- Sebagai superadmin, saya mewajibkan 2FA per role → *akun role itu dipaksa aktivasi sebelum masuk dashboard*.
- Sebagai pengguna, saya menerima email undangan/reset (Nodemailer) → *tautan sekali pakai, kedaluwarsa, terkirim dari `MAIL_FROM`*.
- Seed 2 superadmin dari env → *login pertama memaksa ganti sandi + aktivasi 2FA*.
- Audit login/logout/gagal → *tercatat tak dapat diubah*.
Teknis: `lib/db/*`, `can()`, sesi `jose`, ratelimit Upstash, enkripsi AES-GCM, tes keamanan.

### Fase 1 — Tim & Akses + RBAC + portal pasien (kerangka)
Layar: Pengguna (daftar, undang, nonaktifkan, reset 2FA) · Peran & izin (editor matriks) · Jadwal praktik dokter · Dashboard pasien (kerangka: profil, keamanan, foto).
- Superadmin membuat dokter; dokter/superadmin membuat staf (sub-peran perawat/resepsionis/kasir) & apoteker → *hierarki dipatuhi; dokter tidak bisa membuat dokter/superadmin*.
- Menu dan data mengikuti role → *tes otomatis: setiap endpoint × setiap role (matriks izin) lulus; pelanggaran ditolak 403 dan diaudit*.
- Nonaktifkan akun → *sesi dicabut seketika, data tetap*.
- Pasien daftar mandiri (langkah 1–3) dan verifikasi email → *akun dibuat status "belum terverifikasi"*.

### Fase 2 — Pasien, Janji & Antrian + Beranda
Layar: Daftar pasien (cari nama/NIK/HP/No RM) · Wizard pendaftaran (mandiri/staf) · Profil pasien (ringkasan, timeline, berkas, tagihan ringkas) · Verifikasi & penerbitan No. RM · Data master (poliklinik, jenis bayar, jadwal dokter, aturan janji) · Kalender per dokter · Permintaan booking · Antrian hari ini · Booking portal pasien · Beranda (KPI + grafik shadcn).
- Staf mendaftarkan pasien → *deteksi duplikat; No. RM otomatis berurutan; undangan akun terkirim*.
- Pasien booking di web/portal → *muncul di Permintaan; staf terima/tolak/ubah; pasien dapat email; slot tidak dobel*.
- Staf drag-reschedule di kalender → *validasi jam praktik; notifikasi ke pasien*.
- Check-in → antrian (menunggu → dipanggil → di kursi → selesai) → *waktu tunggu terukur untuk gauge analitik*.
- Pasien melihat janji, membatalkan/ubah sesuai aturan (≥ 1 jam sebelumnya, dapat diatur superadmin) → *tercatat*.
- Beranda: kunjungan 30 hari (area), tindakan (bar), pasien baru/lama (pie), target bulanan (radial) → *dari data nyata, bukan contoh*.
**Definisi selesai Fase 0–2**: tsc, eslint, build lulus; tes Playwright alur "daftar → verifikasi → booking → konfirmasi → check-in → antrian → selesai" per role; viewport 360/768/1280/1920; reduced-motion; tidak ada error konsol; laporan jujur hal yang belum terverifikasi (mis. pengiriman Gmail asli dan Upstash produksi).

Fase 3 Pemeriksaan & odontogram → 4 Kasir/Farmasi → 5 Analitik penuh → 6 AI → 7 Hardening.

## 14. Halaman `/masuk` dan `/daftar` (landing)
**Keputusan desain (lebih sederhana dan lebih aman):**
- **Satu form `/masuk` untuk kelima role.** Role ditentukan oleh akun, bukan pilihan pengguna (pemilih role di form membuka celah dan membingungkan). Setelah login, sistem mengarahkan sesuai role (bagian 15).
- **`/daftar` hanya untuk pasien.** Superadmin, dokter, staf, apoteker dibuat lewat undangan (tidak boleh daftar sendiri), jadi halaman daftar tidak menampilkan role lain. Orang klinik yang belum punya akun diberi petunjuk "hubungi admin klinik".
- Tombol "Masuk" dan "Daftar" ditambahkan di nav landing; bila sudah login tampil "Dashboard".

**Alur `/masuk`:** email + sandi → reCAPTCHA → (jika 2FA aktif) kode 6 digit → redirect role. Tautan "Lupa sandi", "Daftar sebagai pasien". Pesan galat netral ("email atau sandi salah") agar akun tidak bisa ditebak. Tampilan sama gaya landing (gelap/terang, GSAP halus, logo Estaka).
**Alur `/daftar`:** wizard 3 langkah (bagian 9) + reCAPTCHA di langkah terakhir sebelum kirim → verifikasi email → login.
**reCAPTCHA v2 (checkbox):** dipasang di `/masuk`, `/daftar`, lupa sandi, dan form booking publik. Token **diverifikasi di server** ke `https://www.google.com/recaptcha/api/siteverify` dengan secret key (tidak pernah di browser); gagal = ditolak (fail-closed). Dilengkapi ratelimit Upstash dan honeypot sebagai lapis kedua. Kunci dibuat di konsol reCAPTCHA (jenis v2 checkbox; daftarkan domain produksi dan `localhost`). Env: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`. Catatan: reCAPTCHA memuat skrip Google (perlu dicantumkan di kebijakan privasi) dan CSP perlu mengizinkan `google.com/recaptcha` serta `gstatic.com`.

## 15. Peta routing per role (RBAC)
Aturan: middleware memeriksa **sesi → 2FA lolos → role → izin rute**; tanpa sesi → `/masuk?next=…`; role tidak berhak → `/tidak-berwenang` (403) dan diaudit. Setelah login: superadmin/dokter/staf → `/dashboard`, apoteker → `/dashboard/farmasi`, pasien → `/portal`.

| Rute | Super­admin | Dokter | Staf | Apoteker | Pasien |
|---|:-:|:-:|:-:|:-:|:-:|
| `/` landing, `/masuk`, `/daftar`, `/lupa-sandi`, `/atur-sandi/[token]` | publik | publik | publik | publik | publik |
| `/dashboard` (Beranda) | ✓ | ✓ | ✓ | ✓ (ringkas) | — |
| `/dashboard/pasien`, `/pasien/baru`, `/pasien/[id]` | ✓ | ✓ | ✓ | — | — |
| `/dashboard/pasien/[id]/verifikasi` | ✓ | — | ✓ | — | — |
| `/dashboard/janji`, `/janji/kalender`, `/janji/permintaan`, `/janji/antrian` | ✓ | ✓ (milik sendiri) | ✓ | — | — |
| `/dashboard/periksa/[kunjungan]` (anamnesis, odontogram, SOAP, rencana, tindakan, berkas, consent, resep) — *Fase 3* | R (alasan) | ✓ | R sebagian | — | — |
| `/dashboard/kasir` — *Fase 4* | ✓ | R | ✓ | R | — |
| `/dashboard/farmasi` — *Fase 4* | ✓ | R | ✓ bahan/alat | ✓ | — |
| `/dashboard/analitik` — *Fase 5* | ✓ | ✓ (terbatas) | ✓ (operasional) | ✓ (farmasi) | — |
| `/dashboard/ai` — *Fase 6* | ✓ | ✓ | terbatas | terbatas | — |
| `/dashboard/tim` (pengguna, peran & izin, jadwal praktik, absensi) | ✓ | ✓ (staf/apoteker) | — | — | — |
| `/dashboard/pengaturan` (klinik, template, integrasi, kebijakan 2FA, backup) | ✓ | R | — | — | — |
| `/dashboard/audit` | ✓ | R sendiri | — | — | — |
| `/dashboard/akun` (profil+foto, keamanan/2FA, sesi, notifikasi, tampilan) | ✓ | ✓ | ✓ | ✓ | — |
| `/portal` (beranda pasien: janji berikutnya, ringkasan) | — | — | — | — | ✓ |
| `/portal/janji` (lihat, booking, ubah, batal) | — | — | — | — | ✓ |
| `/portal/riwayat` (kunjungan ringkas, odontogram baca saja) — *Fase 3* | — | — | — | — | ✓ |
| `/portal/resep`, `/portal/tagihan`, `/portal/berkas`, `/portal/consent` — *Fase 3–4* | — | — | — | — | ✓ |
| `/portal/keluarga`, `/portal/data-saya` (unduh/koreksi/hapus, hak PDP) | — | — | — | — | ✓ |
| `/portal/akun` (profil+foto, keamanan/2FA, sesi, notifikasi) | — | — | — | — | ✓ |
| `/api/*` | tiap handler memanggil `can()`; tidak ada akses Redis langsung |
Sidebar dibangun dari tabel ini (satu sumber: `lib/routes.ts` berisi rute → izin), sehingga menu, middleware, dan tes otomatis memakai data yang sama. Fase 0–2 mengaktifkan semua rute bertanda tanpa catatan fase; sisanya muncul sebagai "segera hadir" untuk role yang berhak.

## 16. Penyederhanaan (rekomendasi saya)
1. Satu login, satu shell dashboard, menu otomatis per role.
2. Dua status pasien saja: *belum terverifikasi* dan *terverifikasi* (punya No. RM).
3. Dua sub-peran staf pada awalnya: *klinis* (perawat) dan *administrasi* (resepsionis/kasir); dapat dipecah nanti.
4. Apoteker bisa dimatikan lewat satu saklar di Pengaturan; bila mati, menunya hilang dan resep hanya tercetak.
5. Pengaturan awal lewat satu halaman "Setup klinik" saat superadmin pertama login (nama, jam praktik, poliklinik, jenis bayar).
6. Kebijakan 2FA bawaan sudah diset (wajib superadmin+dokter), tidak perlu diatur dulu.

## 19. Data master (dikelola superadmin, `/dashboard/pengaturan/master`)
| Master | Isi | Catatan |
|---|---|---|
| Poliklinik | nama, aktif/nonaktif, dokter yang bertugas, warna kalender | awal: Dokter Gigi Umum, Spesialis Konservasi; superadmin dapat menambah (mis. Ortodonti) kapan saja; poliklinik baru langsung muncul di form daftar/booking |
| Dokter | profil, spesialisasi, STR/SIP (+masa berlaku), poliklinik, foto | status aktif/cuti |
| Jenis bayar | Umum/Mandiri, asuransi swasta (daftar nama asuransi), BPJS | aktif/nonaktif per item; **BPJS hanya aktifkan bila klinik benar-benar bekerja sama**; asuransi/BPJS meminta nomor kepesertaan di form |
| Jadwal praktik per dokter | lihat bawah | hanya superadmin yang mengubah; dokter hanya melihat |
| Tarif tindakan | nama, kode, harga, per poliklinik | dipakai kasir (Fase 4) |
| Aturan janji | batas batal/ubah (default **1 jam**), maksimal booking aktif per pasien, jeda antar slot, horizon booking (default 14 hari) | |
**Jadwal praktik per dokter**: per hari (Senin–Minggu) satu atau lebih **sesi** (mis. 09.00–12.00 dan 13.00–16.00), durasi slot (mis. 30/45/60 menit, bisa berbeda per dokter dan per poliklinik), kuota per sesi opsional; **pengecualian per tanggal** (libur, cuti, jam khusus, sesi tambahan) dan salinan jadwal ke dokter lain. Perubahan jadwal tidak membatalkan janji yang ada: janji yang bentrok ditandai "perlu diatur ulang" dan staf mendapat daftarnya, pasien diberi tahu lewat email.

## 20. Mesin jadwal & slot
- Zona waktu **Asia/Makassar**; slot dihasilkan dari jadwal dokter dikurangi janji, cuti, dan jeda.
- **Anti-dobel**: pembuatan janji memakai kunci atomik Redis (`SET NX` / skrip Lua) per dokter+slot; dua pasien tidak bisa mengambil slot yang sama.
- **Tahan sementara**: slot yang sedang diisi pasien ditahan 5 menit (TTL), lalu dilepas otomatis.
- **Aturan batal/ubah**: pasien bisa sampai **1 jam sebelum** jam janji; lewat itu tombolnya nonaktif dan diarahkan menghubungi klinik via WhatsApp. Staf/superadmin bisa mengubah kapan saja.
- **Status janji**: menunggu konfirmasi → dikonfirmasi → check-in → selesai; cabang: dibatalkan pasien/klinik, **tidak hadir (no-show)**, perlu diatur ulang.
- **Pengingat email**: H-1 dan 2 jam sebelum (waktu dapat diatur); tautan konfirmasi/batal satu klik berlaku sampai batas 1 jam.
- **Daftar tunggu**: bila slot penuh, pasien bisa masuk daftar tunggu; slot yang batal ditawarkan ke yang pertama (usulan, boleh ditunda ke fase berikutnya).
- Booking dari web publik dan portal memakai mesin yang sama dengan kalender staf.

## 21. Keamanan & kepatuhan
HTTPS wajib; cookie httpOnly; rate limit login/OTP/undangan; hash bcrypt; rahasia TOTP terenkripsi; audit tak dapat diubah; backup harian; retensi RM sesuai Permenkes RM (**mohon dikonfirmasi ke regulasi terkini**); UU PDP (persetujuan, akses, koreksi, insiden). AI: identitas dibuang, hanya draf. **Endpoint 9Router masih HTTP; pasang HTTPS sebelum data pasien dikirim.** Kata sandi akun awal yang pernah ditulis di chat dianggap bocor; seed akan memaksa ganti kata sandi saat login pertama, dan kata sandi tidak disimpan di repositori.

## 22. Status keputusan
Sudah final: 2FA, Upstash Redis, Vercel Blob, SMTP Gmail, reCAPTCHA v2, pendaftaran pasien mandiri/dibantu, sub-peran staf, jenis bayar (semua, dinamis), batal ≥ 1 jam, jadwal per dokter oleh superadmin, poliklinik dinamis.
Tinggal dari Anda:
1. Isi `.env.local` sendiri: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `MAIL_FROM`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `SEED_SUPERADMIN_*` (jangan kirim ke chat).
2. Ucapkan "mulai": saya kerjakan Fase 0 → 2 berurutan, lapor tiap fase.

## 23. Status pengerjaan
- **Fase 0 selesai** (auth, 2FA, sesi, akun saya, audit).
- **Fase 1 selesai**: Tim & Akses (undang, nonaktifkan, reset 2FA, hierarki), matriks peran (hanya lihat; izin tetap di kode agar teruji), jadwal praktik per dokter, Pengaturan (kebijakan 2FA, poliklinik, jenis bayar, aturan janji), `/daftar` 3 langkah + verifikasi email, portal pasien (ringkasan, akun, foto profil).
- Catatan Fase 1: wilayah (provinsi→kelurahan) masih isian teks; dataset berjenjang dan blok "Reservasi" di langkah 1 menyusul di Fase 2 bersama mesin slot.

### Status Fase 2 (Pasien, Janji & Antrian + Beranda) — selesai 2026-11-06
- Pasien: daftar/cari (nama, RM, NIK-hash, telepon), profil, verifikasi + nomor RM, wizard registrasi staf dengan deteksi duplikat.
- Janji: slot atomik (SET NX) + hold 5 menit, kalender per dokter (drag-reschedule), permintaan booking, antrian hari ini, booking portal, aturan batal/ubah ≥ N jam.
- Beranda: KPI + grafik dari data nyata.
- Verifikasi: tsc 0 error, eslint 0 error, build lulus, API f2 ALL PASS, UI f2ui ALL PASS (360px, reduced-motion, 0 error konsol).
- Belum terverifikasi: Upstash/SMTP/reCAPTCHA/Blob asli, drag mouse/sentuh asli (fallback tombol "Ubah jadwal"), UI tanggal cuti di kartu jadwal tim, dataset wilayah, rute publik /api/booking & /admin lama masih ada.

### Status Fase 3 (Pemeriksaan & odontogram) — inti selesai 2026-11-06
- Kunjungan per janji (`visit:<id>`, satu per janji, idempoten): anamnesis + tanda vital (staf boleh), SOAP, rencana, tindakan, resep, odontogram (hanya dokter pemilik). Selesai = terkunci, janji ikut ditutup.
- Odontogram SVG FDI (dewasa/susu), 5 permukaan, 32 kode, undo/redo, bandingkan dengan kunjungan lalu, teks hasil otomatis, form tanpa-klik untuk keyboard, riwayat versi append-only (`odo:<visit>:log`).
- Akses: dokter penuh (milik sendiri), staf dasar, superadmin wajib alasan (diaudit), apoteker/pasien ditolak. Portal pasien `/portal/riwayat`: tindakan, rencana, resep, odontogram baca saja (tanpa SOAP).
- Belum: unggah foto/rontgen (butuh token Vercel Blob), consent/TTD, ekspor PDF, tautan tindakan → kasir (Fase 4), arch realistis, dikte AI (Fase 6). Arti kode odontogram selain NON masih dugaan, mohon dikoreksi.

### Tema warna & Lighthouse (2026-11-06)
- Pemilih tema: Ikut Jam (WITA: 05–09 Sunrise, 09–15 Siang, 15–18 Aren, sisanya Malam) + Siang, Malam, Aren, Pandan, Sunrise. Token di `globals.css`, logika di `lib/theme.ts`, UI di `components/ThemeMenu.tsx`. Tidak ada hitam murni.
- Lighthouse mobile (build produksi lokal): Aksesibilitas 100, Best Practices 100, SEO 100. Performa beranda ±76–82 di sandbox (TBT dari hidrasi), halaman auth 81–97. Ukur ulang di PageSpeed Insights setelah deploy.
- Agentic: `public/llms.txt`, `.well-known/ard.json`, `.well-known/agent-skills/estaka/SKILL.md` (dibuat oleh `npm run gen:agent` dari `lib/content.ts`), WebMCP tools read-only (`lib/webmcp.ts`).

## Status: Sidebar, Konten Situs, Pengingat WA, Logo
- Sidebar dashboard: accordion tab > subtab, toggle di header (kanan logo), mode rail ikon (logo, toggle, ikon, avatar), item aktif terisi. Item terkunci = gerbang login pertama (ganti sandi awal + 2FA wajib superadmin/dokter); setelah itu semua menu sesuai role terbuka. Kasir/Farmasi/Analitik/AI (Fase 4-6) membuka halaman placeholder.
- `/dashboard/situs` (superadmin, perm `site:manage`): Tim, Hasil perawatan (before/after), Testimoni, Peta & kontak, Pengingat WhatsApp. Landing (ISR 60 dtk) menampilkan Tim/Hasil/Testimoni hanya bila terisi; peta Google Maps embed tanpa API key (berbasis alamat).
- Pengingat WA: tab "Pengingat" di Janji & Antrian (staf/superadmin) membuat tautan wa.me berisi templat terisi untuk janji dikonfirmasi dalam N jam. Pengiriman otomatis butuh penyedia WA API berbayar (belum ada).
- Logo baru: `components/Logo.tsx`, `public/brand/estaka-mark.svg`, `app/icon.svg`, `app/apple-icon.png`.

### Status Fase 4 (Kasir, Farmasi, pengingat) — 2026-11-06
- **Kasir** `/dashboard/kasir`: invoice dibuat otomatis saat dokter menyelesaikan kunjungan (tindakan dicocokkan ke tarif; yang tidak cocok Rp0 untuk diisi kasir), item/diskon bisa diubah selama belum ada pembayaran, pembayaran bertahap (tunai/transfer/QRIS/debit/asuransi/BPJS) dengan kunci per-invoice agar tidak lebih bayar, pembatalan: staf mengajukan → superadmin menyetujui (hanya bila belum ada pembayaran), cetak, tarif tindakan (hanya superadmin yang mengubah), laporan 30 hari. Pasien: `/portal/tagihan` (baca saja). Dokter/apoteker hanya baca.
- **Farmasi** `/dashboard/farmasi`: item obat/bahan/alat, batch + kedaluwarsa, restock, opname, minimum stok, riwayat mutasi. Resep dari kunjungan masuk antrean apoteker; penyerahan memakai FEFO, batch kedaluwarsa tidak diserahkan, peringatan alergi (pencocokan kata, wajib konfirmasi). Staf hanya boleh bahan/alat; superadmin dapat menyerahkan bila tidak ada apoteker.
- **Pengiriman WhatsApp otomatis** lewat webhook Hermes Agent (`lib/notify/hermes.ts`): HMAC "Generic V2" (`X-Webhook-Timestamp` + `X-Webhook-Signature-V2`), payload `{event_type, id, phone, chat_id, text}`. Rute Hermes (`config.yaml`, `platforms.webhook.extra.routes.reminder`): `secret`, `deliver: whatsapp`, `deliver_only: true`, `prompt: "{text}"`, `deliver_extra.chat_id: "{chat_id}"`. `.env.local`: `HERMES_WEBHOOK_URL` (https di produksi), `HERMES_WEBHOOK_SECRET`, opsional `HERMES_WA_CHAT_SUFFIX`.
- **Pengingat otomatis** `GET /api/cron/reminders` (header `Authorization: Bearer $CRON_SECRET`): email H-1 dan 2 jam sebelum, WhatsApp pada N jam sebelum (Konten Situs), masing-masing sekali per janji. Jalankan tiap 10–15 menit: Vercel Cron (Pro) atau penjadwal luar (mis. cron-job.org dengan header di atas). Hobby Vercel hanya mengizinkan cron harian, jadi `vercel.json` sengaja tidak dibuat.
- Verifikasi: `scripts` f4 (48 cek API: RBAC, HMAC Hermes tiruan, idempoten, tarif, bayar/cicil/lunas, void, FEFO, alergi, opname), UI kasir/farmasi 360 px dan desktop. Belum: Hermes nyata, SMTP nyata, `/portal/resep`, e-resi PDF.

### Status Fase 5 (Analitik) — 2026-11-06
- `/dashboard/analitik` + `GET /api/analytics?days=7|30|90`, dihitung dari janji, kunjungan, invoice, dan mutasi stok (angka nyata, tanpa data tiruan). Tab: Kunjungan (tren, hari, jam), Pendapatan (kas harian, tagihan, piutang, metode), Tindakan (10 teratas), Retensi (baru vs kembali, jarak kunjungan), Waktu tunggu (gauge dilayani ≤ 20 menit, median, P90, di kursi), Per dokter, Funnel booking (dibuat → konfirmasi → hadir → selesai, pembatalan, tidak hadir), Farmasi.
- Cakupan per role (dipaksa di server): superadmin semua; dokter hanya pasien sendiri (termasuk pendapatan sendiri, tanpa tab Per dokter/Farmasi); staf operasional saja (tanpa pendapatan dan farmasi, kolom kas per dokter disembunyikan); apoteker hanya Farmasi.
- Verifikasi: 18 cek (angka cocok dengan data uji, cakupan per role, 400/401), UI 8 tab di desktop dan 360 px tanpa error konsol atau overflow. Catatan: "obat terbanyak diserahkan" dibaca dari 200 mutasi stok terakhir.

## Fase 6 — Asisten AI (status)

Selesai: `/dashboard/ai` (Dikte & catatan, Ringkasan pasien, Balasan WhatsApp, Tanya laporan) dan `/portal/tanya` (FAQ pasien).
- Akses per peran di server (`TOOLS` di `lib/clinic/ai-tools.ts`): superadmin semua; dokter soap/tidy/summary/wa/report; staf wa/report; apoteker report; pasien hanya FAQ.
- Identitas dibuang sebelum kirim (`lib/ai-redact.ts`): nama (bila kunjungan dipilih), email, NIK, telepon, No RM, tanggal. Ringkasan memakai digest tanpa identitas.
- Hanya draf; AI tidak membuat diagnosis/resep. Hasil SOAP bisa ditambahkan ke SOAP kunjungan berjalan (`GET /api/visits?mine=1` + PATCH).
- Ringkasan oleh superadmin wajib alasan (audit `ai.summary.access`). Audit hanya mencatat jumlah karakter, bukan isi. Rate limit 40/jam (FAQ 15/jam).
- Dikte: MediaRecorder -> `/api/ai/transcribe` (audio tidak disimpan). Model STT dari `NINEROUTER_STT_MODEL` atau `GET /models/stt`.
- Guard transport: produksi menolak endpoint HTTP kecuali `AI_ALLOW_INSECURE_HTTP=1`.
Diuji dengan mock server OpenAI-compatible (46 cek). Belum diuji ke 9Router asli (diblokir dari sandbox).

## Fase 7 — Hardening & cadangan (status)

- Cadangan terenkripsi (AES-256-GCM, ENCRYPTION_KEY): `GET /api/admin/backup`, pulihkan lewat `POST /api/admin/restore` (mode check/apply, wajib ketik PULIHKAN). Superadmin saja, rate limit, diaudit. Sesi, rate limit, lock, dan token sekali pakai tidak ikut. UI: Pengaturan > Cadangan.
- Header: HSTS, COOP, Permissions-Policy `microphone=(self)` (izin mikrofon untuk dikte; sebelumnya diblokir).
- Belum: CSP ketat (butuh nonce), jadwal cadangan otomatis, uji dump/restore di Upstash asli.
- Landing: slider dokter di-pin saat scroll (desktop >=1024px), tablet/mobile tetap geser.

## Landing: rute per section & SEO (status)
- Halaman server-rendered: `/dokter`, `/layanan`, `/teknologi`, `/biaya`, `/faq`, `/lokasi`, `/reservasi` (`components/SectionPage.tsx`, `lib/seo.ts`). Anchor `#booking` diganti `#reservasi`.
- Tiap halaman: title/description unik, canonical, OG + Twitter (+ `app/opengraph-image.tsx`), h1, JSON-LD (Dentist, BreadcrumbList, FAQPage, Physician), sitemap 9 URL, link internal di footer.
- Peta: embed dikelola superadmin (Konten Situs > Embed Google Maps); bawaan = embed klinik; ukuran dikecilkan.

## Fase 8 — Reservasi publik terhubung RM-E (status)
- Form landing/`/reservasi`: tab Pasien Baru (NIK, nama, tgl lahir, JK, WA, alamat, alergi, keluhan) dan Pasien Lama (NIK/No RM + tgl lahir + 4 digit HP). Dokter dinamis dari DB (`/api/public/doctors`), jam dari jadwal asli (`/api/public/slots`, "dokter mana saja" didukung).
- `POST /api/public/reserve` membuat janji berstatus `menunggu` (source `web`); pasien baru dibuat tanpa No RM (terverifikasi saat check-in). NIK/nama+lahir+HP yang sudah ada dipakai ulang (tanpa duplikat, tanpa membuka data). Rate limit per IP, per NIK, per nomor HP; honeypot; nama disamarkan di hasil pencarian.
- Dihapus: `POST /api/booking` lama. `/api/booking/options` (dashboard) tetap.
- Belum: penahan slot (hold) saat mengisi form (slot dijamin atomik saat kirim), teks bahasa Inggris untuk label form baru, pilihan jenis bayar (default umum).

## Landing: routing dinamis, dokter dari DB, konsol bersih (status)
- Home: URL mengikuti section saat scroll (`/dokter`, `/layanan`, `/teknologi`, `/biaya`, `/faq`, `/lokasi`, `/reservasi`; atas = `/`) tanpa hash; klik menu/CTA menggulir tanpa reload (`components/Global.tsx`). Reload di URL itu membuka halaman section SSR.
- Dokter di formulir reservasi = akun dokter di DB + jadwal. Dashboard > Tim & Akses > Jadwal praktik > "Impor dokter dari profil situs" membuat akun dan jadwal awal untuk dokter yang tampil di situs.
- Konsol: tidak ada warning GSAP (section kosong tidak lagi membuat target/scope; `rotationX/Y`; guard SplitText). GSAP 3.15.1 = versi terbaru.
- Semua section bergerak saat scroll di semua ukuran layar (scrub), termasuk mobile.

## Status: perbaikan UI (DevTools, kartu dokter, scroll mobile, sidebar)
- Semua `input/select/textarea` kini punya `id`/`name` (Booking, kit `Input`/`Select` via `useId`, Settings, SiteAdmin, Team, Exam, Account, RegisterWizard). Alamat memakai `autocomplete="address-line1"`.
- Sidebar dashboard hilang: style inline `translate` dari drawer mobile tertinggal saat layar melebar → `Shell.tsx` kini membersihkannya lewat `matchMedia(min-width:1024px)`.
- Kartu dokter menutupi wajah: GSAP mem-bake CSS `translate` (-50%) ke transform inline yang tertinggal saat breakpoint berubah → slide dipusatkan via `xPercent:-50`, `.cs-info`/`.cs-hud` tanpa translate CSS.
- Slider dokter kini di-pin (scroll-driven) juga di mobile/tablet (varian `mpin`, tinggi layar ≥ 620px, motion diizinkan); kartu ringkas di mobile.

## Status: AI & kecepatan dashboard
- Dikte: `useDictate` (shared), STT mencoba beberapa model dari `/models/stt`, nama berkas sesuai format rekaman, galat 9Router dipetakan ke pesan penyebab (key, model, jangkauan jaringan). Log server mencatat status+cuplikan galat hulu.
- Superadmin: tab "Cek koneksi" (`POST /api/ai`) menguji chat + daftar model STT tanpa data pasien.
- Pemeriksaan > tab SOAP: panel AI (dikte→SOAP lalu "Tambahkan ke SOAP", ringkas riwayat, pesan pasca perawatan `/api/ai/edu`) + daftar kelengkapan catatan (tanpa AI).
- `GET /api/visits?mine=1` tidak lagi 400 untuk superadmin/staf; `data-scroll-behavior="smooth"` di `<html>`.
- Kecepatan: `getAuth` memakai `cache()`, `app/dashboard/loading.tsx`, cache GET 5 dtk di `api()` (dibersihkan saat tulis), cek 2FA hanya bila perlu.

## Status: ICD-10, SOAP AI tangguh, peringatan console
- ICD-10: `lib/clinic/icd10.ts` (+ seed ±140 kode gigi & mulut WHO 2019 dengan label Indonesia) tersimpan di database (`icd10:meta`, `icd10:c:N`), pencarian `GET /api/icd?q=`, impor daftar lengkap WHO oleh superadmin (Pengaturan > ICD-10, berkas `icd102019syst_codes.txt`). Visit punya `diagnoses[]` (kode divalidasi server, judul dinormalisasi); picker di Pemeriksaan > SOAP; masuk ke daftar kelengkapan, ringkasan AI, dan pesan pasca perawatan.
- SOAP AI: parser toleran (JSON/kunci panjang/baris S: O: A: P:), retry sekali, token 2500, fallback `reasoning_content`; log server mencatat cuplikan balasan tak terbaca. Cek koneksi kini 4 langkah (chat, model STT, unggah STT, format SOAP).
- Peringatan "preloaded but not used" (font): `preload:false` pada font lokal.

## Status: reservasi, kalender cuti, monitor antrean (fase 13)
- Reservasi publik: tombol kirim tidak lagi diam-diam nonaktif (daftar "Lengkapi dulu"), alergi/keluhan menerima "-" (disimpan sebagai "Tidak ada" / "Pemeriksaan umum"), tanggal bebas lewat input date (dibatasi `rules.horizonDays`, default 60), hari cuti/tanpa praktik ditandai tidak tersedia; server tetap menolak tanggal cuti lewat `slotsFor`.
- Tim & Akses > Kalender: grid bulanan, klik untuk cuti, klik dua tanggal untuk rentang, peringatan janji aktif, simpan lewat `PUT /api/team/schedules/[id]`; dokter hanya lihat.
- Monitor TV: `/monitor-antrean-poliklinik`, `/monitor-antrean-farmasi` (superadmin, dokter, staf, apoteker; nama disamarkan, polling 2,5 dtk, chime + suara opsional, layar penuh). API `GET /api/monitor/{poli,farmasi}`.
- Panggil pasien: aksi `recall` (janji), `POST /api/pharmacy/rx/[visitId]/call` (resep); tombol di Antrian, Periksa, Farmasi.

## Status: portal pasien, PWA, push (fase 14)
- Portal: Beranda dari data live (`/api/portal/ringkasan`: RM, janji berikutnya, tagihan, kotak masuk), Akun saya menampilkan biodata + No. RM (`/api/portal/profil`, NIK tetap tersamar), tab bar bawah di mobile (tombol Janji di tengah).
- Dokter di form janji: filter poliklinik tidak lagi menyembunyikan dokter tanpa poliklinik; Jadwal praktik punya pilihan Poliklinik per dokter.
- PWA: `app/manifest.ts`, `public/sw.js` (push, fallback offline, cache aset statis; HTML/API tidak di-cache), ikon di `public/icons`, `PwaCard` di Akun semua peran.
- Push: `lib/push.ts` (VAPID dari env; dev membuat kunci otomatis), kotak masuk per pengguna, pemicu otomatis (janji, panggilan, resep baru, obat siap, obat diserahkan), pesan manual dokter -> pasien / farmasi (`/api/push/send`, tombol di halaman Pemeriksaan).
- Env produksi: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Status: Paket A/B/C layanan pasien (fase 15)
- Paket A: pengingat push H-1 dan 2 jam (cron `/api/cron/reminders`, juga recall), tombol "Saya sudah tiba" (aksi `arrive`, jendela diatur di Pengaturan > Fitur pasien), status antrean "N pasien lagi", subtab Promosi (`/dashboard/promosi`; superadmin menayangkan, dokter hanya draf) dengan promo di portal dan diskon otomatis di kasir.
- Paket B: passkey WebAuthn (`lib/passkey.ts`, `/api/passkey/*`, @simplewebauthn v14; tombol di Login, kartu di Akun; akun dengan 2FA tetap wajib sandi + 2FA), anamnesis pra-kunjungan (`POST /api/appointments/[id]/previsit`, terisi otomatis di pemeriksaan), persetujuan tindakan digital (template di Pengaturan > Persetujuan, tanda tangan kanvas PNG, tidak dapat diubah setelah ditandatangani), kontrol/recall (preset hari di Pengaturan > Fitur pasien, halaman `/dashboard/recall`, pengingat otomatis).
- Paket C: unggah foto/rontgen (`/api/portal/berkas`, sharp WebP, hanya pemilik dan klinis), jadwal minum obat (`/api/portal/obat`), kuitansi PDF (`lib/pdf.ts`, `/api/invoices/[id]/pdf`), survei kepuasan (`/portal/survei`, `/dashboard/survei`), keluarga dalam satu akun (`/portal/keluarga`), waiting list otomatis (push saat slot kosong), chat singkat (`/portal/pesan`, `/dashboard/pesan`), edukasi pasca tindakan (otomatis per kata kunci tindakan + kirim manual).
- Belum: pembayaran online. Kuitansi PDF sudah ada; integrasi Pakasir v2 atau gateway lain ditambahkan kemudian (jangan memalsukan status bayar).
- Env: `NEXT_PUBLIC_SITE_URL=https://estakadentalclinic.vercel.app` menentukan rpID/origin passkey. Pasang `CRON_SECRET` dan jadwalkan pemanggilan `/api/cron/reminders` (Vercel Cron atau layanan lain).
- Lockfile: proyek memakai pnpm (`pnpm-lock.yaml`); jangan menambahkan `package-lock.json`.

## Status: bottom nav mobile per peran (fase 17)
- `components/dash/BottomNav.tsx`: 5 tombol per peran, tampil di bawah `lg` (mobile + tablet), disembunyikan di desktop (sidebar). Semua tujuan disaring RBAC dari NAV; akun terkunci hanya bisa Akun.
- Dokter: Beranda | Antrian (badge menunggu) | Periksa (mulai/buka kunjungan pasien yang dipanggil/berikutnya) | Pasien | Lainnya.
- Staf: Beranda | Janji (badge konfirmasi) | Check-in (sheet "Tandai tiba") | Kasir (badge belum bayar) | Lainnya.
- Apoteker: Beranda | Resep (badge) | Panggil (resep berikutnya) | Stok (badge stok menipis) | Lainnya.
- Superadmin: Beranda | Janji | Cari pasien (sheet) | Analitik | Lainnya.
- "Lainnya": sheet menu per grup + badge + Keluar.
- Data: `GET /api/dash/mobile` (badge, KPI, pasien utama, daftar check-in; tiap bagian dibatasi izin; pasien 403), polling 10 dtk. Beranda dasbor memakai `RoleKpi`. Deep link `?tab=queue` (Janji) dan `?tab=rx|stock` (Farmasi).
