import { NextRequest, NextResponse } from 'next/server'
import { listVouchers, createVoucher, updateVoucher, deleteVoucher } from '@/lib/db/vouchers'
import { getAdminSessionFromRequest } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req)
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const vouchers = await listVouchers()
  return NextResponse.json({ vouchers })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req)
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const {
      name, code, type, discountType, discountValue,
      maxUsage, validFrom, validUntil, packageKeys, allowedCategories,
    } = body

    if (!name || !validFrom || !validUntil) {
      return NextResponse.json({ error: 'Nama, validFrom, validUntil wajib diisi' }, { status: 400 })
    }
    if (type === 'code' && !code) {
      return NextResponse.json({ error: 'Kode voucher wajib diisi untuk tipe kode' }, { status: 400 })
    }

    const voucher = await createVoucher({
      name: name.trim(),
      code: type === 'code' ? (code as string).trim().toUpperCase() : '',
      type,
      discountType,
      discountValue: Number(discountValue),
      maxUsage: maxUsage ? Number(maxUsage) : 0,
      validFrom,
      validUntil,
      packages: packageKeys || [],
      categories: allowedCategories || [],
      enabled: true,
    })
    return NextResponse.json({ voucher })
  } catch (err) {
    console.error('Create voucher error:', err)
    return NextResponse.json({ error: 'Gagal membuat voucher' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req)
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { id, ...values } = body
    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 })

    // Remap packageKeys -> packages and allowedCategories -> categories for DB
    const { packageKeys, allowedCategories, ...rest } = values
    await updateVoucher(id, {
      ...rest,
      ...(packageKeys !== undefined ? { packages: packageKeys } : {}),
      ...(allowedCategories !== undefined ? { categories: allowedCategories } : {}),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update voucher error:', err)
    return NextResponse.json({ error: 'Gagal mengupdate voucher' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req)
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 })
    await deleteVoucher(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete voucher error:', err)
    return NextResponse.json({ error: 'Gagal menghapus voucher' }, { status: 500 })
  }
}
