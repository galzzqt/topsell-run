type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizePaymentMethod(value: string) {
  const method = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (!method) return null
  if (method === 'QR_CODE' || method === 'QR') return 'QRIS'
  return method
}

function collectPaymentMethodCandidates(value: unknown, candidates: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPaymentMethodCandidates(item, candidates))
    return candidates
  }

  if (!isRecord(value)) return candidates

  for (const key of ['channel_code', 'channelCode', 'channel', 'type', 'payment_channel', 'paymentChannel']) {
    const candidate = value[key]
    if (typeof candidate === 'string') candidates.push(candidate)
  }

  for (const key of ['payment_method', 'paymentMethod', 'virtual_account', 'qr_code', 'channel_properties', 'payment_details']) {
    collectPaymentMethodCandidates(value[key], candidates)
  }

  return candidates
}

function getString(value: JsonRecord, key: string) {
  const candidate = value[key]
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function extractStructuredPaymentMethod(value: unknown): string | null {
  if (!isRecord(value)) return null

  const paymentMethod = value.payment_method
  if (isRecord(paymentMethod)) {
    const type = normalizePaymentMethod(getString(paymentMethod, 'type') || '')

    if (type === 'QRIS') return 'QRIS'

    const virtualAccount = paymentMethod.virtual_account
    if (type === 'VIRTUAL_ACCOUNT' && isRecord(virtualAccount)) {
      const channel = normalizePaymentMethod(getString(virtualAccount, 'channel_code') || '')
      if (channel && channel !== 'VIRTUAL_ACCOUNT') {
        return channel.includes('VIRTUAL_ACCOUNT') ? channel : `${channel}_VIRTUAL_ACCOUNT`
      }
      return 'VIRTUAL_ACCOUNT'
    }

    const qrCode = paymentMethod.qr_code
    if (type === 'QRIS' || isRecord(qrCode)) return 'QRIS'
  }

  const data = value.data
  if (isRecord(data)) return extractStructuredPaymentMethod(data)

  return null
}

export function extractXenditPaymentMethod(payload: unknown) {
  const structuredMethod = extractStructuredPaymentMethod(payload)
  if (structuredMethod) return structuredMethod

  const candidates = collectPaymentMethodCandidates(payload)
    .map((candidate) => normalizePaymentMethod(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))

  return (
    candidates.find((candidate) => candidate.includes('VIRTUAL_ACCOUNT')) ||
    candidates.find((candidate) => candidate === 'QRIS') ||
    candidates.find((candidate) => candidate !== 'PAYMENT_LINK' && candidate !== 'PAY') ||
    null
  )
}

export function hasSpecificPaymentMethod(method: string | null | undefined) {
  if (!method) return false
  return !['xendit', 'xendit_demo', 'payment_link'].includes(method.toLowerCase())
}

export function extractXenditPaymentRequestId(payload: unknown): string | null {
  if (!isRecord(payload)) return null

  const direct = payload.payment_request_id
  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  const data = payload.data
  if (isRecord(data)) {
    const dataDirect = data.payment_request_id
    if (typeof dataDirect === 'string' && dataDirect.trim()) return dataDirect.trim()
  }

  const paymentRequests = payload.payment_requests
  if (Array.isArray(paymentRequests)) {
    for (const paymentRequest of paymentRequests) {
      if (!isRecord(paymentRequest)) continue
      const id = paymentRequest.id || paymentRequest.payment_request_id
      if (typeof id === 'string' && id.trim()) return id.trim()
    }
  }

  return null
}
