/**
 * Single source of truth for clinic content.
 * Anything marked TODO is a placeholder the owner must confirm before launch.
 * Medical claims are intentionally conservative (no guarantees, no superlatives).
 * Use *word* to render an italic accent word.
 */
import { getBaseUrl } from "@/lib/origin";

export type Bi = { id: string; en: string };

const env = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const clinic = {
  name: "Estaka Dental Clinic",
  short: "Estaka",
  siteUrl: getBaseUrl(),
  whatsapp: env(process.env.NEXT_PUBLIC_WA_NUMBER)?.replace(/\D/g, ""),
  phone: env(process.env.NEXT_PUBLIC_PHONE),
  address: env(process.env.NEXT_PUBLIC_ADDRESS) ?? "Jl. Andi Tonro Blok F No.30, Bongaya, Kec. Tamalate, Kota Makassar, Sulawesi Selatan 90131",
  geo: { lat: -5.171323888, lng: 119.416151361 },
  mapsUrl: env(process.env.NEXT_PUBLIC_MAPS_URL),
  instagram: env(process.env.NEXT_PUBLIC_INSTAGRAM),
  /** TODO: confirm opening hours (must match lib/schedule.ts) */
  hours: [
    { days: { id: "Senin – Sabtu", en: "Monday – Saturday" }, time: "09:00 – 17:00" },
    { days: { id: "Minggu", en: "Sunday" }, time: { id: "Tutup", en: "Closed" } as Bi | string },
  ],
};

export const nav: { href: string; label: Bi }[] = [
  { href: "#doctors", label: { id: "Dokter", en: "Doctors" } },
  { href: "#specialties", label: { id: "Layanan", en: "Services" } },
  { href: "#technology", label: { id: "Teknologi", en: "Technology" } },
  { href: "#pricing", label: { id: "Biaya", en: "Pricing" } },
  { href: "#faq", label: { id: "FAQ", en: "FAQ" } },
  { href: "#location", label: { id: "Lokasi", en: "Location" } },
];

export const navCopy = {
  login: { id: "Masuk", en: "Log in" },
  langAria: { id: "Pilihan bahasa", en: "Language options" },
  menuOpen: { id: "Buka menu navigasi", en: "Open navigation menu" },
  menuClose: { id: "Tutup menu navigasi", en: "Close navigation menu" },
};

export const hero = {
  eyebrow: { id: "Estaka Dental Clinic · Dokter Gigi Umum dan Spesialis", en: "Estaka Dental Clinic · General and Specialist Dentists" },
  title: { id: "Senyum yang terawat, *dirancang bersama Anda.*", en: "Dental care that is precise, *planned with you.*" },
  sub: {
    id: "Dokter gigi umum dan spesialis dalam satu klinik, dari konsultasi pertama hingga perawatan lanjutan.",
    en: "General and specialist dentists under one roof, from your first consultation to follow-up care.",
  },
  cta1: { id: "Buat janji", en: "Book a visit" },
  cta2: { id: "Kenali dokter kami", en: "Meet our doctors" },
  scroll: { id: "Gulir", en: "Scroll" },
};

export const manifesto = {
  eyebrow: { id: "Pendekatan kami", en: "Our approach" },
  text: {
    id: "Perawatan gigi yang baik dimulai dari mendengarkan. Kami menjelaskan kondisi Anda, merencanakan bersama, lalu merawat dengan teliti.",
    en: "Good dental care starts with listening. We explain your condition, plan together, then treat with care.",
  },
};

export const marquee: Bi[] = [
  { id: "Dokter gigi umum", en: "General dentistry" },
  { id: "Konservasi gigi", en: "Conservative dentistry" },
  { id: "Tambal gigi", en: "Fillings" },
  { id: "Perawatan saluran akar", en: "Root canal treatment" },
  { id: "Pembersihan karang gigi", en: "Scaling" },
  { id: "Digital smile design", en: "Digital smile design" },
];

export type Doctor = {
  id: string;
  name: string; // TODO: replace with the real name and title
  monogram: string;
  photo?: string; // e.g. "/doctors/dokter-1.webp" (place file in /public/doctors)
  role: Bi;
  bio: Bi;
  focus: Bi[];
};

