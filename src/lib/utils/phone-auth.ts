export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

export function phoneToAuthEmail(phone: string) {
  return `${normalizePhone(phone)}@phone.topsell-run.com`
}

export function phoneToWhatsAppId(phone: string) {
  const normalized = normalizePhone(phone)
  if (normalized.startsWith('0')) return `62${normalized.slice(1)}`
  return normalized
}
