import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { UmkmRegistration, UmkmPayment } from '@/lib/types'
import type { PasswordRecord } from '@/lib/auth/password'
import { newId, normalizeEmail, nowIso, stripMongoId } from './utils'
import { randomBytes } from 'crypto'

type UmkmDoc = UmkmRegistration & { _id?: unknown }
type UmkmPaymentDoc = UmkmPayment & { _id?: unknown }

function generateUmkmCode() {
  return `UMKM-${randomBytes(3).toString('hex').toUpperCase()}`
}

export async function createUniqueUmkmCode() {
  const db = await getDb()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateUmkmCode()
    const existing = await db.collection('umkm_registrations').findOne({ umkm_code: code })
    if (!existing) return code
  }
  throw new Error('Gagal membuat kode UMKM unik.')
}

// ─── UMKM Registration ────────────────────────────────────────────────────────

export async function findUmkmById(id: string) {
  const db = await getDb()
  const doc = await db.collection<UmkmDoc>('umkm_registrations').findOne({ id })
  return stripMongoId(doc) as UmkmRegistration | null
}

export async function findUmkmByPhone(phone: string) {
  const db = await getDb()
  const doc = await db.collection<UmkmDoc>('umkm_registrations').findOne({ phone })
  return stripMongoId(doc) as UmkmRegistration | null
}