export const doctors: Doctor[] = [
  {
    id: "kg",
    name: "drg. Hj. Kurniawaty, Sp.KG",
    monogram: "K",
    photo: "/doctors/kurniawaty.webp",
    role: { id: "Dokter Gigi Spesialis Konservasi", en: "Conservative Dentistry Specialist" },
    bio: {
      id: "Menangani perawatan untuk mempertahankan gigi asli, seperti tambalan dan perawatan saluran akar.",
      en: "Provides treatment to preserve natural teeth, such as fillings and root canal treatment.",
    },
    focus: [
      { id: "Tambal gigi", en: "Dental fillings" },
      { id: "Perawatan saluran akar", en: "Root canal treatment" },
      { id: "Pemulihan gigi yang rusak", en: "Restoring damaged teeth" },
    ],
  },
  {
    // TODO: owner to review bio and focus lines
    id: "tasya",
    name: "drg. Tasya Awaliyah Arsyad",
    monogram: "T",
    photo: "/doctors/tasya.webp",
    role: { id: "Dokter Gigi Umum", en: "General Dentist" },
    bio: {
      id: "Menangani pemeriksaan rutin dan perawatan dasar, serta merujuk ke dokter spesialis bila diperlukan.",
      en: "Handles routine check-ups and basic treatment, and refers to a specialist when needed.",
    },
    focus: [
      { id: "Pemeriksaan dan konsultasi", en: "Check-ups and consultation" },
      { id: "Pembersihan karang gigi", en: "Scaling and cleaning" },
      { id: "Tambal gigi", en: "Fillings" },
    ],
  },
  {
    // TODO: owner to review bio and focus lines
    id: "aksa",
    name: "drg. M. Aksa Arsyad",
    monogram: "A",
    photo: "/doctors/aksa.webp",
    role: { id: "Dokter Gigi Umum", en: "General Dentist" },
    bio: {
      id: "Menangani pemeriksaan rutin dan perawatan dasar, serta merujuk ke dokter spesialis bila diperlukan.",
      en: "Handles routine check-ups and basic treatment, and refers to a specialist when needed.",
    },
    focus: [
      { id: "Pemeriksaan dan konsultasi", en: "Check-ups and consultation" },
      { id: "Pembersihan karang gigi", en: "Scaling and cleaning" },
      { id: "Tambal gigi", en: "Fillings" },
    ],
  },
];

export const doctorsCopy = {
  eyebrow: { id: "Tim dokter", en: "Our doctors" },
  title: { id: "Pilih dokter, *kenali pendekatannya.*", en: "Choose a doctor, *meet their approach.*" },
  hint: {
    id: "Geser potret, ketuk, atau gunakan tombol panah.",
    en: "Drag a portrait, tap, or use the arrow keys.",
  },
  profile: { id: "Lihat profil", en: "View profile" },
  close: { id: "Tutup profil", en: "Close profile" },
  select: { id: "Pilih dokter", en: "Select doctor" },
  focusLabel: { id: "Fokus perawatan", en: "Treatment focus" },
  book: { id: "Buat janji", en: "Book appointment" },
  prev: { id: "Dokter sebelumnya", en: "Previous doctor" },
  next: { id: "Dokter berikutnya", en: "Next doctor" },
};

/** Only list specialties the clinic really offers. Others stay disabled. */
export const specialties: { id: string; enabled: boolean; title: Bi; text: Bi }[] = [
  {
    id: "umum",
    enabled: true,
    title: { id: "Dokter Gigi Umum", en: "General Dentistry" },
    text: {
      id: "Pemeriksaan, pembersihan karang gigi, tambal, dan perawatan dasar untuk seluruh keluarga.",
      en: "Check-ups, scaling, fillings and essential care for the whole family.",
    },
  },
  {
    id: "kg",
    enabled: true,
    title: { id: "Konservasi Gigi", en: "Conservative Dentistry" },
    text: {
      id: "Perawatan untuk mempertahankan gigi asli, seperti tambalan dan perawatan saluran akar, oleh dokter spesialis.",
      en: "Treatment to preserve natural teeth, such as fillings and root canal treatment, by a specialist.",
    },
  },
  // Enable only when really offered: Bedah Mulut (Sp.BM), Ortodonti (Sp.Ort), Periodonsia (Sp.Perio),
  // Prostodonsia (Sp.Pros), Pedodonsia (Sp.KGA), Penyakit Mulut (Sp.PM), Radiologi (Sp.RKG).
];

