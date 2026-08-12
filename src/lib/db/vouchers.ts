import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Voucher, VoucherPackageKey } from '@/lib/types/voucher'
import { nowIso } from './utils'

type VoucherDoc = Voucher & { _id?: unknown }

function stripId(doc: VoucherDoc | null): Voucher | null {
  if (!doc) return null
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc
  return rest as Voucher
}

export async function listVouchers(): Promise<Voucher[]> {
  const db = await getDb()
  const docs = await db.collection<VoucherDoc>('vouchers').find({}).sort({ created_at: -1 }).toArray()
  return docs.map((d) => stripId(d)!)
}

export async function findVoucherById(id: string): Promise<Voucher | null> {
  const db = await getDb()
  return stripId(await db.collection<VoucherDoc>('vouchers').findOne({ id }))
}

/**
 * Cari voucher kode yang valid untuk paket & kategori tertentu pada waktu sekarang.
 * Cek: enabled, dalam masa berlaku, kuota belum habis, paket cocok, kategori cocok.
 */
export async function findVoucherByCode(
  code: string,
  pkg: VoucherPackageKey,
  category: string,
  now: string,
): Promise<Voucher | null> {
  const db = await getDb()
  const doc = await db.collection<VoucherDoc>('vouchers').findOne({
    code: { $regex: new RegExp(`^${code}$`, 'i') }, // case-insensitive
    type: 'code',
    enabled: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    packages: pkg,
    $or: [
      { categories: { $size: 0 } },    // berlaku semua kategori
      { categories: category },          // berlaku kategori ini
    ],
    $expr: {
      $or: [
        { $eq: ['$maxUsage', 0] },       // tak terbatas
        { $lt: ['$usedCount', '$maxUsage'] },
      ],
    },
  })
  return stripId(doc)
}

/**
 * Cari semua voucher auto-apply yang valid untuk paket & kategori tertentu saat ini.
 * Kembalikan yang pertama (dengan diskon terbesar jika ada lebih dari satu).
 */
export async function findBestAutoVoucher(
  pkg: VoucherPackageKey,
  category: string,
  now: string,
): Promise<Voucher | null> {
  const db = await getDb()
  const docs = await db
    .collection<VoucherDoc>('vouchers')
    .find({
      type: 'auto',
      enabled: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      packages: pkg,
      $or: [{ categories: { $size: 0 } }, { categories: category }],
      $expr: {
        $or: [{ $eq: ['$maxUsage', 0] }, { $lt: ['$usedCount', '$maxUsage'] }],
      },
    })
    .sort({ discountValue: -1 }) // terbesar duluan
    .limit(1)
    .toArray()
  return stripId(docs[0] ?? null)
}

export async function createVoucher(
  input: Omit<Voucher, 'id' | 'usedCount' | 'created_at' | 'updated_at'>,
): Promise<Voucher> {
  const db = await getDb()
  const timestamp = nowIso()
  const voucher: Voucher = {
    ...input,
    id: crypto.randomUUID(),
    usedCount: 0,
    created_at: timestamp,
    updated_at: timestamp,
  }
  await db.collection('vouchers').insertOne({ ...voucher })
  return voucher
}

export async function updateVoucher(id: string, values: Partial<Omit<Voucher, 'id' | 'created_at'>>): Promise<void> {
  const db = await getDb()
  await db.collection('vouchers').updateOne(
    { id },
    { $set: { ...values, updated_at: nowIso() } },
  )
}

export async function deleteVoucher(id: string): Promise<void> {
  const db = await getDb()
  await db.collection('vouchers').deleteOne({ id })
}

/** Increment usedCount secara atomik. Aman untuk concurrent requests. */
export async function incrementVoucherUsage(id: string): Promise<void> {
  const db = await getDb()
  await db.collection('vouchers').updateOne(
    { id },
    { $inc: { usedCount: 1 }, $set: { updated_at: nowIso() } },
  )
}