export async function findUmkmByEmail(email: string) {
  const db = await getDb()
  const escaped = normalizeEmail(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const doc = await db.collection<UmkmDoc>('umkm_registrations').findOne({
    email: { $regex: new RegExp(`^${escaped}$`, 'i') },
  })
  return stripMongoId(doc) as UmkmRegistration | null
}

export async function findUmkmByPhoneExcept(phone: string, excludeId: string) {
  const db = await getDb()
  const doc = await db.collection<UmkmDoc>('umkm_registrations').findOne({ phone, id: { $ne: excludeId } })
  return stripMongoId(doc) as UmkmRegistration | null
}

export async function createUmkm(input: {
  name: string
  pic_name: string
  email: string
  phone: string
  business_field: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  address?: string | null
  description: string | null
  social_media?: string | null
  photo_urls?: string[]
  voucher_code?: string | null
  voucher_discount?: number
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const umkm: UmkmRegistration = {
    id,
    name: input.name,
    pic_name: input.pic_name,
    email: normalizeEmail(input.email),
    phone: input.phone,
    business_field: input.business_field,
    description: input.description,
    social_media: input.social_media ?? null,
    photo_urls: input.photo_urls ?? [],
    umkm_code: await createUniqueUmkmCode(),
    provinsi: input.provinsi,
    kota: input.kota,
    kecamatan: input.kecamatan,
    address: input.address ?? null,
    status: 'pending',
    status_note: null,
    reviewed_at: null,
    email_verified: false,
    verification_token: null,
    verification_token_expires: null,
    verification_sent_at: null,
    voucher_code: input.voucher_code ?? null,
    voucher_discount: input.voucher_discount ?? 0,
    payment_amount: 500000,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('umkm_registrations').insertOne({ ...umkm })
  return umkm
}

export async function updateUmkm(id: string, values: Partial<UmkmRegistration>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('umkm_registrations').updateOne({ id }, { $set: { ...nextValues, updated_at: nowIso() } })
}

export async function deleteUmkm(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('umkm_registrations').deleteOne({ id }),
    db.collection('umkm_auth').deleteOne({ id }),
    db.collection('umkm_payments').deleteMany({ umkm_id: id }),
  ])
}

export async function listUmkms() {
  const db = await getDb()
  const docs = await db.collection<UmkmDoc>('umkm_registrations').find({}).sort({ created_at: -1 }).toArray()
  return docs.map((doc) => stripMongoId(doc) as UmkmRegistration)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function saveUmkmAuth(id: string, phone: string, password: PasswordRecord) {
  const db = await getDb()
  const timestamp = nowIso()
  await db.collection('umkm_auth').updateOne(
    { id },
    {
      $set: { id, phone, ...password, updated_at: timestamp },
      $setOnInsert: { created_at: timestamp },
    },
    { upsert: true }
  )
}

export async function findUmkmAuthByPhone(phone: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('umkm_auth').findOne({ phone })
}

export async function findUmkmAuthById(id: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('umkm_auth').findOne({ id })
}

export async function updateUmkmAuthPassword(id: string, password: PasswordRecord) {
  const db = await getDb()
  await db.collection('umkm_auth').updateOne({ id }, { $set: { ...password, updated_at: nowIso() } })
}

// ─── Email Verification ───────────────────────────────────────────────────────

export async function setUmkmVerificationToken(umkmId: string, token: string, expiresAt: Date) {
  const db = await getDb()
  await db.collection('umkm_registrations').updateOne(
    { id: umkmId },
    {
      $set: {
        verification_token: token,
        verification_token_expires: expiresAt.toISOString(),
        verification_sent_at: nowIso(),
        updated_at: nowIso(),
      },
    }
  )
}

export async function findUmkmByVerificationToken(token: string) {
  const db = await getDb()
  const doc = await db.collection<UmkmDoc>('umkm_registrations').findOne({ verification_token: token })
  return stripMongoId(doc) as UmkmRegistration | null
}

export async function verifyUmkmEmail(umkmId: string) {
  const db = await getDb()
  await db.collection('umkm_registrations').updateOne(
    { id: umkmId },
    {
      $set: {
        email_verified: true,
        verification_token: null,
        verification_token_expires: null,
        updated_at: nowIso(),
      },
    }
  )
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function createUmkmPayment(input: {
  umkm_id: string
  amount: number
  payment_reference: string
  xendit_session_id?: string | null
  checkout_url?: string | null
  status?: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  payment_method?: string | null
  paid_at?: string | null
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const payment: UmkmPayment = {
    id,
    umkm_id: input.umkm_id,
    amount: input.amount,
    payment_method: input.payment_method ?? null,
    payment_reference: input.payment_reference,
    xendit_session_id: input.xendit_session_id ?? null,
    checkout_url: input.checkout_url ?? null,
    status: input.status ?? 'pending',
    paid_at: input.paid_at ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  }
  await db.collection('umkm_payments').insertOne({ ...payment })
  return payment
}

export async function findUmkmPaymentByUmkmId(umkm_id: string) {
  const db = await getDb()
  const doc = await db.collection<UmkmPaymentDoc>('umkm_payments').findOne({ umkm_id })
  return stripMongoId(doc) as UmkmPayment | null
}

export async function findUmkmPaymentById(id: string) {
  const db = await getDb()
  const doc = await db.collection<UmkmPaymentDoc>('umkm_payments').findOne({ id })
  return stripMongoId(doc) as UmkmPayment | null
}

export async function findUmkmPaymentByReference(payment_reference: string) {
  const db = await getDb()
  const doc = await db.collection<UmkmPaymentDoc>('umkm_payments').findOne({ payment_reference })
  return stripMongoId(doc) as UmkmPayment | null
}

export async function updateUmkmPayment(id: string, values: Partial<UmkmPayment>) {
  const db = await getDb()
  await db.collection('umkm_payments').updateOne({ id }, { $set: { ...values, updated_at: nowIso() } })
}

export async function markUmkmPaymentPaid(
  idOrRef: string,
  update: { paid_at: string; payment_method: string | null }
) {
  const db = await getDb()
  const payment = await db.collection<UmkmPaymentDoc>('umkm_payments').findOne({
    $or: [{ id: idOrRef }, { payment_reference: idOrRef }, { xendit_session_id: idOrRef }],
  })
  if (!payment) return null
  await db.collection('umkm_payments').updateOne(
    { id: payment.id },
    { $set: { status: 'paid', ...update, updated_at: nowIso() } }
  )
  // Also mark the umkm registration as paid
  await db.collection('umkm_registrations').updateOne(
    { id: payment.umkm_id },
    { $set: { payment_status: 'paid', updated_at: nowIso() } }
  )
  return payment
}

export async function markUmkmPaymentsPaidBySessionId(
  sessionId: string,
  update: { paid_at: string; payment_method: string | null }
) {
  const db = await getDb()
  const payments = await db
    .collection<UmkmPaymentDoc>('umkm_payments')
    .find({ xendit_session_id: sessionId, status: { $ne: 'paid' } })
    .toArray()
  for (const p of payments) {
    await db.collection('umkm_payments').updateOne(
      { id: p.id },
      { $set: { status: 'paid', ...update, updated_at: nowIso() } }
    )
    await db.collection('umkm_registrations').updateOne(
      { id: p.umkm_id },
      { $set: { payment_status: 'paid', updated_at: nowIso() } }
    )
  }
  return payments.map((p) => stripMongoId(p) as UmkmPayment)
}

export async function markUmkmPaymentsPaidByReference(
  reference: string,
  update: { paid_at: string; payment_method: string | null }
) {
  const db = await getDb()
  const payments = await db
    .collection<UmkmPaymentDoc>('umkm_payments')
    .find({ payment_reference: reference, status: { $ne: 'paid' } })
    .toArray()
  for (const p of payments) {
    await db.collection('umkm_payments').updateOne(
      { id: p.id },
      { $set: { status: 'paid', ...update, updated_at: nowIso() } }
    )
    await db.collection('umkm_registrations').updateOne(
      { id: p.umkm_id },
      { $set: { payment_status: 'paid', updated_at: nowIso() } }
    )
  }
  return payments.map((p) => stripMongoId(p) as UmkmPayment)
}

export async function markUmkmPaymentFailed(id: string) {
  const db = await getDb()
  await db.collection('umkm_payments').updateOne({ id }, { $set: { status: 'failed', updated_at: nowIso() } })
}

export async function markUmkmPaymentExpired(id: string) {
  const db = await getDb()
  await db.collection('umkm_payments').updateOne({ id }, { $set: { status: 'expired', updated_at: nowIso() } })
}

export async function listUmkmPayments() {
  const db = await getDb()
  const docs = await db.collection<UmkmPaymentDoc>('umkm_payments').find({}).sort({ created_at: -1 }).toArray()
  return docs.map((doc) => stripMongoId(doc) as UmkmPayment)
}
