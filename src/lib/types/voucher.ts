// ==========================================
// VOUCHER — Tipe & Konstanta
// ==========================================

export type VoucherType = 'auto' | 'code'
export type DiscountType = 'percent' | 'flat'
export type VoucherPackageKey = 'community' | 'family' | 'individual'

export interface Voucher {
  id: string
  /** Kode unik yang diketikkan user. Kosong ('') untuk voucher auto-apply. */
  code: string
  /** Label internal untuk admin (mis. "Early Bird Juli 2026"). */
  name: string
  type: VoucherType
  discountType: DiscountType
  /** Nilai diskon: angka persentase (mis. 20 = 20%) atau nominal Rp (mis. 30000). */
  discountValue: number
  /** Batas maksimal pemakaian. 0 = tidak terbatas. */
  maxUsage: number
  /** Jumlah pemakaian saat ini (auto-increment via incrementVoucherUsage). */
  usedCount: number
  /** ISO datetime 'YYYY-MM-DDTHH:mm'; mulai berlaku. */
  validFrom: string
  /** ISO datetime 'YYYY-MM-DDTHH:mm'; berakhir. */
  validUntil: string
  /** Paket yang berhak menggunakan voucher ini. */
  packages: VoucherPackageKey[]
  /**
   * Kategori yang berhak mendapat diskon.
   * Kosong ([]) = berlaku untuk semua kategori di paket-paket terpilih.
   * Isi dengan category value (mis. ['3K 99.000', '6K 149.000']).
   */
  categories: string[]
  enabled: boolean
  created_at: string
  updated_at: string
}

/** Hasil validasi voucher yang dikembalikan API. */
export interface VoucherValidation {
  valid: boolean
  /** Nama/label voucher untuk ditampilkan ke user. */
  name?: string
  discountType?: DiscountType
  discountValue?: number
  /** Potongan harga dalam Rp (sudah dihitung dari basePrice). */
  finalDiscount: number
  /** Pesan error jika valid = false. */
  error?: string
}

/** State voucher yang sudah di-apply di form. */
export interface AppliedVoucher {
  code: string
  name: string
  discountType: DiscountType
  discountValue: number
  finalDiscount: number
}

/** MongoDB document representation of a Voucher (may use _id or id). */
export type VoucherDoc = Voucher & { _id?: string }