export const specialtiesCopy = {
  eyebrow: { id: "Layanan", en: "Services" },
  title: { id: "Satu klinik, *kebutuhan yang beragam.*", en: "One clinic, *many needs.*" },
};

export const technology = {
  eyebrow: { id: "Teknologi", en: "Technology" },
  title: { id: "Perencanaan yang *lebih mudah dipahami.*", en: "Planning that is *easier to understand.*" },
  items: [
    {
      id: "scan",
      title: { id: "Intraoral Scanner", en: "Intraoral Scanner" },
      text: {
        id: "Pemindaian gigi secara digital untuk membantu dokter merencanakan perawatan, pada kasus yang sesuai.",
        en: "Digital scanning of your teeth to help the doctor plan treatment, in suitable cases.",
      },
    },
    {
      id: "dsd",
      title: { id: "Digital Smile Design", en: "Digital Smile Design" },
      text: {
        id: "Pratinjau rencana senyum sebagai bahan diskusi. Hasil akhir bergantung pada kondisi klinis tiap pasien.",
        en: "A preview of the smile plan as a basis for discussion. Final results depend on each patient's clinical condition.",
      },
    },
  ],
};

export const journey = {
  eyebrow: { id: "Alur kunjungan", en: "Your visit" },
  title: { id: "Dari kunjungan pertama *hingga kontrol lanjutan.*", en: "From first visit *to follow-up.*" },
  steps: [
    { title: { id: "Konsultasi", en: "Consultation" }, text: { id: "Ceritakan keluhan dan harapan Anda.", en: "Tell us about your concerns and goals." } },
    { title: { id: "Pemeriksaan", en: "Examination" }, text: { id: "Dokter memeriksa dan menjelaskan kondisi gigi Anda.", en: "The doctor examines and explains your dental condition." } },
    { title: { id: "Perawatan", en: "Treatment" }, text: { id: "Perawatan dilakukan sesuai rencana yang telah disepakati.", en: "Treatment follows the plan you agreed on." } },
    { title: { id: "Kontrol", en: "Follow-up" }, text: { id: "Pemantauan lanjutan agar hasil tetap terjaga.", en: "Ongoing check-ups to maintain your results." } },
  ],
};

export const statsCopy = {
  eyebrow: { id: "Klinik dalam angka", en: "At a glance" },
  doctors: { id: "Dokter", en: "Doctors" },
  services: { id: "Bidang layanan", en: "Service areas" },
  steps: { id: "Tahap kunjungan", en: "Visit steps" },
};

/** Treatments shown in booking and pricing. `price` stays undefined until the owner confirms it. */
export const TREATMENT_IDS = ["konsultasi", "scaling", "tambal", "saluran-akar", "lainnya"] as const;
export type TreatmentId = (typeof TREATMENT_IDS)[number];

export const treatments: { id: TreatmentId; label: Bi; price?: Bi }[] = [
  { id: "konsultasi", label: { id: "Konsultasi dan pemeriksaan", en: "Consultation and check-up" } },
  { id: "scaling", label: { id: "Pembersihan karang gigi", en: "Scaling and cleaning" } },
  { id: "tambal", label: { id: "Tambal gigi", en: "Dental filling" } },
  { id: "saluran-akar", label: { id: "Perawatan saluran akar", en: "Root canal treatment" } },
  { id: "lainnya", label: { id: "Belum yakin / lainnya", en: "Not sure / other" } },
];

export const pricing = {
  eyebrow: { id: "Biaya", en: "Pricing" },
  title: { id: "Estimasi biaya, *dijelaskan di awal.*", en: "Cost estimates, *explained upfront.*" },
  note: {
    id: "Biaya akhir ditentukan setelah pemeriksaan karena kondisi tiap pasien berbeda.",
    en: "The final cost is set after examination because every patient's condition is different.",
  },
  ask: { id: "Tanyakan estimasi", en: "Ask for an estimate" },
};

