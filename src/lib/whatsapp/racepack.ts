import {
  countUnsentRacepackWhatsapps,
  findPaidRegistrationWithCommunity,
  updateParticipants,
} from '@/lib/db'
import { sendRacepackWebhook } from '@/lib/ghl/webhook'

export async function sendRacepackWhatsappsForRegistration(registrationId: string) {
  const registrationRow = await findPaidRegistrationWithCommunity(registrationId)
  if (!registrationRow) {
    console.error('Failed to load registration for WhatsApp racepack')
    return { skipped: false, sent: 0, failed: 0 }
  }

  const community = registrationRow.community
  if (!community) {
    return { skipped: false, sent: 0, failed: 1 }
  }

  const unsentCount = await countUnsentRacepackWhatsapps(registrationId)
  if (!unsentCount) {
    return { skipped: true, sent: 0, failed: 0 }
  }

  try {
    await sendRacepackWebhook({
      phone: community.phone,
      email: community.email || '',
      leaderName: community.leader_name,
      participantCount: registrationRow.total_participants,
      communityName: community.name,
      communityCode: community.community_code,
    })

    await updateParticipants(
      { registration_id: registrationId, payment_status: 'paid' },
      { racepack_whatsapp_sent_at: new Date().toISOString(), racepack_whatsapp_error: null }
    )

    return { skipped: false, sent: 1, failed: 0 }
  } catch (sendError) {
    await updateParticipants(
      { registration_id: registrationId, payment_status: 'paid' },
      { racepack_whatsapp_error: sendError instanceof Error ? sendError.message : 'Gagal mengirim WhatsApp ke komunitas' }
    )

    return { skipped: false, sent: 0, failed: 1 }
  }
}
