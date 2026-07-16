import 'server-only'

import { getDb } from '@/lib/mongodb/client'

const DASHBOARD_TIME_ZONE = 'Asia/Jakarta'
const DAYS_TO_SHOW = 14
const DAY_IN_MS = 24 * 60 * 60 * 1000

export type AdminDashboardStats = {
  communities: number
  participants: number
  paidParticipants: number
  pendingParticipants: number
  racepacksPickedUp: number
  revenue: number
}

export type AdminDashboardDailyMetric = {
  dateKey: string
  label: string
  participants: number
  paidParticipants: number
  revenue: number
}

export type AdminDashboardSummary = {
  stats: AdminDashboardStats
  daily: AdminDashboardDailyMetric[]
  updatedAt: string
}

type ParticipantSummaryDoc = {
  created_at?: string
}

type PaymentSummaryDoc = {
  registration_id?: string
  amount?: number
  paid_at?: string | null
  created_at?: string
}

type RegistrationSummaryDoc = {
  id?: string
  total_participants?: number
}

function getDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  }
}

function toDateKey(date: Date) {
  const { year, month, day } = getDateParts(date, DASHBOARD_TIME_ZONE)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function createDailyMetrics(now: Date) {
  const { year, month, day } = getDateParts(now, DASHBOARD_TIME_ZONE)
  const todayAnchor = Date.UTC(year, month - 1, day)
  const labelFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  })

  const daily: AdminDashboardDailyMetric[] = []
  for (let offset = DAYS_TO_SHOW - 1; offset >= 0; offset -= 1) {
    const date = new Date(todayAnchor - offset * DAY_IN_MS)
    daily.push({
      dateKey: date.toISOString().slice(0, 10),
      label: labelFormatter.format(date),
      participants: 0,
      paidParticipants: 0,
      revenue: 0,
    })
  }

  return daily
}

function addParticipantCounts(
  documents: ParticipantSummaryDoc[],
  metricsByDate: Map<string, AdminDashboardDailyMetric>
) {
  for (const document of documents) {
    if (!document.created_at) continue
    const createdAt = new Date(document.created_at)
    if (Number.isNaN(createdAt.getTime())) continue
    const metric = metricsByDate.get(toDateKey(createdAt))
    if (metric) metric.participants += 1
  }
}

function addPaymentCounts(
  packageType: 'community' | 'family',
  payments: PaymentSummaryDoc[],
  registrations: Map<string, RegistrationSummaryDoc>,
  metricsByDate: Map<string, AdminDashboardDailyMetric>,
  countedRegistrations: Set<string>
) {
  for (const payment of payments) {
    const paidAtValue = payment.paid_at || payment.created_at
    if (!paidAtValue) continue

    const paidAt = new Date(paidAtValue)
    if (Number.isNaN(paidAt.getTime())) continue

    const metric = metricsByDate.get(toDateKey(paidAt))
    if (!metric) continue

    metric.revenue += Number(payment.amount) || 0

    if (!payment.registration_id) continue
    const registrationKey = `${packageType}:${payment.registration_id}`
    if (countedRegistrations.has(registrationKey)) continue

    const registration = registrations.get(payment.registration_id)
    metric.paidParticipants += Number(registration?.total_participants) || 0
    countedRegistrations.add(registrationKey)
  }
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const db = await getDb()

  const [
    communityCount,
    familyCount,
    participantCount,
    familyParticipantCount,
    paidParticipantCount,
    paidFamilyParticipantCount,
    pendingParticipantCount,
    pendingFamilyParticipantCount,
    racepackCount,
    familyRacepackCount,
    participantDocuments,
    familyParticipantDocuments,
    paidPayments,
    paidFamilyPayments,
  ] = await Promise.all([
    db.collection('communities').countDocuments(),
    db.collection('families').countDocuments(),
    db.collection('participants').countDocuments(),
    db.collection('family_participants').countDocuments(),
    db.collection('participants').countDocuments({ payment_status: 'paid' }),
    db.collection('family_participants').countDocuments({ payment_status: 'paid' }),
    db.collection('participants').countDocuments({ payment_status: 'pending' }),
    db.collection('family_participants').countDocuments({ payment_status: 'pending' }),
    db.collection('participants').countDocuments({ checked_in: true }),
    db.collection('family_participants').countDocuments({ checked_in: true }),
    db.collection<ParticipantSummaryDoc>('participants')
      .find({}, { projection: { _id: 0, created_at: 1 } })
      .toArray(),
    db.collection<ParticipantSummaryDoc>('family_participants')
      .find({}, { projection: { _id: 0, created_at: 1 } })
      .toArray(),
    db.collection<PaymentSummaryDoc>('payments')
      .find({ status: 'paid' }, { projection: { _id: 0, registration_id: 1, amount: 1, paid_at: 1, created_at: 1 } })
      .toArray(),
    db.collection<PaymentSummaryDoc>('family_payments')
      .find({ status: 'paid' }, { projection: { _id: 0, registration_id: 1, amount: 1, paid_at: 1, created_at: 1 } })
      .toArray(),
  ])

  const communityRegistrationIds = paidPayments
    .map((payment) => payment.registration_id)
    .filter((id): id is string => Boolean(id))
  const familyRegistrationIds = paidFamilyPayments
    .map((payment) => payment.registration_id)
    .filter((id): id is string => Boolean(id))

  const [communityRegistrations, familyRegistrations] = await Promise.all([
    db.collection<RegistrationSummaryDoc>('registrations')
      .find({ id: { $in: communityRegistrationIds } }, { projection: { _id: 0, id: 1, total_participants: 1 } })
      .toArray(),
    db.collection<RegistrationSummaryDoc>('family_registrations')
      .find({ id: { $in: familyRegistrationIds } }, { projection: { _id: 0, id: 1, total_participants: 1 } })
      .toArray(),
  ])

  const daily = createDailyMetrics(new Date())
  const metricsByDate = new Map(daily.map((metric) => [metric.dateKey, metric]))
  const communityRegistrationMap = new Map<string, RegistrationSummaryDoc>()
  for (const registration of communityRegistrations) {
    if (registration.id) communityRegistrationMap.set(registration.id, registration)
  }

  const familyRegistrationMap = new Map<string, RegistrationSummaryDoc>()
  for (const registration of familyRegistrations) {
    if (registration.id) familyRegistrationMap.set(registration.id, registration)
  }

  addParticipantCounts(participantDocuments, metricsByDate)
  addParticipantCounts(familyParticipantDocuments, metricsByDate)

  const countedRegistrations = new Set<string>()
  addPaymentCounts('community', paidPayments, communityRegistrationMap, metricsByDate, countedRegistrations)
  addPaymentCounts('family', paidFamilyPayments, familyRegistrationMap, metricsByDate, countedRegistrations)

  return {
    stats: {
      communities: communityCount + familyCount,
      participants: participantCount + familyParticipantCount,
      paidParticipants: paidParticipantCount + paidFamilyParticipantCount,
      pendingParticipants: pendingParticipantCount + pendingFamilyParticipantCount,
      racepacksPickedUp: racepackCount + familyRacepackCount,
      revenue:
        paidPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) +
        paidFamilyPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
    },
    daily,
    updatedAt: new Date().toISOString(),
  }
}
