import {
  countUnsentRacepackWhatsapps,
  findPaidRegistrationWithCommunity,
  updateParticipants,
  countUnsentFamilyRacepackWhatsapps,
  findPaidFamilyRegistrationWithFamily,
  updateFamilyParticipants,
} from '@/lib/db'
import { sendRacepackWebhook, sendFamilyRacepackWebhook } from '@/lib/ghl/webhook'

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

export async function sendFamilyRacepackWhatsappsForRegistration(registrationId: string) {
  const registrationRow = await findPaidFamilyRegistrationWithFamily(registrationId)
  if (!registrationRow) {
    console.error('Failed to load family registration for WhatsApp racepack')
    return { skipped: false, sent: 0, failed: 0 }
  }

  const family = registrationRow.family
  if (!family) {
    return { skipped: false, sent: 0, failed: 1 }
  }

  const unsentCount = await countUnsentFamilyRacepackWhatsapps(registrationId)
  if (!unsentCount) {
    return { skipped: true, sent: 0, failed: 0 }
  }

  try {
    await sendFamilyRacepackWebhook({
      phone: family.phone,
      email: family.email || '',
      representativeName: family.leader_name,
      participantCount: registrationRow.total_participants,
      familyName: family.name,
      familyCode: family.family_code,
    })

    await updateFamilyParticipants(
      { registration_id: registrationId, payment_status: 'paid' },
      { racepack_whatsapp_sent_at: new Date().toISOString(), racepack_whatsapp_error: null }
    )

    return { skipped: false, sent: 1, failed: 0 }
  } catch (sendError) {
    await updateFamilyParticipants(
      { registration_id: registrationId, payment_status: 'paid' },
      { racepack_whatsapp_error: sendError instanceof Error ? sendError.message : 'Gagal mengirim WhatsApp ke keluarga' }
    )

    return { skipped: false, sent: 0, failed: 1 }
  }
}
