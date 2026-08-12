import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { PacerParticipant } from '@/lib/types'
import { docToPacerParticipant, newId, normalizeEmail, nowIso, stripMongoId } from './utils'

type PacerParticipantDoc = PacerParticipant & { _id?: unknown }

// Dokumen lama (sebelum field pb_media_urls ditambahkan) tidak punya field ini di Mongo —
// default ke array kosong supaya konsumen (.length/.map) tidak crash.
function withMediaDefaults<T extends { media_urls?: string[]; pb_media_urls?: string[] }>(participant: T): T {
  return { ...participant, media_urls: participant.media_urls ?? [], pb_media_urls: participant.pb_media_urls ?? [] }
}

export async function findPacerParticipantById(id: string) {
  const db = await getDb()
  const doc = await db.collection<PacerParticipantDoc>('pacer_participants').findOne({ id })
  const participant = stripMongoId(doc) as PacerParticipant | null
  return participant ? withMediaDefaults(participant) : null
}

export async function findPacerParticipantByPacerId(pacerId: string) {
  const db = await getDb()
  const doc = await db.collection<PacerParticipantDoc>('pacer_participants').findOne({ pacer_id: pacerId })
  const participant = stripMongoId(doc) as PacerParticipant | null
  return participant ? withMediaDefaults(participant) : null
}

export async function findPacerParticipantWithPacerById(id: string) {
  const participant = await findPacerParticipantById(id)
  if (!participant) return null

  const db = await getDb()
  const pacer = await db.collection('pacer_registrations').findOne({ id: participant.pacer_id })
  if (!pacer) return { ...participant, pacer: null }

  return {
    ...participant,
    pacer: {
      name: pacer.name as string,
      pacer_code: pacer.pacer_code as string,
      status: pacer.status as 'pending' | 'approved' | 'rejected',
    },
  }
}

export async function listPacerParticipantsWithPacer() {
  const db = await getDb()
  const participants = await db.collection<PacerParticipantDoc>('pacer_participants').find({}).toArray()
  const pacerIds = [...new Set(participants.map((p) => p.pacer_id))]
  const pacers = await db.collection('pacer_registrations')
    .find({ id: { $in: pacerIds } })
    .toArray()
  const pacerMap = new Map(pacers.map((f) => [f.id as string, f]))

  return participants.map((participant) => {
    const pacer = pacerMap.get(participant.pacer_id)
    return {
      ...withMediaDefaults(docToPacerParticipant(stripMongoId(participant) as Record<string, unknown>)),
      pacer: pacer
        ? {
            id: pacer.id as string,
            name: pacer.name as string,
            email: pacer.email as string,
            phone: pacer.phone as string,
            category: pacer.category as string,
            pacer_code: pacer.pacer_code as string,
            provinsi: (pacer.provinsi as string | null) ?? null,
            kota: (pacer.kota as string | null) ?? null,
            kecamatan: (pacer.kecamatan as string | null) ?? null,
            status: pacer.status as 'pending' | 'approved' | 'rejected',
            status_note: (pacer.status_note as string | null) ?? null,
            created_at: pacer.created_at as string,
          }
        : null,
    }
  })
}

export async function createPacerParticipant(value: Omit<PacerParticipant, 'id' | 'created_at' | 'updated_at'>) {
  const db = await getDb()
  const timestamp = nowIso()
  const doc: PacerParticipant = {
    ...value,
    email: normalizeEmail(value.email),
    id: newId(),
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('pacer_participants').insertOne({ ...doc })
  return doc
}

export async function updatePacerParticipantById(id: string, values: Partial<PacerParticipant>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('pacer_participants').updateOne({ id }, { $set: { ...nextValues, updated_at: nowIso() } })
  return { success: true as const }
}
