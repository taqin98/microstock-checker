const ISSUE_GUIDANCE = {
  AI_GENERATED_CONTENT_PROHIBITED: {
    title: 'Terdeteksi sebagai konten buatan AI',
    explanation: 'Platform tujuan melarang konten yang dibuat seluruhnya atau sebagian menggunakan generative AI.',
    action: 'Jangan kirim file ini. Gunakan karya yang dibuat secara manual dan simpan bukti proses pembuatannya.',
  },
  INTELLECTUAL_PROPERTY_INFRINGEMENT_RISK: {
    title: 'Berpotensi melanggar hak kekayaan intelektual',
    explanation: 'Gambar mungkin memuat merek, karya seni, tulisan, karakter, desain produk, atau arsitektur yang dilindungi.',
    action: 'Hapus atau ganti elemen yang disebutkan pada bukti, lalu periksa ulang sebelum mengirim.',
  },
  INTELLECTUAL_PROPERTY_REVIEW: {
    title: 'Elemen visual perlu diperiksa terkait hak cipta',
    explanation: 'Sistem melihat elemen yang mungkin dilindungi, tetapi keyakinan deteksinya belum cukup untuk penolakan otomatis.',
    action: 'Periksa elemen yang disebutkan dan pastikan Anda memiliki hak komersial sebelum mengirim.',
  },
  AI_GENERATED_CONTENT_REVIEW: {
    title: 'Ada indikasi konten buatan AI',
    explanation: 'Beberapa pola visual menyerupai hasil generative AI, tetapi perlu konfirmasi manual.',
    action: 'Tinjau bukti proses pembuatan dan kebijakan AI platform tujuan sebelum mengirim.',
  },
  SENSITIVE_CONTENT: {
    title: 'Terdapat konten sensitif',
    explanation: 'Gambar mungkin memuat kekerasan, materi dewasa, simbol kontroversial, atau elemen ofensif.',
    action: 'Hapus elemen sensitif atau pastikan kategori serta kebijakan platform memang mengizinkannya.',
  },
  LIVE_TEXT: {
    title: 'Masih terdapat teks yang belum di-outline',
    explanation: 'Teks aktif dapat berubah atau kehilangan font saat file dibuka oleh reviewer.',
    action: 'Pilih semua teks di aplikasi desain, ubah menjadi outline/curve, lalu ekspor ulang.',
  },
  EMBEDDED_RASTER: {
    title: 'File vector mengandung gambar raster',
    explanation: 'Platform mengharapkan elemen vector yang tetap dapat diedit dan diperbesar tanpa pecah.',
    action: 'Hapus gambar bitmap atau ubah elemen tersebut menjadi vector sebelum mengekspor ulang.',
  },
  PLACED_ITEMS: {
    title: 'Terdapat file eksternal yang masih tertaut',
    explanation: 'Linked asset dapat hilang ketika file dibuka pada komputer lain.',
    action: 'Embed atau hapus seluruh linked/placed item, kemudian simpan ulang file.',
  },
  STRAY_OBJECTS: {
    title: 'Ada objek di luar artboard',
    explanation: 'Objek tersembunyi di luar area desain dapat menyebabkan penolakan atau hasil preview yang tidak sesuai.',
    action: 'Periksa area di luar artboard, lalu hapus objek yang tidak digunakan.',
  },
  WRONG_COLOR_MODE: {
    title: 'Mode warna tidak sesuai',
    explanation: 'File menggunakan mode warna yang berbeda dari persyaratan platform tujuan.',
    action: 'Ubah document color mode sesuai detail pemeriksaan, lalu ekspor ulang.',
  },
  LOW_RESOLUTION: {
    title: 'Resolusi gambar terlalu rendah',
    explanation: 'Lebar atau tinggi gambar belum memenuhi ukuran minimum platform.',
    action: 'Gunakan sumber beresolusi lebih tinggi. Hindari pembesaran paksa yang menurunkan ketajaman.',
  },
  PARTIAL_LOW_RES: {
    title: 'Salah satu dimensi gambar terlalu kecil',
    explanation: 'Sebagian ukuran file belum memenuhi batas minimum yang disarankan.',
    action: 'Sesuaikan ukuran kanvas dari sumber berkualitas tinggi, lalu periksa ulang.',
  },
  NOT_RGB: {
    title: 'Gambar bukan dalam mode RGB',
    explanation: 'Platform membutuhkan profil warna RGB untuk file gambar ini.',
    action: 'Konversi gambar ke RGB dengan profil sRGB, kemudian simpan ulang.',
  },
  FILE_TOO_LARGE: {
    title: 'Ukuran file terlalu besar',
    explanation: 'Ukuran file melewati batas upload platform tujuan.',
    action: 'Optimalkan kompresi tanpa merusak kualitas atau sederhanakan isi file.',
  },
  CORRUPT_FILE: {
    title: 'File rusak atau tidak dapat dibaca',
    explanation: 'Struktur file tidak dapat diproses secara normal oleh sistem.',
    action: 'Buka file sumber, ekspor ulang sebagai file baru, lalu coba periksa kembali.',
  },
  READ_ERROR: {
    title: 'File tidak dapat dibaca',
    explanation: 'Sistem gagal membuka atau membaca isi file.',
    action: 'Pastikan file tidak rusak, tidak terkunci, dan dapat dibuka dari aplikasi pembuatnya.',
  },
  NOT_JPEG: {
    title: 'Isi file bukan JPEG yang valid',
    explanation: 'Ekstensi file terlihat seperti JPG/JPEG, tetapi format internalnya berbeda.',
    action: 'Ekspor ulang menggunakan format JPEG yang sebenarnya, bukan hanya mengganti ekstensi file.',
  },
  INVALID_XML: {
    title: 'Struktur SVG tidak valid',
    explanation: 'Markup XML pada file SVG rusak atau tidak lengkap.',
    action: 'Buka dan ekspor ulang SVG dari aplikasi vector, lalu validasi kembali.',
  },
  NO_SVG_ROOT: {
    title: 'File tidak memiliki elemen SVG utama',
    explanation: 'Dokumen tidak dikenali sebagai SVG karena elemen root yang diperlukan tidak ditemukan.',
    action: 'Ekspor ulang sebagai SVG standar dari aplikasi vector.',
  },
  NO_VIEWBOX: {
    title: 'SVG tidak memiliki informasi area tampilan',
    explanation: 'Atribut viewBox atau ukuran dokumen tidak tersedia sehingga scaling dapat bermasalah.',
    action: 'Tambahkan viewBox atau ekspor ulang SVG dengan ukuran artboard yang benar.',
  },
  ILLUSTRATOR_ERROR: {
    title: 'Pemeriksaan Illustrator gagal',
    explanation: 'Sistem tidak berhasil membuka atau memproses EPS melalui Adobe Illustrator.',
    action: 'Pastikan Illustrator tersedia, tutup dialog yang terbuka, lalu jalankan Periksa ulang.',
  },
  ILLUSTRATOR_SCRIPT_ERROR: {
    title: 'Automasi Illustrator mengalami kesalahan',
    explanation: 'Script pemeriksaan tidak dapat menyelesaikan analisis file EPS.',
    action: 'Buka EPS secara manual, simpan ulang dalam versi kompatibel, lalu periksa kembali.',
  },
  SMALL_DIMENSIONS: {
    title: 'Dimensi artwork terlalu kecil',
    explanation: 'Ukuran kanvas vector belum memenuhi batas minimum platform.',
    action: 'Perbesar artboard dan sesuaikan artwork secara proporsional.',
  },
  EXCESSIVE_PATHS: {
    title: 'Jumlah path terlalu banyak',
    explanation: 'Artwork terlalu kompleks dan berpotensi sulit diedit atau diproses.',
    action: 'Sederhanakan path, gabungkan bentuk yang sesuai, dan hapus anchor point yang tidak diperlukan.',
  },
  ASPECT_RATIO_MISMATCH: {
    title: 'Rasio EPS dan JPG tidak sama',
    explanation: 'File vector dan preview JPG tidak merepresentasikan komposisi yang sama.',
    action: 'Ekspor JPG langsung dari artboard EPS yang sama tanpa crop atau perubahan ukuran.',
  },
  SIMILAR_CONTENT_SPAM: {
    title: 'Konten terlalu generik atau mirip spam',
    explanation: 'Komposisi dinilai kurang unik atau terlalu serupa dengan konten massal yang umum dikirim.',
    action: 'Perkuat konsep, komposisi, dan nilai komersial sebelum mengirim.',
  },
  POOR_COMMERCIAL_QUALITY: {
    title: 'Kualitas komersial perlu ditingkatkan',
    explanation: 'Terdapat masalah visual yang dapat mengurangi kegunaan aset bagi pembeli.',
    action: 'Perbaiki detail yang disebutkan pada bukti, lalu tinjau pada zoom 100%.',
  },
};

