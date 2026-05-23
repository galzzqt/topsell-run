import { createAdminClient } from '@/lib/supabase/server'
import { sendRacepackWebhook } from '@/lib/ghl/webhook'

type RacepackRegistration = {
  id: string
  total_participants: number
  community:
    | {
        id: string
        name: string
        leader_name: string
        email: string | null
        phone: string
        community_code: string
      }
    | {
        id: string
        name: string
        leader_name: string
        email: string | null
        phone: string
        community_code: string
      }[]
    | null
}

function getCommunity(registration: RacepackRegistration) {
  return Array.isArray(registration.community) ? registration.community[0] || null : registration.community
}

export async function sendRacepackWhatsappsForRegistration(registrationId: string) {
  const supabase = createAdminClient()
  const { data: registration, error } = await supabase
    .from('registrations')
    .select('id, total_participants, community:communities(id, name, leader_name, email, phone, community_code)')
    .eq('id', registrationId)
    .eq('status', 'paid')
    .single()

  if (error) {
    console.error('Failed to load registration for WhatsApp racepack:', error.message)
    return { skipped: false, sent: 0, failed: 0 }
  }

  const registrationRow = registration as RacepackRegistration
  const community = getCommunity(registrationRow)
  if (!community) {
    return { skipped: false, sent: 0, failed: 1 }
  }

  const { count: unsentCount, error: unsentError } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('registration_id', registrationId)
    .eq('payment_status', 'paid')
    .is('racepack_whatsapp_sent_at', null)

  if (unsentError) {
    console.error('Failed to check WhatsApp racepack status:', unsentError.message)
    return { skipped: false, sent: 0, failed: 0 }
  }

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

    await supabase
      .from('participants')
      .update({ racepack_whatsapp_sent_at: new Date().toISOString(), racepack_whatsapp_error: null })
      .eq('registration_id', registrationId)
      .eq('payment_status', 'paid')

    return { skipped: false, sent: 1, failed: 0 }
  } catch (sendError) {
    await supabase
      .from('participants')
      .update({ racepack_whatsapp_error: sendError instanceof Error ? sendError.message : 'Gagal mengirim WhatsApp ke komunitas' })
      .eq('registration_id', registrationId)
      .eq('payment_status', 'paid')

    return { skipped: false, sent: 0, failed: 1 }
  }
}