export const faq = {
  eyebrow: { id: "Pertanyaan umum", en: "FAQ" },
  title: { id: "Hal yang sering *ditanyakan.*", en: "Common *questions.*" },
  items: [
    {
      q: { id: "Apa yang terjadi pada kunjungan pertama?", en: "What happens at the first visit?" },
      a: { id: "Dokter akan menanyakan keluhan, memeriksa kondisi gigi dan mulut, lalu menjelaskan pilihan perawatan.", en: "The doctor will ask about your concerns, examine your teeth and mouth, then explain your treatment options." },
    },
    {
      q: { id: "Apakah saya perlu membuat janji?", en: "Do I need an appointment?" },
      a: { id: "Kami menyarankan membuat janji agar waktu Anda lebih terjaga. Gunakan formulir di bawah atau hubungi kami melalui WhatsApp.", en: "We recommend booking so your time is respected. Use the form below or message us on WhatsApp." },
    },
    {
      q: { id: "Apakah perawatan terasa sakit?", en: "Will treatment hurt?" },
      a: { id: "Kenyamanan Anda menjadi perhatian. Bila diperlukan, dokter dapat memberikan anestesi lokal sesuai tindakan.", en: "Your comfort matters. When needed, the doctor can use local anaesthesia depending on the procedure." },
    },
    {
      q: { id: "Berapa kali kunjungan untuk perawatan saluran akar?", en: "How many visits does root canal treatment take?" },
      a: { id: "Bergantung pada kondisi gigi. Dokter akan menjelaskan perkiraan jumlah kunjungan setelah pemeriksaan.", en: "It depends on the condition of the tooth. The doctor will explain the expected number of visits after examination." },
    },
    {
      q: { id: "Bagaimana mengubah atau membatalkan jadwal?", en: "How do I reschedule or cancel?" },
      a: { id: "Hubungi kami melalui WhatsApp sesegera mungkin agar jadwal dapat disesuaikan.", en: "Message us on WhatsApp as early as possible so we can adjust the schedule." },
    },
  ],
};

export const location = {
  eyebrow: { id: "Lokasi dan jam praktik", en: "Location and hours" },
  title: { id: "Kunjungi *Estaka.*", en: "Visit *Estaka.*" },
  addressMissing: { id: "Alamat akan segera ditambahkan.", en: "Address coming soon." },
  directions: { id: "Buka di Google Maps", en: "Open in Google Maps" },
  call: { id: "Telepon", en: "Call" },
  whatsapp: { id: "Chat WhatsApp", en: "WhatsApp chat" },
};

