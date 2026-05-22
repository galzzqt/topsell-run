'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateRandomReference } from '@/lib/utils/format'
import { TOPSELL_RUN_EVENT } from '@/lib/types'
import { revalidatePath } from 'next/cache'

const XENDIT_SESSION_URL = 'https://api.xendit.co/sessions'
const DEFAULT_XENDIT_CHANNELS = [
  'BCA_VIRTUAL_ACCOUNT',
  'BNI_VIRTUAL_ACCOUNT',
  'BRI_VIRTUAL_ACCOUNT',
  'MANDIRI_VIRTUAL_ACCOUNT',
  'PERMATA_VIRTUAL_ACCOUNT',
  'QRIS',
]

function getXenditChannels() {
  return (process.env.XENDIT_ALLOWED_CHANNELS || DEFAULT_XENDIT_CHANNELS.join(','))
    .split(',')
    .map((channel) => channel.trim())
    .filter(Boolean)
}

function canUseReturnUrl(appUrl: string | undefined) {
  if (!appUrl) return false

  try {
    const url = new URL(appUrl)
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function getReturnUrls(paymentRef?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!canUseReturnUrl(appUrl)) return {}

  const refQuery = paymentRef ? `&ref=${encodeURIComponent(paymentRef)}` : ''
  return {
    success_return_url: `${appUrl}/dashboard?payment=success${refQuery}`,
    cancel_return_url: `${appUrl}/dashboard?payment=cancelled${refQuery}`,
  }
}

function toXenditReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'customer'
}

function toXenditName(value: string | null | undefined) {
  return (value || 'Komunitas').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50) || 'Komunitas'
}

async function updatePaymentAsAdmin(paymentId: string, values: Record<string, unknown>) {
  const admin = createAdminClient()
  return admin
    .from('payments')
    .update(values)
    .eq('id', paymentId)
    .select('id')
    .single()
}

async function deleteRegistrationAsAdmin(registrationId: string) {
  const admin = createAdminClient()
  return admin.from('registrations').delete().eq('id', registrationId)
}

// Create one collective payment for all pending participants under the logged-in community
export async function createCommunityPayment() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sesi habis. Silakan login kembali.' }

  // Fetch community profile
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch every pending participant under this community.
  const { data: participants, error: partError } = await supabase
    .from('participants')
    .select('*')
    .eq('community_id', user.id)
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: true })

  if (partError || !participants || participants.length === 0) {
    return { error: 'Tidak ada peserta yang perlu dibayar.' }
  }

  const participantIds = participants.map((participant) => participant.id)

  const totalAmount = participants.length * TOPSELL_RUN_EVENT.price_per_participant
  const paymentRefRaw = generateRandomReference('TSR')
  const paymentRef = toXenditReference(paymentRefRaw)

  // Create registration record
  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .insert({
      community_id: user.id,
      total_participants: participants.length,
      total_amount: totalAmount,
      status: 'pending',
    })
    .select()
    .single()

  if (regError || !registration) {
    return { error: 'Gagal membuat registrasi: ' + (regError?.message || 'Data kosong') }
  }

  // Link participants to this registration
  const { error: linkError } = await supabase
    .from('participants')
    .update({ registration_id: registration.id })
    .in('id', participantIds)

  if (linkError) {
    await deleteRegistrationAsAdmin(registration.id)
    return { error: 'Gagal menautkan peserta ke registrasi.' }
  }

  // Create payment record
  const { data: payment, error: payError } = await supabase
    .from('payments')
    .insert({
      registration_id: registration.id,
      amount: totalAmount,
      payment_reference: paymentRef,
      status: 'pending',
    })
    .select()
    .single()

  if (payError || !payment) {
    await deleteRegistrationAsAdmin(registration.id)
    return { error: 'Gagal membuat invoice pembayaran.' }
  }

  // --- Xendit Payment Session Integration ---
  const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''

  let checkoutUrl: string | null = null
  let xenditSessionId: string | null = null
  let isDemoMode = false

  if (!xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')) {
    isDemoMode = true
    checkoutUrl = null
    xenditSessionId = 'demo-xendit-session-' + Math.random().toString(36).substring(2, 15)
  } else {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')

      const res = await fetch(XENDIT_SESSION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          reference_id: paymentRef,
          session_type: 'PAY',
          currency: 'IDR',
          amount: totalAmount,
          country: 'ID',
          mode: 'PAYMENT_LINK',
          capture_method: 'AUTOMATIC',
          allowed_payment_channels: getXenditChannels(),
          description: `TOPSELL RUN 6K - ${participants.length} peserta`,
          customer: {
            reference_id: toXenditReference(user.id),
            type: 'INDIVIDUAL',
            individual_detail: {
              given_names: toXenditName(community?.leader_name || community?.name),
            },
            email: user.email || undefined,
          },
          items: participants.map((p) => ({
            reference_id: p.id,
            type: 'DIGITAL_PRODUCT',
            category: 'EVENT_TICKET',
            name: `TOPSELL RUN 6K - ${p.full_name.substring(0, 40)}`,
            quantity: 1,
            net_unit_amount: TOPSELL_RUN_EVENT.price_per_participant,
            currency: 'IDR',
          })),
          ...getReturnUrls(paymentRef),
        }),
      })

      if (res.ok) {
        const xenditData = await res.json()
        xenditSessionId = xenditData.payment_session_id || xenditData.id || null
        checkoutUrl = xenditData.payment_link_url || null
      } else {
        const errorText = await res.text()
        console.error('Xendit error:', res.status, errorText)
        await deleteRegistrationAsAdmin(registration.id)
        return { error: `Gagal membuat checkout Xendit: ${errorText}` }
      }
    } catch (err) {
      console.error('Xendit API failed:', err)
      await deleteRegistrationAsAdmin(registration.id)
      return { error: 'Gagal menghubungi Xendit. Periksa koneksi server dan konfigurasi XENDIT_SECRET_KEY.' }
    }
  }

  // Save Xendit session data to payment record
  const { error: metadataError } = await updatePaymentAsAdmin(payment.id, {
    payment_method: isDemoMode ? 'xendit_demo' : 'xendit',
    snap_token: checkoutUrl,
    provider: 'xendit',
    xendit_session_id: xenditSessionId,
    checkout_url: checkoutUrl,
  })

  if (metadataError) {
    await deleteRegistrationAsAdmin(registration.id)
    return { error: 'Gagal menyimpan data checkout Xendit: ' + metadataError.message }
  }

  revalidatePath('/dashboard')

  return {
    success: true,
    paymentId: payment.id,
    registrationId: registration.id,
    checkoutUrl,
    xenditSessionId,
    isDemoMode,
    amount: totalAmount,
    reference: paymentRef,
    participantCount: participants.length,
  }
}

