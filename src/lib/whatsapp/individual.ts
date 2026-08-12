import {
  countUnsentIndividualRacepackWhatsapps,
  findPaidIndividualRegistrationWithIndividual,
  updateIndividualParticipants,
} from '@/lib/db'
import { sendIndividualRacepackWebhook } from '@/lib/ghl/webhook'

export async function sendIndividualRacepackWhatsappsForRegistration(registrationId: string) {
  const registrationRow = await findPaidIndividualRegistrationWithIndividual(registrationId)
  if (!registrationRow) {
    console.error('Failed to load individual registration for WhatsApp racepack')
    return { skipped: false, sent: 0, failed: 0 }
  }

  const individual = registrationRow.individual
  if (!individual) return { skipped: false, sent: 0, failed: 1 }

  const unsentCount = await countUnsentIndividualRacepackWhatsapps(registrationId)
  if (!unsentCount) return { skipped: true, sent: 0, failed: 0 }

  try {
    await sendIndividualRacepackWebhook({
      phone: individual.phone,
      email: individual.email || '',
      representativeName: individual.leader_name,
      participantCount: registrationRow.total_participants,
      familyName: individual.name,
      familyCode: individual.individual_code,
    })

    await updateIndividualParticipants(
      { registration_id: registrationId, payment_status: 'paid' },
      { racepack_whatsapp_sent_at: new Date().toISOString(), racepack_whatsapp_error: null }
    )
    return { skipped: false, sent: 1, failed: 0 }
  } catch (sendError) {
    await updateIndividualParticipants(
      { registration_id: registrationId, payment_status: 'paid' },
      { racepack_whatsapp_error: sendError instanceof Error ? sendError.message : 'Gagal mengirim WhatsApp ke peserta' }
    )
    return { skipped: false, sent: 0, failed: 1 }
  }
}