export const bookingCopy = {
  eyebrow: { id: "Janji temu", en: "Appointments" },
  title: { id: "Atur jadwal *kunjungan Anda.*", en: "Schedule *your visit.*" },
  sub: { id: "Tiga langkah singkat. Tim kami akan mengonfirmasi melalui WhatsApp.", en: "Three short steps. Our team will confirm via WhatsApp." },
  s1: { id: "Pilih perawatan", en: "Choose a treatment" },
  s2: { id: "Pilih tanggal", en: "Pick a date" },
  s3: { id: "Pilih jam", en: "Pick a time" },
  s4: { id: "Data Anda", en: "Your details" },
  name: { id: "Nama lengkap", en: "Full name" },
  phone: { id: "Nomor WhatsApp", en: "WhatsApp number" },
  note: { id: "Catatan (opsional)", en: "Notes (optional)" },
  consent: {
    id: "Saya setuju data ini digunakan klinik untuk mengatur janji temu.",
    en: "I agree the clinic may use this data to arrange my appointment.",
  },
  submit: { id: "Kirim permintaan janji", en: "Send appointment request" },
  sending: { id: "Mengirim…", en: "Sending…" },
  doneTitle: { id: "Permintaan terkirim", en: "Request sent" },
  doneText: { id: "Terima kasih. Kami akan mengonfirmasi jadwal melalui WhatsApp.", en: "Thank you. We will confirm your slot via WhatsApp." },
  sendWa: { id: "Kirim konfirmasi lewat WhatsApp", en: "Send confirmation on WhatsApp" },
  again: { id: "Buat janji lain", en: "Make another booking" },
  noDates: { id: "Memuat tanggal…", en: "Loading dates…" },
  fine: { id: "Janji bersifat permintaan hingga dikonfirmasi tim klinik.", en: "Bookings are requests until confirmed by the clinic team." },

  // Mode tabs & patient options
  patientTypeLabel: { id: "Jenis pasien", en: "Patient type" },
  tabNew: { id: "Pasien baru", en: "New patient" },
  tabReturning: { id: "Pasien lama (NIK / No RM)", en: "Returning patient (NIK / Med. Record)" },

  // Legends
  legendPatientData: { id: "1. Data pasien", en: "1. Patient details" },
  legendLookupPatient: { id: "1. Cari data pasien", en: "1. Look up patient" },
  legendDoctorDateTime: { id: "2. Dokter, tanggal, dan jam", en: "2. Doctor, date, and time" },
  legendComplaintSafety: { id: "3. Keluhan dan keselamatan", en: "3. Complaint and safety" },
  legendComplaintOnly: { id: "3. Keluhan", en: "3. Complaint" },

  // Input labels & placeholders
  nikLabel: { id: "Nomor Induk Kependudukan (NIK)", en: "National ID Number (NIK)" },
  nikPlaceholder: { id: "16 digit NIK", en: "16-digit NIK" },
  nameLabel: { id: "Nama lengkap", en: "Full name" },
  namePlaceholder: { id: "Sesuai KTP", en: "As on ID card" },
  birthDateLabel: { id: "Tanggal lahir", en: "Date of birth" },
  genderLabel: { id: "Jenis kelamin", en: "Gender" },
  genderMale: { id: "Laki-laki", en: "Male" },
  genderFemale: { id: "Perempuan", en: "Female" },
  phoneLabel: { id: "Nomor WhatsApp aktif", en: "Active WhatsApp number" },
  phonePlaceholder: { id: "08xxxxxxxxxx", en: "08xxxxxxxxxx" },
  addressLabel: { id: "Alamat domisili", en: "Residential address" },
  addressPlaceholder: { id: "Nama jalan, nomor rumah, kelurahan, kota", en: "Street name, house number, subdistrict, city" },
  allergiesLabel: { id: "Riwayat alergi obat (penting untuk keselamatan Anda)", en: "Drug allergy history (vital for your safety)" },
  allergiesPlaceholder: { id: "Contoh: Amoxicillin, Asam Mefenamat, atau tulis Tidak ada", en: "e.g. Amoxicillin, Mefenamic Acid, or write None" },
  complaintLabel: { id: "Keluhan utama gigi atau gejala yang dialami", en: "Main dental complaint or symptoms" },
  complaintPlaceholder: { id: "Nyeri, gigi ngilu, tambalan lepas, gusi bengkak, atau kebutuhan estetika", en: "Pain, tooth sensitivity, loose filling, swollen gums, or aesthetic goals" },

  // Returning patient search
  identLabel: { id: "NIK (16 digit) atau Nomor RM", en: "NIK (16 digits) or Medical Record No." },
  birthDateOldLabel: { id: "Tanggal lahir", en: "Date of birth" },
  phone4Label: { id: "4 digit terakhir nomor HP", en: "Last 4 digits of phone number" },
  lookupBtn: { id: "Cari data pasien", en: "Find patient details" },
  foundData: { id: "Data ditemukan:", en: "Patient found:" },
  foundContinue: { id: ". Lanjutkan memilih dokter dan jadwal. ", en: ". Proceed to choose doctor and schedule. " },
  changePatient: { id: "Ganti", en: "Change" },

  // Doctor & schedule
  doctorSelectLabel: { id: "Dokter gigi pemeriksa", en: "Examining dentist" },
  anyDoctor: { id: "Dokter mana saja yang tersedia", en: "Any available dentist" },
  dateHeading: { id: "Tanggal", en: "Date" },
  customDateLabel: { id: "Atau pilih tanggal lain", en: "Or pick another date" },
  timeHeading: { id: "Jam", en: "Time" },
  selectDateFirst: { id: "Pilih tanggal yang tersedia terlebih dulu.", en: "Please select an available date first." },
  loadingSchedule: { id: "Memuat jadwal…", en: "Loading schedule…" },
  noSlotsOnDate: { id: "Tidak ada jadwal praktik pada tanggal ini. Coba tanggal lain.", en: "No practice hours on this date. Please try another date." },
  closedOnDate: { id: "pada tanggal ini. Silakan pilih tanggal lain.", en: "on this date. Please choose another date." },
  closedOutsideRange: (h: number) => ({ id: `Di luar rentang pemesanan (maks. ${h} hari ke depan)`, en: `Outside booking range (max. ${h} days ahead)` }),
  closedAllOff: { id: "Semua dokter cuti", en: "All dentists on leave" },
  closedDocOff: { id: "Dokter cuti", en: "Dentist on leave" },
  closedNoSchedule: { id: "Tidak ada jam praktik", en: "No practice hours" },

  // Validation
  completeFirst: { id: "Lengkapi dulu: ", en: "Please complete first: " },
  missingNik: { id: "NIK 16 digit", en: "16-digit NIK" },
  missingName: { id: "nama lengkap", en: "full name" },
  missingBirthDate: { id: "tanggal lahir", en: "date of birth" },
  missingPhone: { id: "nomor WhatsApp", en: "WhatsApp number" },
  missingAddress: { id: "alamat (min. 5 huruf)", en: "address (min. 5 chars)" },
  missingAllergies: { id: "riwayat alergi (tulis Tidak ada atau -)", en: "allergy history (write None or -)" },
  missingDate: { id: "tanggal yang tersedia", en: "an available date" },
  missingTime: { id: "jam", en: "a time slot" },
  missingComplaint: { id: "keluhan (tulis - bila hanya kontrol)", en: "complaint (write - if check-up only)" },
  missingConsent: { id: "persetujuan data", en: "data consent" },
  missingVerification: { id: "verifikasi data pasien lama", en: "returning patient verification" },

  // Errors
  connError: { id: "Koneksi bermasalah. Coba lagi atau hubungi kami lewat WhatsApp.", en: "Connection issue. Please try again or reach us via WhatsApp." },
  matchError: { id: "Data tidak cocok.", en: "Patient details do not match." },
  failError: { id: "Permintaan belum terkirim.", en: "Request could not be sent." },

  // Confirmation
  doneAt: { id: "pukul", en: "at" },
  doneStatus: {
    id: "WITA. Janji Anda berstatus menunggu konfirmasi dari tim kami melalui WhatsApp.",
    en: "WITA. Your appointment is pending confirmation from our team via WhatsApp.",
  },
};

