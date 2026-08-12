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

export type AdminDashboardPackageKey = 'community' | 'family' | 'individual'

export type AdminDashboardPackageSummary = {
  label: string
  stats: AdminDashboardStats
  daily: AdminDashboardDailyMetric[]
}

export type AdminDashboardSummary = {
  stats: AdminDashboardStats
  daily: AdminDashboardDailyMetric[]
  byPackage: Record<AdminDashboardPackageKey, AdminDashboardPackageSummary>
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
  packageType: 'community' | 'family' | 'individual',
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

  // Registrasi dengan payment berstatus 'testing' dikecualikan total dari Ringkasan — itu cuma data uji, bukan data real.
  const [communityTestingDocs, familyTestingDocs, individualTestingDocs] = await Promise.all([
    db.collection<PaymentSummaryDoc>('payments').find({ status: 'testing' }, { projection: { _id: 0, registration_id: 1 } }).toArray(),
    db.collection<PaymentSummaryDoc>('family_payments').find({ status: 'testing' }, { projection: { _id: 0, registration_id: 1 } }).toArray(),
    db.collection<PaymentSummaryDoc>('individual_payments').find({ status: 'testing' }, { projection: { _id: 0, registration_id: 1 } }).toArray(),
  ])
  const communityTestingRegIds = communityTestingDocs.map((p) => p.registration_id).filter((id): id is string => Boolean(id))
  const familyTestingRegIds = familyTestingDocs.map((p) => p.registration_id).filter((id): id is string => Boolean(id))
  const individualTestingRegIds = individualTestingDocs.map((p) => p.registration_id).filter((id): id is string => Boolean(id))
  const excludeTesting = (regIds: string[]) => (regIds.length > 0 ? { registration_id: { $nin: regIds } } : {})

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
    individualCount,
    individualParticipantCount,
    paidIndividualParticipantCount,
    pendingIndividualParticipantCount,
    individualRacepackCount,
    individualParticipantDocuments,
    paidIndividualPayments,
  ] = await Promise.all([
    // "Komunitas" = jumlah akun yang punya minimal 1 peserta non-testing (akun yang seluruh registrasinya testing tidak dihitung).
    db.collection('participants').distinct('community_id', excludeTesting(communityTestingRegIds)).then((ids) => ids.length),
    db.collection('family_participants').distinct('family_id', excludeTesting(familyTestingRegIds)).then((ids) => ids.length),
    db.collection('participants').countDocuments(excludeTesting(communityTestingRegIds)),
    db.collection('family_participants').countDocuments(excludeTesting(familyTestingRegIds)),
    db.collection('participants').countDocuments({ payment_status: 'paid', ...excludeTesting(communityTestingRegIds) }),
    db.collection('family_participants').countDocuments({ payment_status: 'paid', ...excludeTesting(familyTestingRegIds) }),
    db.collection('participants').countDocuments({ payment_status: 'pending', ...excludeTesting(communityTestingRegIds) }),
    db.collection('family_participants').countDocuments({ payment_status: 'pending', ...excludeTesting(familyTestingRegIds) }),
    db.collection('participants').countDocuments({ checked_in: true, ...excludeTesting(communityTestingRegIds) }),
    db.collection('family_participants').countDocuments({ checked_in: true, ...excludeTesting(familyTestingRegIds) }),
    db.collection<ParticipantSummaryDoc>('participants')
      .find(excludeTesting(communityTestingRegIds), { projection: { _id: 0, created_at: 1 } })
      .toArray(),
    db.collection<ParticipantSummaryDoc>('family_participants')
      .find(excludeTesting(familyTestingRegIds), { projection: { _id: 0, created_at: 1 } })
      .toArray(),
    db.collection<PaymentSummaryDoc>('payments')
      .find({ status: 'paid' }, { projection: { _id: 0, registration_id: 1, amount: 1, paid_at: 1, created_at: 1 } })
      .toArray(),
    db.collection<PaymentSummaryDoc>('family_payments')
      .find({ status: 'paid' }, { projection: { _id: 0, registration_id: 1, amount: 1, paid_at: 1, created_at: 1 } })
      .toArray(),
    db.collection('individual_participants').distinct('individual_id', excludeTesting(individualTestingRegIds)).then((ids) => ids.length),
    db.collection('individual_participants').countDocuments(excludeTesting(individualTestingRegIds)),
    db.collection('individual_participants').countDocuments({ payment_status: 'paid', ...excludeTesting(individualTestingRegIds) }),
    db.collection('individual_participants').countDocuments({ payment_status: 'pending', ...excludeTesting(individualTestingRegIds) }),
    db.collection('individual_participants').countDocuments({ checked_in: true, ...excludeTesting(individualTestingRegIds) }),
    db.collection<ParticipantSummaryDoc>('individual_participants')
      .find(excludeTesting(individualTestingRegIds), { projection: { _id: 0, created_at: 1 } })
      .toArray(),
    db.collection<PaymentSummaryDoc>('individual_payments')
      .find({ status: 'paid' }, { projection: { _id: 0, registration_id: 1, amount: 1, paid_at: 1, created_at: 1 } })
      .toArray(),
  ])

  const communityRegistrationIds = paidPayments
    .map((payment) => payment.registration_id)
    .filter((id): id is string => Boolean(id))
  const familyRegistrationIds = paidFamilyPayments
    .map((payment) => payment.registration_id)
    .filter((id): id is string => Boolean(id))
  const individualRegistrationIds = paidIndividualPayments
    .map((payment) => payment.registration_id)
    .filter((id): id is string => Boolean(id))

  const [communityRegistrations, familyRegistrations, individualRegistrations] = await Promise.all([
    db.collection<RegistrationSummaryDoc>('registrations')
      .find({ id: { $in: communityRegistrationIds } }, { projection: { _id: 0, id: 1, total_participants: 1 } })
      .toArray(),
    db.collection<RegistrationSummaryDoc>('family_registrations')
      .find({ id: { $in: familyRegistrationIds } }, { projection: { _id: 0, id: 1, total_participants: 1 } })
      .toArray(),
    db.collection<RegistrationSummaryDoc>('individual_registrations')
      .find({ id: { $in: individualRegistrationIds } }, { projection: { _id: 0, id: 1, total_participants: 1 } })
      .toArray(),
  ])

  const now = new Date()
  const communityRegistrationMap = new Map<string, RegistrationSummaryDoc>()
  for (const registration of communityRegistrations) {
    if (registration.id) communityRegistrationMap.set(registration.id, registration)
  }

  const familyRegistrationMap = new Map<string, RegistrationSummaryDoc>()
  for (const registration of familyRegistrations) {
    if (registration.id) familyRegistrationMap.set(registration.id, registration)
  }

  const individualRegistrationMap = new Map<string, RegistrationSummaryDoc>()
  for (const registration of individualRegistrations) {
    if (registration.id) individualRegistrationMap.set(registration.id, registration)
  }

  // Metrik harian dihitung per paket dulu (bukan ke satu map gabungan) supaya breakdown per-paket bisa disimpan.
  const communityDaily = createDailyMetrics(now)
  const familyDaily = createDailyMetrics(now)
  const individualDaily = createDailyMetrics(now)

  addParticipantCounts(participantDocuments, new Map(communityDaily.map((m) => [m.dateKey, m])))
  addParticipantCounts(familyParticipantDocuments, new Map(familyDaily.map((m) => [m.dateKey, m])))
  addParticipantCounts(individualParticipantDocuments, new Map(individualDaily.map((m) => [m.dateKey, m])))

  addPaymentCounts('community', paidPayments, communityRegistrationMap, new Map(communityDaily.map((m) => [m.dateKey, m])), new Set())
  addPaymentCounts('family', paidFamilyPayments, familyRegistrationMap, new Map(familyDaily.map((m) => [m.dateKey, m])), new Set())
  addPaymentCounts('individual', paidIndividualPayments, individualRegistrationMap, new Map(individualDaily.map((m) => [m.dateKey, m])), new Set())

  const daily: AdminDashboardDailyMetric[] = communityDaily.map((c, i) => ({
    dateKey: c.dateKey,
    label: c.label,
    participants: c.participants + familyDaily[i].participants + individualDaily[i].participants,
    paidParticipants: c.paidParticipants + familyDaily[i].paidParticipants + individualDaily[i].paidParticipants,
    revenue: c.revenue + familyDaily[i].revenue + individualDaily[i].revenue,
  }))

  const communityStats: AdminDashboardStats = {
    communities: communityCount,
    participants: participantCount,
    paidParticipants: paidParticipantCount,
    pendingParticipants: pendingParticipantCount,
    racepacksPickedUp: racepackCount,
    revenue: paidPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
  }
  const familyStats: AdminDashboardStats = {
    communities: familyCount,
    participants: familyParticipantCount,
    paidParticipants: paidFamilyParticipantCount,
    pendingParticipants: pendingFamilyParticipantCount,
    racepacksPickedUp: familyRacepackCount,
    revenue: paidFamilyPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
  }
  const individualStats: AdminDashboardStats = {
    communities: individualCount,
    participants: individualParticipantCount,
    paidParticipants: paidIndividualParticipantCount,
    pendingParticipants: pendingIndividualParticipantCount,
    racepacksPickedUp: individualRacepackCount,
    revenue: paidIndividualPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
  }

  return {
    stats: {
      communities: communityStats.communities + familyStats.communities + individualStats.communities,
      participants: communityStats.participants + familyStats.participants + individualStats.participants,
      paidParticipants: communityStats.paidParticipants + familyStats.paidParticipants + individualStats.paidParticipants,
      pendingParticipants: communityStats.pendingParticipants + familyStats.pendingParticipants + individualStats.pendingParticipants,
      racepacksPickedUp: communityStats.racepacksPickedUp + familyStats.racepacksPickedUp + individualStats.racepacksPickedUp,
      revenue: communityStats.revenue + familyStats.revenue + individualStats.revenue,
    },
    daily,
    byPackage: {
      community: { label: 'Community Package', stats: communityStats, daily: communityDaily },
      family: { label: 'Bro & Sist Package', stats: familyStats, daily: familyDaily },
      individual: { label: 'Individu', stats: individualStats, daily: individualDaily },
    },
    updatedAt: new Date().toISOString(),
  }
}
