import {
  countUnsentInvitationRacepackWhatsapps,
  findPaidInvitationRegistrationWithInvitation,
  updateInvitationParticipants,
} from '@/lib/db'
import { sendInvitationRacepackWebhook } from '@/lib/ghl/webhook'

export async function sendInvitationRacepackWhatsappsForRegistration(registrationId: string) {
  const registrationRow = await findPaidInvitationRegistrationWithInvitation(registrationId)
  if (!registrationRow) {
    console.error('Failed to load invitation registration for WhatsApp racepack')
    return { skipped: false, sent: 0, failed: 0 }
  }

  const invitation = registrationRow.invitation
  if (!invitation) return { skipped: false, sent: 0, failed: 1 }

  const unsentCount = await countUnsentInvitationRacepackWhatsapps(registrationId)
  if (!unsentCount) return { skipped: true, sent: 0, failed: 0 }

  try {
    await sendInvitationRacepackWebhook({
      phone: invitation.phone,
      email: invitation.email || '',
      representativeName: invitation.leader_name,
      participantCount: registrationRow.total_participants,
      familyName: invitation.name,
      familyCode: invitation.invitation_code,
    })

    await updateInvitationParticipants(
      { registration_id: registrationId, payment_status: 'paid' },
      { racepack_whatsapp_sent_at: new Date().toISOString(), racepack_whatsapp_error: null }
    )
    return { skipped: false, sent: 1, failed: 0 }
  } catch (sendError) {
    await updateInvitationParticipants(
      { registration_id: registrationId, payment_status: 'paid' },
      { racepack_whatsapp_error: sendError instanceof Error ? sendError.message : 'Gagal mengirim WhatsApp ke peserta' }
    )
    return { skipped: false, sent: 0, failed: 1 }
  }
}
