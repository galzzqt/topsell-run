'use server'

import { ParticipantFormValues } from '@/lib/validations/participant'

export async function addParticipant(values: ParticipantFormValues) {
  void values
  return { error: 'Peserta hanya dapat dibuat saat pendaftaran awal. Dashboard hanya mendukung edit data peserta.' }
}

export async function addParticipantsBatch(rows: ParticipantFormValues[]) {
  void rows
  return { error: 'Peserta hanya dapat dibuat saat pendaftaran awal. Dashboard hanya mendukung edit data peserta.' }
}

export async function updateParticipant(participantId: string, values: ParticipantFormValues) {
  void participantId
  void values
  return { error: 'Data peserta hanya dapat diedit oleh admin.' }
}

export async function deleteParticipant(participantId: string) {
  void participantId
  return { error: 'Peserta tidak dapat dihapus dari dashboard komunitas.' }
}
