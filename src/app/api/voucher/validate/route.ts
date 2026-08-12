import { NextRequest, NextResponse } from 'next/server'
import { findVoucherByCode, findBestAutoVoucher } from '@/lib/db'
import type { VoucherPackageKey, VoucherValidation } from '@/lib/types/voucher'

function calcDiscount(
  discountType: 'percent' | 'flat',
  discountValue: number,
  basePrice: number,
): number {
  if (discountType === 'percent') {
    return Math.round((basePrice * discountValue) / 100)
  }
  return Math.min(discountValue, basePrice) // flat tidak boleh melebihi harga asli
}

/**
 * GET /api/voucher/validate
 * Query params:
 *   code      — kode voucher (wajib jika type=code; gunakan 'AUTO' untuk auto-apply)
 *   pkg       — 'community' | 'family' | 'individual'
 *   category  — nilai kategori, mis. '6K 149.000'
 *   basePrice — harga dasar dalam Rp (integer)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code      = (searchParams.get('code') || '').trim()
  const pkg       = (searchParams.get('pkg') || '') as VoucherPackageKey
  const category  = (searchParams.get('category') || '').trim()
  const basePrice = parseInt(searchParams.get('basePrice') || '0', 10)

  if (!pkg || !['community', 'family', 'individual'].includes(pkg)) {
    return NextResponse.json<VoucherValidation>(
      { valid: false, finalDiscount: 0, error: 'Parameter pkg tidak valid.' },
      { status: 400 },
    )
  }

  if (isNaN(basePrice) || basePrice <= 0) {
    return NextResponse.json<VoucherValidation>(
      { valid: false, finalDiscount: 0, error: 'basePrice harus berupa angka positif.' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm

  try {
    // Auto-apply mode (tidak ada kode / kode = 'AUTO')
    if (!code || code.toUpperCase() === 'AUTO') {
      const voucher = await findBestAutoVoucher(pkg, category, now)
      if (!voucher) {
        return NextResponse.json<VoucherValidation>({ valid: false, finalDiscount: 0 })
      }
      const finalDiscount = calcDiscount(voucher.discountType, voucher.discountValue, basePrice)
      return NextResponse.json<VoucherValidation>({
        valid: true,
        name: voucher.name,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        finalDiscount,
      })
    }

    // Kode mode
    if (!category) {
      return NextResponse.json<VoucherValidation>(
        { valid: false, finalDiscount: 0, error: 'Pilih kategori terlebih dahulu.' },
        { status: 400 },
      )
    }

    const voucher = await findVoucherByCode(code, pkg, category, now)
    if (!voucher) {
      return NextResponse.json<VoucherValidation>({
        valid: false,
        finalDiscount: 0,
        error: 'Kode voucher tidak valid, sudah berakhir, atau tidak berlaku untuk kategori/paket ini.',
      })
    }

    const finalDiscount = calcDiscount(voucher.discountType, voucher.discountValue, basePrice)
    return NextResponse.json<VoucherValidation>({
      valid: true,
      name: voucher.name,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      finalDiscount,
    })
  } catch (err) {
    console.error('[Voucher Validate] Error:', err)
    return NextResponse.json<VoucherValidation>(
      { valid: false, finalDiscount: 0, error: 'Terjadi kesalahan server.' },
      { status: 500 },
    )
  }
}