function getIssueDetails(issue) {
  const guidance = ISSUE_GUIDANCE[issue.code];
  const evidenceMarker = 'Evidence:';
  const markerIndex = issue.message.indexOf(evidenceMarker);
  const evidence = markerIndex >= 0
    ? issue.message.slice(markerIndex + evidenceMarker.length).trim()
    : issue.message;

  return {
    title: guidance?.title || issue.code.replaceAll('_', ' ').toLowerCase(),
    explanation: guidance?.explanation || 'Pemeriksaan menemukan kondisi yang perlu Anda perhatikan.',
    action: guidance?.action || 'Tinjau detail pemeriksaan, perbaiki sumber file, lalu jalankan Periksa ulang.',
    evidence,
  };
}

export function IssueExplanation({ issue, severity }) {
  const details = getIssueDetails(issue);

  return (
    <article className={`issue-explanation issue-explanation--${severity}`}>
      <div className="issue-explanation__header">
        <span className="issue-item__code">{issue.code}</span>
        <h5>{details.title}</h5>
      </div>
      <p>{details.explanation}</p>
      <div className="issue-explanation__detail">
        <strong>Bukti pemeriksaan</strong>
        <span>{details.evidence}</span>
      </div>
      <div className="issue-explanation__action">
        <strong>Yang perlu dilakukan</strong>
        <span>{details.action}</span>
      </div>
    </article>
  );
}