export const footerCopy = {
  sitemapAria: { id: "Peta situs", en: "Sitemap" },
  rights: { id: "Seluruh hak cipta dilindungi.", en: "All rights reserved." },
  disclaimer: {
    id: "Informasi di situs ini bersifat umum dan bukan pengganti pemeriksaan oleh dokter gigi.",
    en: "Information on this site is general and does not replace an examination by a dentist.",
  },
  privacy: { id: "Data yang Anda kirim hanya dipakai untuk mengatur janji temu.", en: "Data you submit is used only to arrange your appointment." },
};

/**
 * Real content only. Sections below stay hidden while their arrays are empty.
 * Add items with the person's written consent (photos, before/after, testimonials).
 */
export type TeamMember = { name: string; role: Bi; photo: string };
export const team: TeamMember[] = []; // e.g. { name: "...", role: { id: "Perawat gigi", en: "Dental nurse" }, photo: "/team/nama.webp" }

export type CaseResult = { title: Bi; before: string; after: string; note?: Bi };
export const results: CaseResult[] = []; // only with written patient consent

export type Testimonial = { quote: Bi; name: string; treatment?: Bi };
export const testimonials: Testimonial[] = []; // only real reviews with permission

export const extraCopy = {
  team: { eyebrow: { id: "Tim kami", en: "Our team" }, title: { id: "Orang-orang *di balik senyum Anda.*", en: "The people *behind your smile.*" } },
  results: { eyebrow: { id: "Hasil perawatan", en: "Results" }, title: { id: "Hasil nyata, *dengan izin pasien.*", en: "Real results, *with patient consent.*" }, before: { id: "Sebelum", en: "Before" }, after: { id: "Sesudah", en: "After" }, hint: { id: "Geser untuk membandingkan", en: "Drag to compare" }, disclaimer: { id: "Hasil dapat berbeda pada setiap pasien.", en: "Results vary between patients." } },
  testimonials: { eyebrow: { id: "Testimoni", en: "Testimonials" }, title: { id: "Kata *pasien kami.*", en: "What *patients say.*" } },
};