export async function createCollectivePayment() {
  return createCommunityPayment()
}

// Simulate successful payment (Demo Mode only)
export async function simulatePaymentSuccess(paymentId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sesi habis. Silakan login kembali.' }

  // Verify payment belongs to this community via registration
  const { data: payment } = await supabase
    .from('payments')
    .select('*, registration:registrations(community_id)')
    .eq('id', paymentId)
    .single()

  if (!payment) return { error: 'Invoice tidak ditemukan.' }
  if (payment.registration?.community_id !== user.id) return { error: 'Tidak memiliki akses.' }

  const { error } = await updatePaymentAsAdmin(paymentId, {
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_method: 'xendit_demo',
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

function isXenditPaidStatus(status: unknown) {
  const value = typeof status === 'string' ? status.toUpperCase() : ''
  return value === 'SUCCEEDED' || value === 'COMPLETED' || value === 'PAID' || value === 'SETTLED' || value === 'SUCCESS'
}

export async function syncXenditPaymentStatus(paymentReference: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sesi habis. Silakan login kembali.' }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*, registration:registrations(community_id)')
    .eq('payment_reference', paymentReference)
    .single()

  if (paymentError || !payment) return { error: 'Invoice tidak ditemukan.' }
  if (payment.registration?.community_id !== user.id) return { error: 'Tidak memiliki akses.' }
  if (payment.status === 'paid') return { success: true, status: 'paid' as const }

  const sessionId = payment.xendit_session_id
  if (!sessionId) return { error: 'Session Xendit belum tersimpan.' }

  const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
  if (!xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')) {
    return { error: 'XENDIT_SECRET_KEY belum diisi.' }
  }

  const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')
  const res = await fetch(`${XENDIT_SESSION_URL}/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: authHeader },
  })

  if (!res.ok) {
    const errorText = await res.text()
    return { error: `Gagal cek status Xendit: ${errorText}` }
  }

  const xenditData = await res.json()
  if (!isXenditPaidStatus(xenditData?.status)) {
    return { success: true, status: xenditData?.status || 'UNKNOWN' }
  }

  const { error: updateError } = await updatePaymentAsAdmin(payment.id, {
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_method: 'xendit',
  })

  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard')
  return { success: true, status: 'paid' as const }
}
