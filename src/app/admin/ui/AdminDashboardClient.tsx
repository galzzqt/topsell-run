'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  Calendar,
  CalendarDays,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  LogOut,
  Package,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  TicketCheck,
  Trash2,
  Users,
  Menu,
  X,
  UserCheck,
  ThumbsUp,
  ThumbsDown,
  AtSign,
  Music2,
  Link as LinkIcon,
  Watch,
  Banknote,
  Filter,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
)

import {
  logoutAdmin,
  markRacepackPickedUp,
  createManagedAdmin,
  deleteManagedAdmin,
  refreshAxiomLogs,
  saveEditableEnvValues,
  saveRegistrationFormSettings,
  updateManagedAdmin,
  updateAdminCommunity,
  updateAdminFamily,
  updateAdminIndividual,
  updateAdminParticipant,
  updateAdminPaymentStatus,
  updateAdminPacerStatus,
  updateAdminPacerParticipant,
  type AdminCommunityUpdateValues,
  type AdminParticipantUpdateValues,
  type AdminPacerParticipantUpdateValues,
} from '../actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { DateInput } from '@/components/ui/date-input'
import { formatCurrency } from '@/lib/utils/format'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import type { AdminEditableEnvField, AdminEnvSnapshot, AdminSettings, EmailTemplateConfig, FormInputConfig, FormSelectConfig, PackageKey, PackageConfig, PackageCategory, PackagePeriod, RegistrationFormGroupSettings, RegistrationFormParticipantSettings, WebhookPackageConfig } from '@/lib/admin/settings-schema'
import type { AdminLogEntry } from '@/lib/axiom/logs'
import type { VoucherDoc } from '@/lib/types/voucher'
import { VouchersTab } from './VouchersTab'

type VoucherFormState = {
  name: string
  code: string
  type: 'code' | 'auto'
  discountType: 'percent' | 'flat'
  discountValue: number
  maxUsage: number | null
  validFrom: string
  validUntil: string
  packageKeys: string[]
  allowedCategories: string[]
}

const defaultVoucherForm: VoucherFormState = {
  name: '',
  code: '',
  type: 'code',
  discountType: 'percent',
  discountValue: 0,
  maxUsage: null,
  validFrom: '',
  validUntil: '',
  packageKeys: ['community', 'family', 'individual'],
  allowedCategories: [],
}

type Relation<T> = T | T[] | null

type CommunityInfo = {
  id: string
  name: string
  leader_name: string
  email: string | null
  phone: string
  community_code: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  created_at?: string
}

type RegistrationInfo = {
  community_id: string
  community: Relation<CommunityInfo>
}

export type AdminParticipant = {
  id: string
  full_name: string
  bib_name: string
  ktp_number: string
  email: string
  phone: string
  date_of_birth: string | null
  gender: 'male' | 'female'
  tshirt_size: string
  blood_type: string | null
  medical_condition: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  participant_code: string | null
  qr_code_data: string | null
  payment_status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  checked_in: boolean
  checked_in_at: string | null
  created_at: string
  community: Relation<CommunityInfo>
}

export type AdminCommunity = {
  id: string
  name: string
  leader_name: string
  email: string | null
  phone: string
  community_code: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  created_at: string
  registration_type?: 'individual' | 'family'
}

export type AdminPayment = {
  id: string
  registration_id: string
  amount: number
  payment_method: string | null
  payment_reference: string
  status: 'pending' | 'paid' | 'failed' | 'expired'
  paid_at: string | null
  created_at: string
  registration: Relation<RegistrationInfo>
}

export type AdminPacerRow = {
  id: string
  pacer_id: string
  full_name: string
  bib_name: string
  ktp_number: string
  email: string
  phone: string
  date_of_birth: string | null
  gender: 'male' | 'female'
  tshirt_size: string
  blood_type: string | null
  medical_condition: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  age: number | null
  sosmed_instagram: string | null
  sosmed_tiktok: string | null
  strava_link: string | null
  strava_username: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_holder: string | null
  has_smartwatch: 'yes' | 'no'
  media_urls: string[]
  pb_media_urls: string[]
  category: string
  pacer_code: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  status: 'pending' | 'approved' | 'rejected'
  status_note: string | null
  created_at: string
}

export type AdminStats = {
  communities: number
  participants: number
  paidParticipants: number
  pendingParticipants: number
  racepacksPickedUp: number
  revenue: number
}

export type AdminUser = {
  id: string
  username: string
  name: string
  role: 'superadmin' | 'admin'
  allowed_tabs?: string[]
}

export type ManagedAdmin = {
  id: string
  username: string
  name: string
  role: 'admin' | 'superadmin'
  is_active: boolean
  allowed_tabs?: string[]
  created_at: string
  updated_at: string
}

type SummaryDailyParticipant = {
  dateKey: string
  label: string
  count: number
}

type DailyMetric = {
  dateKey: string
  label: string
  participants: number
  paidParticipants: number
  revenue: number
}

type DashboardPackageKey = 'community' | 'family' | 'individual'

type DashboardPackageSummary = {
  label: string
  stats: AdminStats
  daily: DailyMetric[]
}

type DashboardSummary = {
  stats: AdminStats
  daily: DailyMetric[]
  byPackage: Record<DashboardPackageKey, DashboardPackageSummary>
  updatedAt: string
}

type AdminTab =
  | 'summary'
  | 'participants'
  | 'payments'
  | 'scanner'
  | 'export_participants'
  | 'export_payments'
  | 'packages'
  | 'periods'
  | 'pacer'
  | 'settings'
  | 'admins'
  | 'logs'
  | 'vouchers'

type ScanResult = {
  title: string
  body: string
  variant: 'success' | 'warning' | 'danger'
  participant?: ScannedParticipant
}

type ScannedParticipant = {
  id: string
  full_name: string
  bib_name: string
  email: string
  phone: string
  date_of_birth: string | null
  gender: 'male' | 'female'
  tshirt_size: string
  blood_type: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  participant_code: string | null
  payment_status: 'pending' | 'paid' | 'failed' | 'expired'
  checked_in: boolean
  checked_in_at: string | null
  community: Relation<CommunityInfo>
}

function firstRelation<T>(relation: Relation<T>) {
  return Array.isArray(relation) ? relation[0] || null : relation
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getParticipantCommunity(participant: AdminParticipant) {
  return firstRelation(participant.community)
}

function getPaymentCommunity(payment: AdminPayment) {
  return firstRelation(firstRelation(payment.registration)?.community || null)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'komunitas'
}

export function AdminDashboardClient({
  stats,
  participants,
  communities,
  payments,
  familyParticipants = [],
  families = [],
  familyPayments = [],
  individualParticipants = [],
  individuals = [],
  individualPayments = [],
  pacerRows = [],
  adminSettings,
  editableEnv,
  currentAdmin,
  managedAdmins,
  axiomLogs,
  axiomLogsError,
}: {
  stats: AdminStats
  participants: AdminParticipant[]
  communities: AdminCommunity[]
  payments: AdminPayment[]
  familyParticipants?: AdminParticipant[]
  families?: AdminCommunity[]
  familyPayments?: AdminPayment[]
  individualParticipants?: AdminParticipant[]
  individuals?: AdminCommunity[]
  individualPayments?: AdminPayment[]
  pacerRows?: AdminPacerRow[]
  adminSettings: AdminSettings
  editableEnv: AdminEnvSnapshot[]
  currentAdmin: AdminUser
  managedAdmins: ManagedAdmin[]
  axiomLogs: AdminLogEntry[]
  axiomLogsError: string | null
}) {
  const router = useRouter()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef('')
  const envFieldCounterRef = useRef(0)
  const scanRegionId = 'admin-racepack-reader'
  const [query, setQuery] = useState('')
  const [packageType, setPackageType] = useState<'community' | 'family' | 'individual'>('community')
  const [combineFiles, setCombineFiles] = useState(false)
  const [participantStartDate, setParticipantStartDate] = useState('')
  const [participantEndDate, setParticipantEndDate] = useState('')
  const [participantDatePreset, setParticipantDatePreset] = useState<'all' | 'today' | '7d' | '30d' | 'this_month' | 'custom'>('all')
  const [participantSort, setParticipantSort] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest')

  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed' | 'expired' | 'testing'>('all')
  const [paymentStartDate, setPaymentStartDate] = useState('')
  const [paymentEndDate, setPaymentEndDate] = useState('')
  const [paymentDatePreset, setPaymentDatePreset] = useState<'all' | 'today' | '7d' | '30d' | 'this_month' | 'custom'>('all')
  const [paymentSort, setPaymentSort] = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest')

  const handlePaymentDatePresetChange = (preset: 'all' | 'today' | '7d' | '30d' | 'this_month' | 'custom') => {
    setPaymentDatePreset(preset)
    const now = new Date()
    const formatDateForInput = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    if (preset === 'all') {
      setPaymentStartDate('')
      setPaymentEndDate('')
    } else if (preset === 'today') {
      const todayStr = formatDateForInput(now)
      setPaymentStartDate(todayStr)
      setPaymentEndDate(todayStr)
    } else if (preset === '7d') {
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      setPaymentStartDate(formatDateForInput(start))
      setPaymentEndDate(formatDateForInput(now))
    } else if (preset === '30d') {
      const start = new Date(now)
      start.setDate(now.getDate() - 29)
      setPaymentStartDate(formatDateForInput(start))
      setPaymentEndDate(formatDateForInput(now))
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setPaymentStartDate(formatDateForInput(start))
      setPaymentEndDate(formatDateForInput(end))
    }
  }

  const handleDatePresetChange = (preset: 'all' | 'today' | '7d' | '30d' | 'this_month' | 'custom') => {
    setParticipantDatePreset(preset)
    const now = new Date()
    const formatDateForInput = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    if (preset === 'all') {
      setParticipantStartDate('')
      setParticipantEndDate('')
    } else if (preset === 'today') {
      const todayStr = formatDateForInput(now)
      setParticipantStartDate(todayStr)
      setParticipantEndDate(todayStr)
    } else if (preset === '7d') {
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      setParticipantStartDate(formatDateForInput(start))
      setParticipantEndDate(formatDateForInput(now))
    } else if (preset === '30d') {
      const start = new Date(now)
      start.setDate(now.getDate() - 29)
      setParticipantStartDate(formatDateForInput(start))
      setParticipantEndDate(formatDateForInput(now))
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setParticipantStartDate(formatDateForInput(start))
      setParticipantEndDate(formatDateForInput(end))
    }
  }
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const isSuper = currentAdmin.role === 'superadmin'
    const allowed = currentAdmin.allowed_tabs || []
    if (isSuper || allowed.includes('summary')) return 'summary'
    if (allowed.length > 0) return allowed[0] as AdminTab
    return 'summary'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [expandedCommunities, setExpandedCommunities] = useState<Set<string>>(new Set())
  const [participantEditing, setParticipantEditing] = useState<AdminParticipant | null>(null)
  const [communityEditing, setCommunityEditing] = useState<AdminCommunity | null>(null)
  const [participantForm, setParticipantForm] = useState<AdminParticipantUpdateValues | null>(null)
  const [communityForm, setCommunityForm] = useState<AdminCommunityUpdateValues | null>(null)
  const [pacerDetail, setPacerDetail] = useState<AdminPacerRow | null>(null)
  const [pacerDetailLocation, setPacerDetailLocation] = useState<{ provinsi: string; kota: string; kecamatan: string } | null>(null)
  const [pacerEditing, setPacerEditing] = useState<AdminPacerRow | null>(null)
  const [pacerForm, setPacerForm] = useState<AdminPacerParticipantUpdateValues | null>(null)
  const [processingPacerId, setProcessingPacerId] = useState<string | null>(null)
  const [settingsForm, setSettingsForm] = useState<AdminSettings>(adminSettings)
  const [formEditingPkg, setFormEditingPkg] = useState<PackageKey | null>(null)
  const [emailEditingPkg, setEmailEditingPkg] = useState<PackageKey | null>(null)
  const [webhookEditingPkg, setWebhookEditingPkg] = useState<PackageKey | null>(null)
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null)
  const [envSnapshots, setEnvSnapshots] = useState<AdminEnvSnapshot[]>(editableEnv)
  const [envForm, setEnvForm] = useState<Record<string, string>>({})
  const [selectedExportCommunities, setSelectedExportCommunities] = useState<Set<string> | null>(null)
  const [exportPaymentFilter, setExportPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [settingsMessage, setSettingsMessage] = useState('')
  const [adminCreateForm, setAdminCreateForm] = useState<{ name: string; username: string; password: string; role: 'admin' | 'superadmin'; allowed_tabs: string[] }>({
    name: '',
    username: '',
    password: '',
    role: 'admin',
    allowed_tabs: ['summary', 'participants', 'payments', 'pacer'],
  })
  const [adminEditForm, setAdminEditForm] = useState<{ id: string; name: string; username: string; password: string; is_active: boolean; role: 'admin' | 'superadmin'; allowed_tabs: string[] } | null>(null)
  const [adminMessage, setAdminMessage] = useState('')
  const [logs, setLogs] = useState<AdminLogEntry[]>(axiomLogs)
  const [logsMessage, setLogsMessage] = useState(axiomLogsError || '')
  const [isPending, startTransition] = useTransition()
  const [paymentStatusChanges, setPaymentStatusChanges] = useState<Map<string, 'pending' | 'paid' | 'failed' | 'expired' | 'testing'>>(new Map())
  const [locationCache, setLocationCache] = useState<Map<string, string>>(new Map())
  const [selectedPeriodPackage, setSelectedPeriodPackage] = useState<PackageKey | null>(null)
  const [selectedPackagesPackage, setSelectedPackagesPackage] = useState<PackageKey | null>(null)

  // Voucher management state
  const [voucherList, setVoucherList] = useState<VoucherDoc[]>([])
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [voucherError, setVoucherError] = useState<string | null>(null)
  const [voucherSuccess, setVoucherSuccess] = useState<string | null>(null)
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false)
  const [voucherEditTarget, setVoucherEditTarget] = useState<VoucherDoc | null>(null)
  const [voucherForm, setVoucherForm] = useState<VoucherFormState>(defaultVoucherForm)

  // Helper to resolve location ID/code to its name using locationCache
  const resolveLocationName = (code: string | null | undefined) => {
    if (!code) return ''
    return locationCache.get(code) || code
  }

  // Pre-load and resolve province, city, and district names for all location codes in parallel
  useEffect(() => {
    let cancelled = false
    const collectAndResolveLocations = async () => {
      const provinceIds = new Set<string>()
      const cityIds = new Set<string>()
      const districtIds = new Set<string>()

      const addCode = (code: string | null | undefined) => {
        if (!code) return
        if (/^[0-9.]+$/.test(code)) {
          const parts = code.split('.')
          if (parts[0]) provinceIds.add(parts[0])
          if (parts[0] && parts[1]) cityIds.add(`${parts[0]}.${parts[1]}`)
          districtIds.add(code)
        }
      }

      individuals.forEach((ind) => {
        addCode(ind.provinsi)
        addCode(ind.kota)
        addCode(ind.kecamatan)
      })

      families.forEach((fam) => {
        addCode(fam.provinsi)
        addCode(fam.kota)
        addCode(fam.kecamatan)
      })

      communities.forEach((comm) => {
        addCode(comm.provinsi)
        addCode(comm.kota)
        addCode(comm.kecamatan)
      })

      pacerRows.forEach((pac) => {
        addCode(pac.provinsi)
        addCode(pac.kota)
        addCode(pac.kecamatan)
      })

      if (provinceIds.size === 0 && cityIds.size === 0 && districtIds.size === 0) return

      const newCache = new Map<string, string>()

      try {
        // 1. Fetch provinces
        const provs = await fetchProvinsi()
        provs.forEach((p) => newCache.set(p.value, p.label))

        if (cancelled) return

        // 2. Fetch cities for each unique province in parallel
        await Promise.all(
          Array.from(provinceIds).map(async (provId) => {
            const cities = await fetchKota(provId)
            cities.forEach((c) => newCache.set(c.value, c.label))
          })
        )

        if (cancelled) return

        // 3. Fetch districts for each unique city in parallel
        await Promise.all(
          Array.from(cityIds).map(async (cityId) => {
            const districts = await fetchKecamatan(cityId)
            districts.forEach((d) => newCache.set(d.value, d.label))
          })
        )

        if (cancelled) return
        setLocationCache(newCache)
      } catch (err) {
        console.error('Error resolving locations for cache:', err)
      }
    }

    collectAndResolveLocations()
    return () => { cancelled = true }
  }, [individuals, families, communities, pacerRows])

  // Resolve nama lokasi saat modal Detail Pacer dibuka
  useEffect(() => {
    if (!pacerDetail) {
      setPacerDetailLocation(null)
      return
    }
    setPacerDetailLocation({
      provinsi: resolveLocationName(pacerDetail.provinsi) || '-',
      kota: resolveLocationName(pacerDetail.kota) || '-',
      kecamatan: resolveLocationName(pacerDetail.kecamatan) || '-',
    })
  }, [pacerDetail, locationCache])
  // Real-time dashboard summary state
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryPackage, setSummaryPackage] = useState<'all' | DashboardPackageKey>('all')
  const activeSummary = useMemo(
    () => (summaryPackage === 'all' ? dashboardSummary : dashboardSummary?.byPackage[summaryPackage] ?? null),
    [summaryPackage, dashboardSummary]
  )

  // Dataset aktif per tab (Komunitas / Bro & Sist / Individu).
  const activeCommunities = useMemo(
    () => (packageType === 'individual' ? individuals : packageType === 'family' ? families : communities),
    [packageType, communities, families, individuals]
  )
  const activeParticipants = useMemo(
    () => (packageType === 'individual' ? individualParticipants : packageType === 'family' ? familyParticipants : participants),
    [packageType, participants, familyParticipants, individualParticipants]
  )
  const activePayments = useMemo(
    () => (packageType === 'individual' ? individualPayments : packageType === 'family' ? familyPayments : payments),
    [packageType, payments, familyPayments, individualPayments]
  )
  const entityLabel = packageType === 'community' ? 'Komunitas' : packageType === 'individual' ? 'Individu' : 'Bro & Sist'
  const groupWord = packageType === 'community' ? 'komunitas' : packageType === 'individual' ? 'peserta' : 'grup'
  // Individu punya koleksi pembayaran sendiri; komunitas & bro-sist seperti semula.
  const paymentPackageType: 'community' | 'family' | 'individual' = packageType

  const communitiesForExport = useMemo(() => {
    const targetCommunities = activeCommunities
    const isExportParticipants = activeTab === 'export_participants'
    const isExportPayments = activeTab === 'export_payments'
    if (exportPaymentFilter === 'all' || (!isExportParticipants && !isExportPayments)) return targetCommunities
    const matchingCommunityIds = new Set<string>()
    if (isExportParticipants) {
      const targetParticipants = activeParticipants
      for (const p of targetParticipants) {
        const community = getParticipantCommunity(p)
        if (!community) continue
        const matches = exportPaymentFilter === 'paid' ? p.payment_status === 'paid' : p.payment_status !== 'paid'
        if (matches) matchingCommunityIds.add(community.id)
      }
    } else {
      const targetPayments = activePayments
      for (const pay of targetPayments) {
        const community = getPaymentCommunity(pay)
        if (!community) continue
        const matches = exportPaymentFilter === 'paid' ? pay.status === 'paid' : pay.status !== 'paid'
        if (matches) matchingCommunityIds.add(community.id)
      }
    }
    return targetCommunities.filter((c) => matchingCommunityIds.has(c.id))
  }, [activeCommunities, activeParticipants, activePayments, activeTab, exportPaymentFilter])

  const resolvedSelection = useMemo(() => {
    return selectedExportCommunities ?? new Set(communitiesForExport.map((c) => c.id))
  }, [selectedExportCommunities, communitiesForExport])

  const filteredParticipants = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    let list = activeParticipants

    if (keyword) {
      list = list.filter((participant) => {
        const community = getParticipantCommunity(participant)
        return [
          participant.full_name,
          participant.bib_name,
          participant.email,
          participant.phone,
          participant.participant_code || '',
          community?.name || '',
          community?.community_code || '',
        ].some((value) => value.toLowerCase().includes(keyword))
      })
    }

    if (participantStartDate || participantEndDate) {
      const start = participantStartDate ? new Date(`${participantStartDate}T00:00:00`).getTime() : -Infinity
      const end = participantEndDate ? new Date(`${participantEndDate}T23:59:59.999`).getTime() : Infinity

      list = list.filter((participant) => {
        if (!participant.created_at) return false
        const pTime = new Date(participant.created_at).getTime()
        if (Number.isNaN(pTime)) return false
        return pTime >= start && pTime <= end
      })
    }

    return list
  }, [activeParticipants, query, participantStartDate, participantEndDate])

  const paymentStats = useMemo(() => {
    const total = activePayments.length
    let pending = 0
    let paid = 0
    let failed = 0
    let expired = 0
    let testing = 0
    let totalNominalPaid = 0

    for (const payment of activePayments) {
      const status = paymentStatusChanges.get(payment.id) || payment.status
      if (status === 'pending') pending++
      else if (status === 'paid') {
        paid++
        totalNominalPaid += payment.amount
      } else if (status === 'failed') failed++
      else if (status === 'expired') expired++
      else if (status === 'testing') testing++
    }

    return { total, pending, paid, failed, expired, testing, totalNominalPaid }
  }, [activePayments, paymentStatusChanges])

  const filteredPayments = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    let list = activePayments

    if (keyword) {
      list = list.filter((payment) => {
        const community = getPaymentCommunity(payment)
        return [
          payment.payment_reference,
          payment.payment_method || '',
          payment.status,
          String(payment.amount),
          formatCurrency(payment.amount),
          formatDateTime(payment.paid_at || payment.created_at),
          community?.name || '',
          community?.leader_name || '',
          community?.email || '',
          community?.phone || '',
          community?.community_code || '',
        ].some((value) => value.toLowerCase().includes(keyword))
      })
    }

    if (paymentStatusFilter !== 'all') {
      list = list.filter((payment) => {
        const status = paymentStatusChanges.get(payment.id) || payment.status
        return status === paymentStatusFilter
      })
    }

    if (paymentStartDate || paymentEndDate) {
      const start = paymentStartDate ? new Date(`${paymentStartDate}T00:00:00`).getTime() : -Infinity
      const end = paymentEndDate ? new Date(`${paymentEndDate}T23:59:59.999`).getTime() : Infinity

      list = list.filter((payment) => {
        const dateStr = payment.paid_at || payment.created_at
        if (!dateStr) return false
        const pTime = new Date(dateStr).getTime()
        if (Number.isNaN(pTime)) return false
        return pTime >= start && pTime <= end
      })
    }

    return [...list].sort((a, b) => {
      const timeA = new Date(a.paid_at || a.created_at || 0).getTime()
      const timeB = new Date(b.paid_at || b.created_at || 0).getTime()

      if (paymentSort === 'oldest') {
        return timeA - timeB
      }
      if (paymentSort === 'amount_desc') {
        return b.amount - a.amount
      }
      if (paymentSort === 'amount_asc') {
        return a.amount - b.amount
      }
      // 'newest'
      return timeB - timeA
    })
  }, [activePayments, query, paymentStatusFilter, paymentStartDate, paymentEndDate, paymentSort, paymentStatusChanges])

  const filteredPaymentsTotalNominal = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  }, [filteredPayments])

  const groupedParticipants = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string
        name: string
        code: string
        earliestCreatedAt: number
        latestCreatedAt: number
        participants: AdminParticipant[]
      }
    >()

    for (const participant of filteredParticipants) {
      const community = getParticipantCommunity(participant)
      const code = community?.community_code || 'TANPA-KODE'
      const name =
        community?.name ||
        (packageType === 'community'
          ? 'Tanpa Komunitas'
          : packageType === 'individual'
          ? 'Tanpa Nama'
          : 'Tanpa Grup')
      const key = `${code}:${name}`
      const pTime = participant.created_at ? new Date(participant.created_at).getTime() : 0
      const current = groups.get(key)

      if (current) {
        current.participants.push(participant)
        if (pTime && (current.earliestCreatedAt === 0 || pTime < current.earliestCreatedAt)) {
          current.earliestCreatedAt = pTime
        }
        if (pTime && pTime > current.latestCreatedAt) {
          current.latestCreatedAt = pTime
        }
      } else {
        const commTime = community?.created_at ? new Date(community.created_at).getTime() : pTime
        groups.set(key, {
          key,
          name,
          code,
          earliestCreatedAt: pTime || commTime || 0,
          latestCreatedAt: pTime || commTime || 0,
          participants: [participant],
        })
      }
    }

    const groupArray = Array.from(groups.values())

    // Urutkan peserta di dalam tiap grup
    groupArray.forEach((group) => {
      group.participants.sort((a, b) => {
        if (participantSort === 'name_asc') {
          return a.full_name.localeCompare(b.full_name, 'id', { sensitivity: 'base' })
        }
        if (participantSort === 'name_desc') {
          return b.full_name.localeCompare(a.full_name, 'id', { sensitivity: 'base' })
        }
        if (participantSort === 'oldest') {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
          return timeA - timeB
        }
        // default: newest
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
        return timeB - timeA
      })
    })

    // Urutkan grup itu sendiri
    groupArray.sort((a, b) => {
      if (participantSort === 'name_asc') {
        return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
      }
      if (participantSort === 'name_desc') {
        return b.name.localeCompare(a.name, 'id', { sensitivity: 'base' })
      }
      if (participantSort === 'oldest') {
        if (a.earliestCreatedAt !== b.earliestCreatedAt) {
          return a.earliestCreatedAt - b.earliestCreatedAt
        }
        return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
      }
      // default: newest
      if (a.latestCreatedAt !== b.latestCreatedAt) {
        return b.latestCreatedAt - a.latestCreatedAt
      }
      return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
    })

    return groupArray
  }, [filteredParticipants, packageType, participantSort])

  const dailyParticipants = useMemo<SummaryDailyParticipant[]>(() => {
    const DAYS_TO_SHOW = 14
    const formatter = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' })
    const counts = new Map<string, number>()

    const allP = [...participants, ...familyParticipants]
    for (const participant of allP) {
      const createdAt = new Date(participant.created_at)
      if (Number.isNaN(createdAt.getTime())) continue
      const key = createdAt.toISOString().slice(0, 10)
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    const days: SummaryDailyParticipant[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let offset = DAYS_TO_SHOW - 1; offset >= 0; offset -= 1) {
      const date = new Date(today)
      date.setDate(today.getDate() - offset)
      const dateKey = date.toISOString().slice(0, 10)
      days.push({
        dateKey,
        label: formatter.format(date),
        count: counts.get(dateKey) || 0,
      })
    }

    return days
  }, [participants, familyParticipants])

  const dailyParticipantChartMax = useMemo(() => Math.max(...dailyParticipants.map((item) => item.count), 1), [dailyParticipants])

  const communitiesByKey = useMemo(() => {
    const map = new Map<string, AdminCommunity>()
    for (const community of activeCommunities) {
      map.set(`${community.community_code}:${community.name}`, community)
    }
    return map
  }, [activeCommunities])

  const stopCamera = () => {
    const scanner = scannerRef.current
    if (!scanner) {
      setCameraActive(false)
      return
    }

    scanner
      .stop()
      .catch(() => undefined)
      .finally(() => {
        try {
          scanner.clear()
        } catch {
          // Scanner cleanup can fail if the reader was already cleared.
        }
        scannerRef.current = null
        setCameraActive(false)
      })
  }

  const submitScan = (value: string) => {
    const scanValue = value.trim()
    if (!scanValue) return

    startTransition(async () => {
      const result = await markRacepackPickedUp(scanValue)
      if (result.error) {
        setScanResult({
          title: result.alreadyPickedUp ? 'QR Sudah Digunakan' : 'Scan Ditolak',
          body: result.error,
          variant: result.alreadyPickedUp ? 'warning' : 'danger',
          participant: result.participant as ScannedParticipant | undefined,
        })
        return
      }

      const participant = result.participant
      const community = participant ? firstRelation(participant.community) : null
      setScanResult({
        title: result.alreadyPickedUp ? 'Racepack Sudah Diambil' : 'Racepack Berhasil Ditandai',
        body: participant
          ? `${participant.full_name} (${participant.participant_code || participant.bib_name}) - ${community?.name || 'Komunitas'}`
          : 'Status peserta berhasil diperbarui.',
        variant: result.alreadyPickedUp ? 'warning' : 'success',
        participant: participant as ScannedParticipant | undefined,
      })
      router.refresh()
    })
  }

  const startCamera = async () => {
    setCameraError('')
    setScanResult(null)

    try {
      if (scannerRef.current) await scannerRef.current.stop().catch(() => undefined)

      const scanner = new Html5Qrcode(scanRegionId)
      scannerRef.current = scanner
      lastScanRef.current = ''
      setCameraActive(true)

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.777 },
        (decodedText) => {
          if (!decodedText || decodedText === lastScanRef.current) return
          lastScanRef.current = decodedText
          submitScan(decodedText)
        },
        () => undefined
      )
    } catch {
      setCameraError('Kamera tidak dapat diakses. Pastikan izin kamera aktif lalu coba scan ulang.')
      setCameraActive(false)
      try {
        scannerRef.current?.clear()
      } catch {
        // Scanner cleanup can fail if startup failed before render.
      }
      scannerRef.current = null
    }
  }

  const buildParticipantExportRows = (rows: AdminParticipant[]) => rows.map((participant) => {
    const community = getParticipantCommunity(participant)
    return {
      'Nama Peserta': participant.full_name,
      'Nama BIB': participant.bib_name,
      'No. KTP': participant.ktp_number,
      'Kode Peserta': participant.participant_code || '',
      Komunitas: community?.name || '',
      'Kode Komunitas': community?.community_code || '',
      Email: participant.email,
      WhatsApp: participant.phone,
      'Tanggal Lahir': participant.date_of_birth || '',
      Gender: participant.gender === 'male' ? 'Laki-laki' : 'Perempuan',
      Jersey: participant.tshirt_size,
      'Golongan Darah': participant.blood_type || '',
      'Penyakit Bawaan': participant.medical_condition || '',
      'Nama Kontak Darurat': participant.emergency_contact_name || '',
      'No. Kontak Darurat': participant.emergency_contact_phone || '',
      Provinsi: resolveLocationName(community?.provinsi) || '',
      'Kota/Kabupaten': resolveLocationName(community?.kota) || '',
      Kecamatan: resolveLocationName(community?.kecamatan) || '',
      'Status Bayar': participant.payment_status,
      'Racepack Diambil': participant.checked_in ? 'Ya' : 'Tidak',
      'Waktu Pengambilan': participant.checked_in_at ? formatDateTime(participant.checked_in_at) : '',
      'QR Data': participant.qr_code_data || '',
    }
  })

  const buildPaymentExportRows = (rows: AdminPayment[]) => rows.map((payment) => {
    const community = getPaymentCommunity(payment)
    return {
      Referensi: payment.payment_reference,
      Komunitas: community?.name || '',
      'Kode Komunitas': community?.community_code || '',
      Nominal: payment.amount,
      Metode: payment.payment_method || '',
      Provinsi: resolveLocationName(community?.provinsi) || '',
      'Kota/Kabupaten': resolveLocationName(community?.kota) || '',
      Kecamatan: resolveLocationName(community?.kecamatan) || '',
      Status: payment.status,
      'Dibayar Pada': payment.paid_at ? formatDateTime(payment.paid_at) : '',
      'Dibuat Pada': formatDateTime(payment.created_at),
    }
  })

  const buildPacerExportRows = (rows: AdminPacerRow[]) => rows.map((row) => ({
    Nama: row.full_name,
    'Nama BIB': row.bib_name,
    'Kode Pacer': row.pacer_code,
    'No. KTP': row.ktp_number,
    Email: row.email,
    WhatsApp: row.phone,
    'Tanggal Lahir': row.date_of_birth || '',
    Usia: row.age ?? '',
    Kategori: row.category,
    Gender: row.gender === 'male' ? 'Laki-laki' : 'Perempuan',
    Jersey: row.tshirt_size,
    'Golongan Darah': row.blood_type || '',
    'Penyakit Bawaan': row.medical_condition || '',
    'Nama Kontak Darurat': row.emergency_contact_name || '',
    'No. Kontak Darurat': row.emergency_contact_phone || '',
    Provinsi: resolveLocationName(row.provinsi) || '',
    'Kota/Kabupaten': resolveLocationName(row.kota) || '',
    Kecamatan: resolveLocationName(row.kecamatan) || '',
    Instagram: row.sosmed_instagram || '',
    TikTok: row.sosmed_tiktok || '',
    'Link Strava': row.strava_link || '',
    'Username Strava': row.strava_username || '',
    'Punya Smartwatch': row.has_smartwatch === 'yes' ? 'Ya' : 'Tidak',
    'Nama Bank': row.bank_name || '',
    'No. Rekening': row.bank_account_number || '',
    'Nama Pemilik Rekening': row.bank_account_holder || '',
    'Foto Portofolio': row.media_urls.join(', '),
    'Foto PB': row.pb_media_urls.join(', '),
    Status: row.status,
    'Catatan Status': row.status_note || '',
    'Tanggal Daftar': formatDateTime(row.created_at),
  }))

  const exportPacerRows = async () => {
    const XLSX = await import('xlsx')
    const today = new Date().toISOString().slice(0, 10)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildPacerExportRows(pacerRows)), 'Pacer')
    XLSX.writeFile(workbook, `topsell-run-pacer-${today}.xlsx`)
  }

  const applyParticipantFilter = (rows: AdminParticipant[]) => {
    if (exportPaymentFilter === 'paid') return rows.filter((p) => p.payment_status === 'paid')
    if (exportPaymentFilter === 'unpaid') return rows.filter((p) => p.payment_status !== 'paid')
    return rows
  }

  const applyPaymentFilter = (rows: AdminPayment[]) => {
    if (exportPaymentFilter === 'paid') return rows.filter((pay) => pay.status === 'paid')
    if (exportPaymentFilter === 'unpaid') return rows.filter((pay) => pay.status !== 'paid')
    return rows
  }

  const exportWorkbook = async (type: 'participants' | 'payments' | 'all', mode: 'all' | 'selected' = 'all') => {
    const XLSX = await import('xlsx')
    const today = new Date().toISOString().slice(0, 10)
    const targetCommunities = activeCommunities
    const selectedIds = mode === 'selected' ? resolvedSelection : new Set(targetCommunities.map((community) => community.id))
    const selectedCommunities = targetCommunities.filter((community) => selectedIds.has(community.id))

    if (mode === 'selected' && selectedCommunities.length === 0) {
      alert(`Pilih minimal satu ${groupWord} untuk diekspor.`)
      return
    }

    const targetParticipants = activeParticipants
    const targetPayments = activePayments
    const filterSuffix = exportPaymentFilter === 'paid' ? '-paid' : exportPaymentFilter === 'unpaid' ? '-unpaid' : ''

    if (combineFiles) {
      const workbook = XLSX.utils.book_new()
      const allParticipantsRows: Array<Record<string, unknown>> = []
      const allPaymentsRows: Array<Record<string, unknown>> = []

      for (const community of selectedCommunities) {
        const communityParticipants = applyParticipantFilter(
          targetParticipants.filter((participant) => getParticipantCommunity(participant)?.id === community.id)
        )
        const communityPayments = applyPaymentFilter(
          targetPayments.filter((payment) => getPaymentCommunity(payment)?.id === community.id)
        )

        allParticipantsRows.push(...buildParticipantExportRows(communityParticipants))
        allPaymentsRows.push(...buildPaymentExportRows(communityPayments))
      }

      if (type === 'participants' || type === 'all') {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(allParticipantsRows), 'Peserta')
      }

      if (type === 'payments' || type === 'all') {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(allPaymentsRows), 'Pembayaran')
      }

      const segmentName = packageType === 'community' ? 'komunitas' : packageType === 'individual' ? 'individu' : 'bro-sist'
      XLSX.writeFile(workbook, `topsell-run-gabungan-${segmentName}-${type}${filterSuffix}-${today}.xlsx`)
    } else {
      for (const community of selectedCommunities) {
        const communityParticipants = applyParticipantFilter(
          targetParticipants.filter((participant) => getParticipantCommunity(participant)?.id === community.id)
        )
        const communityPayments = applyPaymentFilter(
          targetPayments.filter((payment) => getPaymentCommunity(payment)?.id === community.id)
        )
        const workbook = XLSX.utils.book_new()

        if (type === 'participants' || type === 'all') {
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildParticipantExportRows(communityParticipants)), 'Peserta')
        }

        if (type === 'payments' || type === 'all') {
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildPaymentExportRows(communityPayments)), 'Pembayaran')
        }
        XLSX.writeFile(workbook, `topsell-run-${slugify(community.community_code)}-${slugify(community.name)}-${type}${filterSuffix}-${today}.xlsx`)
      }
    }
  }

  // Function to fetch dashboard summary
  const fetchDashboardSummary = async () => {
    try {
      const response = await fetch('/admin/dashboard-summary')
      if (!response.ok) throw new Error('Failed to fetch summary')
      const data = await response.json()
      setDashboardSummary(data)
      setSummaryLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard summary:', error)
      setSummaryLoading(false)
    }
  }

  // Fetch summary on mount and refresh every 10 seconds
  useEffect(() => {
    fetchDashboardSummary()
    const intervalId = setInterval(fetchDashboardSummary, 10000) // 10 seconds
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAdmin()
      router.refresh()
    })
  }

  const handlePaymentStatusChange = (paymentId: string, newStatus: 'pending' | 'paid' | 'failed' | 'expired' | 'testing') => {
    // Just update the local state, don't trigger API yet
    setPaymentStatusChanges((prev) => {
      const next = new Map(prev)
      next.set(paymentId, newStatus)
      return next
    })
  }

  const handleCancelPaymentStatusChange = (paymentId: string) => {
    setPaymentStatusChanges((prev) => {
      const next = new Map(prev)
      next.delete(paymentId)
      return next
    })
  }

  const handleSavePaymentStatus = (paymentId: string) => {
    const newStatus = paymentStatusChanges.get(paymentId)
    if (!newStatus) return

    const payment = activePayments.find(p => p.id === paymentId)

    if (!payment) return
    
    const statusLabels = {
      pending: 'PENDING',
      paid: 'PAID (Lunas)',
      failed: 'FAILED (Gagal)',
      expired: 'EXPIRED (Kadaluarsa)',
      testing: 'TESTING'
    }
    
    const confirmMessage = `Ubah status pembayaran dari ${statusLabels[payment.status as keyof typeof statusLabels]} menjadi ${statusLabels[newStatus]}?\n\nRef: ${payment.payment_reference}\n\n${newStatus === 'paid' ? '⚠️ Mengubah ke PAID akan:\n- Mengaktifkan semua peserta\n- Menggenerate QR Code\n- Mengirim email racepack\n- Mengirim notifikasi WhatsApp' : ''}`
    
    if (!window.confirm(confirmMessage)) {
      return
    }
    
    startTransition(async () => {
      const result = await updateAdminPaymentStatus({
        paymentId,
        packageType: paymentPackageType,
        status: newStatus,
        paymentMethod: newStatus === 'paid' ? 'manual_admin' : undefined,
      })
      
      if (result.error) {
        alert(`Gagal mengubah status: ${result.error}`)
      } else {
        alert(result.message || 'Status pembayaran berhasil diubah')
        // Clear the change from state
        setPaymentStatusChanges((prev) => {
          const next = new Map(prev)
          next.delete(paymentId)
          return next
        })
      }
      
      router.refresh()
    })
  }

  const toggleCommunity = (key: string) => {
    setExpandedCommunities((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const openParticipantEditor = (participant: AdminParticipant) => {
    setParticipantEditing(participant)
    setParticipantForm({
      full_name: participant.full_name,
      bib_name: participant.bib_name,
      ktp_number: participant.ktp_number,
      email: participant.email,
      phone: participant.phone,
      date_of_birth: participant.date_of_birth || '',
      gender: participant.gender,
      tshirt_size: participant.tshirt_size,
      blood_type: participant.blood_type || 'A',
      medical_condition: participant.medical_condition || '',
      emergency_contact_name: participant.emergency_contact_name || '',
      emergency_contact_phone: participant.emergency_contact_phone || '',
    })
  }

  const openCommunityEditor = (community: AdminCommunity) => {
    setCommunityEditing(community)
    setCommunityForm({
      id: community.id,
      name: community.name,
      leader_name: community.leader_name,
      email: community.email || '',
      phone: community.phone,
      provinsi: resolveLocationName(community.provinsi) || '',
      kota: resolveLocationName(community.kota) || '',
      kecamatan: resolveLocationName(community.kecamatan) || '',
      password: '',
    })
  }

  const saveParticipant = () => {
    if (!participantEditing || !participantForm) return
    startTransition(async () => {
      const result = await updateAdminParticipant(participantEditing.id, participantForm)
      if (result.error) {
        alert(result.error)
        return
      }
      setParticipantEditing(null)
      setParticipantForm(null)
      router.refresh()
    })
  }

  const saveCommunity = () => {
    if (!communityForm) return
    startTransition(async () => {
      const result = packageType === 'community'
        ? await updateAdminCommunity(communityForm)
        : packageType === 'individual'
        ? await updateAdminIndividual(communityForm)
        : await updateAdminFamily(communityForm)
      if (result.error) {
        alert(result.error)
        return
      }
      setCommunityEditing(null)
      setCommunityForm(null)
      router.refresh()
    })
  }

  const handlePacerApprove = (row: AdminPacerRow) => {
    if (!window.confirm(`Apakah Anda yakin ingin menyetujui (APPROVE) pacer "${row.full_name}"?`)) {
      return
    }
    setProcessingPacerId(row.pacer_id)
    startTransition(async () => {
      try {
        const result = await updateAdminPacerStatus(row.pacer_id, 'approved')
        if (result.error) {
          alert(result.error)
          return
        }
        router.refresh()
      } finally {
        setProcessingPacerId(null)
      }
    })
  }

  const handlePacerReject = (row: AdminPacerRow) => {
    const note = window.prompt('Catatan penolakan (opsional):')
    if (note === null) return // Jika klik Batal di prompt, batalkan aksi

    const confirmMessage = note.trim()
      ? `Apakah Anda yakin ingin menolak (REJECT) pacer "${row.full_name}" dengan catatan: "${note}"?`
      : `Apakah Anda yakin ingin menolak (REJECT) pacer "${row.full_name}"?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    setProcessingPacerId(row.pacer_id)
    startTransition(async () => {
      try {
        const result = await updateAdminPacerStatus(row.pacer_id, 'rejected', note || undefined)
        if (result.error) {
          alert(result.error)
          return
        }
        router.refresh()
      } finally {
        setProcessingPacerId(null)
      }
    })
  }

  const openPacerEdit = (row: AdminPacerRow) => {
    setPacerEditing(row)
    setPacerForm({
      full_name: row.full_name,
      bib_name: row.bib_name,
      ktp_number: row.ktp_number,
      email: row.email,
      phone: row.phone,
      date_of_birth: row.date_of_birth || '',
      gender: row.gender,
      tshirt_size: row.tshirt_size,
      blood_type: row.blood_type || '',
      medical_condition: row.medical_condition || '',
      emergency_contact_name: row.emergency_contact_name || '',
      emergency_contact_phone: row.emergency_contact_phone || '',
      age: row.age ?? 0,
      sosmed_instagram: row.sosmed_instagram || '',
      sosmed_tiktok: row.sosmed_tiktok || '',
      strava_link: row.strava_link || '',
      strava_username: row.strava_username || '',
      bank_name: row.bank_name || '',
      bank_account_number: row.bank_account_number || '',
      bank_account_holder: row.bank_account_holder || '',
      has_smartwatch: row.has_smartwatch,
    })
  }

  const savePacer = () => {
    if (!pacerEditing || !pacerForm) return
    startTransition(async () => {
      const result = await updateAdminPacerParticipant(pacerEditing.id, pacerForm)
      if (result.error) {
        alert(result.error)
        return
      }
      setPacerEditing(null)
      setPacerForm(null)
      router.refresh()
    })
  }

  const updateRegistrantField = (pkg: PackageKey, key: keyof RegistrationFormGroupSettings, value: Partial<FormInputConfig>) => {
    setSettingsForm((current) => ({
      ...current,
      registrationForm: {
        ...current.registrationForm,
        [pkg]: {
          ...current.registrationForm[pkg],
          registrant: {
            ...current.registrationForm[pkg].registrant,
            [key]: { ...current.registrationForm[pkg].registrant[key], ...value },
          },
        },
      },
    }))
  }

  const updateParticipantField = (pkg: PackageKey, key: keyof RegistrationFormParticipantSettings, value: Partial<FormInputConfig>) => {
    setSettingsForm((current) => ({
      ...current,
      registrationForm: {
        ...current.registrationForm,
        [pkg]: {
          ...current.registrationForm[pkg],
          participants: {
            ...current.registrationForm[pkg].participants,
            [key]: { ...current.registrationForm[pkg].participants[key], ...value },
          },
        },
      },
    }))
  }

  const updateSelectOptionLabel = (
    pkg: PackageKey,
    key: 'gender' | 'tshirt_size' | 'blood_type' | 'has_smartwatch',
    value: string,
    label: string
  ) => {
    setSettingsForm((current) => {
      const field = current.registrationForm[pkg].participants[key] as FormSelectConfig
      return {
        ...current,
        registrationForm: {
          ...current.registrationForm,
          [pkg]: {
            ...current.registrationForm[pkg],
            participants: {
              ...current.registrationForm[pkg].participants,
              [key]: {
                ...field,
                options: field.options.map((option) => (option.value === value ? { ...option, label } : option)),
              },
            },
          },
        },
      }
    })
  }

  const addEnvField = () => {
    envFieldCounterRef.current += 1
    setSettingsForm((current) => ({
      ...current,
      envFields: [
        ...current.envFields,
        {
          key: `CUSTOM_ENV_${envFieldCounterRef.current}`,
          label: 'Custom Env',
          description: 'Deskripsi env',
          sensitive: false,
        },
      ],
    }))
  }

  const updateEnvField = (index: number, value: Partial<AdminEditableEnvField>) => {
    setSettingsForm((current) => ({
      ...current,
      envFields: current.envFields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...value } : field)),
    }))
  }

  const removeEnvField = (index: number) => {
    setSettingsForm((current) => ({
      ...current,
      envFields: current.envFields.filter((_, fieldIndex) => fieldIndex !== index),
    }))
  }

  const updateEmailTemplate = (pkg: PackageKey, key: keyof EmailTemplateConfig, value: string) => {
    setSettingsForm((current) => ({
      ...current,
      emailTemplates: {
        ...current.emailTemplates,
        [pkg]: {
          ...current.emailTemplates[pkg],
          [key]: value,
        },
      },
    }))
  }

  const updateWebhookField = (pkg: PackageKey, kind: keyof WebhookPackageConfig, field: 'url' | 'token', value: string) => {
    setSettingsForm((current) => ({
      ...current,
      webhookSettings: {
        ...current.webhookSettings,
        [pkg]: {
          ...current.webhookSettings[pkg],
          [kind]: { ...current.webhookSettings[pkg][kind], [field]: value },
        },
      },
    }))
  }

  const updateSiteAssets = (patch: Partial<AdminSettings['siteAssets']>) => {
    setSettingsForm((current) => ({
      ...current,
      siteAssets: { ...current.siteAssets, ...patch },
    }))
  }

  // ——— Package management setters ———
  const updatePackageField = (pkg: PackageKey, patch: Partial<Omit<PackageConfig, 'periods'>>) => {
    setSettingsForm((current) => ({
      ...current,
      packages: { ...current.packages, [pkg]: { ...current.packages[pkg], ...patch } },
    }))
  }

  const updatePackagePeriod = (pkg: PackageKey, periodIndex: number, patch: Partial<Omit<PackagePeriod, 'categories'>>) => {
    setSettingsForm((current) => {
      const periods = current.packages[pkg].periods.map((period, i) => (i === periodIndex ? { ...period, ...patch } : period))
      return { ...current, packages: { ...current.packages, [pkg]: { ...current.packages[pkg], periods } } }
    })
  }

  const addPackagePeriod = (pkg: PackageKey) => {
    setSettingsForm((current) => {
      const nextIndex = current.packages[pkg].periods.length + 1
      const periods = [
        ...current.packages[pkg].periods,
        {
          key: `periode-${nextIndex}-${Date.now().toString(36)}`,
          label: `Periode ${nextIndex}`,
          registrationStart: '',
          registrationEnd: '',
          paymentStart: '',
          paymentEnd: '',
          eventDate: '',
          categories: [],
        },
      ]
      return { ...current, packages: { ...current.packages, [pkg]: { ...current.packages[pkg], periods } } }
    })
  }

  const removePackagePeriod = (pkg: PackageKey, periodIndex: number) => {
    setSettingsForm((current) => {
      const periods = current.packages[pkg].periods.filter((_, i) => i !== periodIndex)
      return { ...current, packages: { ...current.packages, [pkg]: { ...current.packages[pkg], periods } } }
    })
  }

  const updatePackageCategory = (pkg: PackageKey, periodIndex: number, catIndex: number, patch: Partial<PackageCategory>) => {
    setSettingsForm((current) => {
      const periods = current.packages[pkg].periods.map((period, pi) => {
        if (pi !== periodIndex) return period
        const categories = period.categories.map((cat, ci) => (ci === catIndex ? { ...cat, ...patch } : cat))
        return { ...period, categories }
      })
      return { ...current, packages: { ...current.packages, [pkg]: { ...current.packages[pkg], periods } } }
    })
  }

  const addPackageCategory = (pkg: PackageKey, periodIndex: number) => {
    setSettingsForm((current) => {
      const periods = current.packages[pkg].periods.map((period, pi) =>
        pi === periodIndex ? { ...period, categories: [...period.categories, { value: '', label: '', price: 0, quota: 0 }] } : period
      )
      return { ...current, packages: { ...current.packages, [pkg]: { ...current.packages[pkg], periods } } }
    })
  }

  const removePackageCategory = (pkg: PackageKey, periodIndex: number, catIndex: number) => {
    setSettingsForm((current) => {
      const periods = current.packages[pkg].periods.map((period, pi) =>
        pi === periodIndex ? { ...period, categories: period.categories.filter((_, ci) => ci !== catIndex) } : period
      )
      return { ...current, packages: { ...current.packages, [pkg]: { ...current.packages[pkg], periods } } }
    })
  }

  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 2MB.')
      return null
    }
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Gagal upload gambar.')
        return null
      }
      return data.url as string
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal upload gambar.')
      return null
    }
  }

  const handleSizeChartUpload = async (pkg: PackageKey, file: File | undefined) => {
    if (!file) return
    setUploadingAsset(`sizeChart-${pkg}`)
    const url = await uploadImageToCloudinary(file)
    setUploadingAsset(null)
    if (url) updatePackageField(pkg, { sizeChartImage: url })
  }

  const handleSiteAssetUpload = async (key: keyof AdminSettings['siteAssets'], file: File | undefined) => {
    if (!file) return
    setUploadingAsset(key)
    const url = await uploadImageToCloudinary(file)
    setUploadingAsset(null)
    if (url) updateSiteAssets({ [key]: url })
  }

  const savePackages = () => {
    setSettingsMessage('')
    startTransition(async () => {
      const result = await saveRegistrationFormSettings(settingsForm)
      if (result.error) {
        alert(result.error)
        return
      }
      setSettingsMessage('Pengaturan paket berhasil disimpan.')
      router.refresh()
    })
  }

  const saveEnv = () => {
    setSettingsMessage('')
    startTransition(async () => {
      const result = await saveEditableEnvValues(envForm)
      if (result.error) {
        alert(result.error)
        return
      }
      if (result.env) setEnvSnapshots(result.env)
      setEnvForm({})
      setSettingsMessage(result.message || 'Konfigurasi env berhasil disimpan.')
    })
  }

  const handleCreateAdmin = () => {
    setAdminMessage('')
    startTransition(async () => {
      const result = await createManagedAdmin(adminCreateForm)
      if (result.error) {
        setAdminMessage(result.error)
        return
      }
      setAdminCreateForm({ name: '', username: '', password: '', role: 'admin', allowed_tabs: ['summary', 'participants', 'payments', 'pacer'] })
      setAdminMessage('Akun admin baru berhasil dibuat.')
      router.refresh()
    })
  }

  const handleUpdateAdmin = () => {
    if (!adminEditForm) return
    setAdminMessage('')
    startTransition(async () => {
      const result = await updateManagedAdmin({
        id: adminEditForm.id,
        name: adminEditForm.name,
        username: adminEditForm.username,
        password: adminEditForm.password || undefined,
        is_active: adminEditForm.is_active,
        role: adminEditForm.role,
        allowed_tabs: adminEditForm.allowed_tabs,
      })
      if (result.error) {
        setAdminMessage(result.error)
        return
      }
      setAdminEditForm(null)
      setAdminMessage('Data admin berhasil diperbarui.')
      router.refresh()
    })
  }

  const handleDeleteAdmin = (adminId: string, adminName: string) => {
    const confirmed = window.confirm(`Hapus akun admin "${adminName}"?`)
    if (!confirmed) return
    setAdminMessage('')
    startTransition(async () => {
      const result = await deleteManagedAdmin(adminId)
      if (result.error) {
        setAdminMessage(result.error)
        return
      }
      setAdminMessage('Akun admin berhasil dihapus.')
      router.refresh()
    })
  }

  const toggleExportCommunity = (communityId: string) => {
    setSelectedExportCommunities((current) => {
      const base = current ?? new Set(communitiesForExport.map((c) => c.id))
      const next = new Set(base)
      if (next.has(communityId)) next.delete(communityId)
      else next.add(communityId)
      return next
    })
  }

  const setAllExportCommunities = (checked: boolean) => {
    setSelectedExportCommunities(checked ? new Set(communitiesForExport.map((c) => c.id)) : new Set())
  }

  const fetchLogs = (mode: 'silent' | 'manual' = 'manual') => {
    if (mode === 'manual') setLogsMessage('')
    startTransition(async () => {
      const result = await refreshAxiomLogs()
      if (result.error) {
        if (mode === 'manual') setLogsMessage(result.error)
        else setLogsMessage(result.error)
      } else if (mode === 'manual') {
        setLogsMessage('Log Axiom berhasil diperbarui.')
      }
      setLogs(result.logs)
    })
  }

  const handleRefreshLogs = () => fetchLogs('manual')

  useEffect(() => {
    if (activeTab !== 'logs') return
    if (currentAdmin.role !== 'superadmin') return

    const kickoffId = window.setTimeout(() => fetchLogs('silent'), 0)
    const intervalId = window.setInterval(() => fetchLogs('silent'), 10_000)
    return () => {
      window.clearTimeout(kickoffId)
      window.clearInterval(intervalId)
    }
  }, [activeTab, currentAdmin.role])

  // Field wajib diisi (sesuai skema validasi) ditandai '*' di judul editor — bantu admin
  // lihat sekilas field mana yang benar-benar mandatory di form publik.
  const communitySettingFields: Array<[keyof RegistrationFormGroupSettings, string]> = [
    ['name', 'Nama Komunitas *'],
    ['leader_name', 'Nama Ketua / PIC *'],
    ['phone', 'No. WhatsApp Ketua *'],
    ['email', 'Email Komunitas *'],
    ['category', 'Kategori *'],
    ['provinsi', 'Provinsi *'],
    ['kota', 'Kota / Kabupaten *'],
    ['kecamatan', 'Kecamatan *'],
    ['password', 'Password *'],
    ['confirmPassword', 'Konfirmasi Password *'],
  ]

  const participantInputSettingFields: Array<[keyof RegistrationFormParticipantSettings, string]> = [
    ['full_name', 'Nama Lengkap Peserta *'],
    ['bib_name', 'Nama BIB *'],
    ['ktp_number', 'No. KTP *'],
    ['email', 'Email Peserta *'],
    ['phone', 'No. WhatsApp Peserta *'],
    ['date_of_birth', 'Tanggal Lahir *'],
    ['medical_condition', 'Penyakit Bawaan'],
    ['emergency_contact_name', 'Nama Kontak Darurat *'],
    ['emergency_contact_phone', 'No. Kontak Darurat *'],
  ]

  const participantSelectSettingFields: Array<['gender' | 'tshirt_size' | 'blood_type', string]> = [
    ['gender', 'Jenis Kelamin *'],
    ['tshirt_size', 'Ukuran Jersey *'],
    ['blood_type', 'Golongan Darah *'],
  ]

  // Field khusus Pacer — hanya ditampilkan saat mengedit form paket Pacer, supaya
  // editor Community/Bro & Sist/Individu tidak berantakan dengan field yang tak mereka pakai.
  const pacerOnlyInputFields: Array<[keyof RegistrationFormParticipantSettings, string]> = [
    ['age', 'Usia *'],
    ['sosmed_instagram', 'Instagram *'],
    ['sosmed_tiktok', 'TikTok'],
    ['strava_link', 'Link Akun Strava'],
    ['strava_username', 'Username Strava'],
    ['bank_name', 'Nama Bank *'],
    ['bank_account_number', 'No. Rekening *'],
    ['bank_account_holder', 'Nama Pemilik Rekening *'],
  ]

  const pacerOnlySelectFields: Array<['has_smartwatch', string]> = [
    ['has_smartwatch', 'Punya Smartwatch? *'],
  ]

  const allAdminTabs: Array<{ id: AdminTab; label: string; icon: typeof QrCode }> = [
    { id: 'summary', label: 'Ringkasan', icon: BarChart3 },
    { id: 'scanner', label: 'Scan Racepack', icon: QrCode },
    { id: 'participants', label: 'Peserta', icon: Users },
    { id: 'payments', label: 'Pembayaran', icon: CreditCard },
    { id: 'export_participants', label: 'Export Peserta', icon: Download },
    { id: 'export_payments', label: 'Export Pembayaran', icon: Download },
    { id: 'pacer', label: 'Pacer', icon: UserCheck },
    ...(currentAdmin.role === 'superadmin' ? [{ id: 'packages' as const, label: 'Kelola Paket', icon: Package }] : []),
    ...(currentAdmin.role === 'superadmin' ? [{ id: 'periods' as const, label: 'Kelola Periode', icon: Calendar }] : []),
    ...(currentAdmin.role === 'superadmin' ? [{ id: 'vouchers' as const, label: 'Voucher', icon: TicketCheck }] : []),
    ...(currentAdmin.role === 'superadmin' ? [{ id: 'logs' as const, label: 'Log Axiom', icon: Activity }] : []),
    ...(currentAdmin.role === 'superadmin' ? [{ id: 'admins' as const, label: 'Kelola Admin', icon: Users }] : []),
    ...(currentAdmin.role === 'superadmin' ? [{ id: 'settings' as const, label: 'Pengaturan', icon: Settings }] : []),
  ]

  const adminTabs = allAdminTabs.filter(
    (tab) => currentAdmin.role === 'superadmin' || currentAdmin.allowed_tabs?.includes(tab.id)
  )

  return (
    <div className="min-h-screen bg-brand-dark text-foreground flex flex-col md:flex-row relative">
      {/* Ambient glows */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-sport-orange/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-sport-red/5 rounded-full blur-3xl pointer-events-none z-0" />

      {/* MOBILE HEADER (Always Visible on Mobile) */}
      <header className="md:hidden w-full sports-glass sticky top-0 z-30 border-b border-card-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/images/header.png"
            alt="TOPSELL RUN 2026"
            width={136}
            height={38}
            className="h-7 w-auto object-contain"
            priority
          />
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg bg-brand-gray/40 border border-card-border text-brand-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </header>

      {/* SIDEBAR BACKDROP (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`w-64 bg-linear-to-b from-[#1E0800] via-[#3D1100] to-[#661C00] border-r border-white/10 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
          <Image
            src="/images/header.png"
            alt="TOPSELL RUN 2026"
            width={152}
            height={43}
            className="h-8 w-auto object-contain"
            priority
          />
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1.5">
          {adminTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSidebarOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/15 text-white border border-white/20 font-black shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/50'}`} />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-white text-xs">
              {currentAdmin.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-white truncate uppercase">{currentAdmin.name}</p>
              <p className="text-[8px] font-bold text-white/60 truncate">@{currentAdmin.username} • {currentAdmin.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[10px] font-black uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
            onClick={handleLogout}
            isLoading={isPending}
          >
            <LogOut className="w-3.5 h-3.5 mr-2 text-white/70" />Keluar
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen relative z-10">
        {/* Header bar */}
        <header className="hidden md:flex bg-brand-dark/50 backdrop-blur-md sticky top-0 z-20 border-b border-card-border px-6 py-4 items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-foreground">
              {activeTab === 'summary'
                ? 'Ringkasan Admin'
                : activeTab === 'scanner'
                ? 'Scan Racepack'
                : activeTab === 'participants'
                ? 'Daftar Peserta'
                : activeTab === 'payments'
                ? 'Daftar Pembayaran'
                : activeTab === 'export_participants'
                ? 'Export Peserta'
                : activeTab === 'export_payments'
                ? 'Export Pembayaran'
                : activeTab === 'logs'
                ? 'Log Axiom'
                : activeTab === 'admins'
                ? 'Manajemen Admin'
                : 'Pengaturan Form'}
            </h2>
            <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mt-0.5">
              {activeTab === 'summary'
                ? 'Statistik utama admin dan tren registrasi peserta'
                : activeTab === 'scanner'
                ? 'Validasi QR & Pengambilan Racepack Peserta'
                : activeTab === 'participants'
                ? 'Kelola komunitas & anggota terdaftar'
                : activeTab === 'payments'
                ? 'Riwayat pembayaran kolektif komunitas'
                : activeTab === 'export_participants'
                ? 'Ekspor data peserta per komunitas'
                : activeTab === 'export_payments'
                ? 'Ekspor data pembayaran per komunitas'
                : activeTab === 'logs'
                ? 'Monitoring log aplikasi dari Axiom'
                : activeTab === 'admins'
                ? 'Kelola akun admin yang dapat mengakses panel'
                : 'Konfigurasi form pendaftaran & environment'}
            </p>
          </div>

          {(activeTab === 'participants' || activeTab === 'payments') && (
            <div className="flex items-center gap-3">
              <label className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeTab === 'payments'
                      ? 'Cari pembayaran...'
                      : 'Cari peserta, komunitas...'
                  }
                  className="w-full pl-9 pr-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-[10px] font-bold uppercase tracking-wider text-foreground placeholder:text-brand-muted/70 focus:outline-none focus:border-sport-orange"
                />
              </label>
            </div>
          )}
        </header>

        {/* Mobile-only Search Bar (Visible under mobile header when participants or payments tab) */}
        {(activeTab === 'participants' || activeTab === 'payments') && (
          <div className="md:hidden px-4 py-3 border-b border-card-border/50 bg-brand-dark/20">
            <label className="relative w-full block">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  activeTab === 'payments'
                    ? 'Cari pembayaran...'
                    : 'Cari peserta, komunitas...'
                }
                className="w-full pl-9 pr-3 py-2.5 bg-brand-gray/40 border border-card-border rounded-lg text-[10px] font-bold uppercase tracking-wider text-foreground placeholder:text-brand-muted focus:outline-none focus:border-sport-orange"
              />
            </label>
          </div>
        )}

        {/* Main Section */}
        <section className="flex-1 p-4 md:p-6 flex flex-col gap-5 max-w-7xl w-full mx-auto">
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Statistik Per Paket</p>
                <select
                  value={summaryPackage}
                  onChange={(e) => setSummaryPackage(e.target.value as 'all' | DashboardPackageKey)}
                  className="px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs font-bold text-foreground"
                >
                  <option value="all">Semua Paket</option>
                  <option value="community">Community Package</option>
                  <option value="family">Bro & Sist Package</option>
                  <option value="individual">Individu</option>
                </select>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Komunitas', value: summaryPackage === 'all' ? (activeSummary?.stats.communities ?? stats.communities) : (activeSummary?.stats.communities ?? 0), icon: <Activity className="w-4 h-4" /> },
                  { label: 'Peserta', value: summaryPackage === 'all' ? (activeSummary?.stats.participants ?? stats.participants) : (activeSummary?.stats.participants ?? 0), icon: <Users className="w-4 h-4" /> },
                  { label: 'Lunas', value: summaryPackage === 'all' ? (activeSummary?.stats.paidParticipants ?? stats.paidParticipants) : (activeSummary?.stats.paidParticipants ?? 0), icon: <CheckCircle className="w-4 h-4" /> },
                  { label: 'Pending', value: summaryPackage === 'all' ? (activeSummary?.stats.pendingParticipants ?? stats.pendingParticipants) : (activeSummary?.stats.pendingParticipants ?? 0), icon: <CreditCard className="w-4 h-4" /> },
                  { label: 'Racepack', value: summaryPackage === 'all' ? (activeSummary?.stats.racepacksPickedUp ?? stats.racepacksPickedUp) : (activeSummary?.stats.racepacksPickedUp ?? 0), icon: <TicketCheck className="w-4 h-4" /> },
                  { label: 'Revenue', value: formatCurrency(summaryPackage === 'all' ? (activeSummary?.stats.revenue ?? stats.revenue) : (activeSummary?.stats.revenue ?? 0)), icon: <CreditCard className="w-4 h-4" /> },
                ].map((item) => (
                  <div key={item.label} className="bg-card-bg border border-card-border rounded-lg p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-sport-orange/30 transition-colors">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted mb-0.5">{item.label}</p>
                      <p className="text-base font-black text-foreground">{item.value}</p>
                    </div>
                    <div className="p-2 bg-sport-orange/10 border border-sport-orange/20 rounded-lg text-sport-orange">
                      {item.icon}
                    </div>
                  </div>
                ))}
              </div>

              {/* Participants Chart */}
              <section className="bg-card-bg border border-card-border rounded-lg p-4 md:p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Diagram Peserta</p>
                    <h2 className="text-sm font-black uppercase text-foreground">Jumlah Peserta Per Hari (14 Hari Terakhir)</h2>
                  </div>
                  <Badge variant="neutral">{summaryPackage === 'all' ? (activeSummary?.daily.reduce((sum, item) => sum + item.participants, 0) ?? dailyParticipants.reduce((sum, item) => sum + item.count, 0)) : (activeSummary?.daily.reduce((sum, item) => sum + item.participants, 0) ?? 0)} Peserta</Badge>
                </div>
                <div className="h-64 w-full">
                  {summaryLoading || !activeSummary ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-brand-muted text-sm">Memuat data...</div>
                    </div>
                  ) : (
                    <Bar
                      data={{
                        labels: activeSummary.daily.map(d => d.label),
                        datasets: [
                          {
                            label: 'Peserta Baru',
                            data: activeSummary.daily.map(d => d.participants),
                            backgroundColor: 'rgba(255, 107, 53, 0.8)',
                            borderColor: 'rgba(255, 69, 0, 1)',
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                        },
                        scales: {
                          y: { beginAtZero: true },
                        },
                      }}
                    />
                  )}
                </div>
              </section>

              {/* Revenue Chart */}
              <section className="bg-card-bg border border-card-border rounded-lg p-4 md:p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Diagram Pendapatan</p>
                    <h2 className="text-sm font-black uppercase text-foreground">Pendapatan Per Hari (14 Hari Terakhir)</h2>
                  </div>
                  <Badge variant="neutral">{formatCurrency(activeSummary?.daily.reduce((sum, item) => sum + item.revenue, 0) ?? 0)}</Badge>
                </div>
                <div className="h-64 w-full">
                  {summaryLoading || !activeSummary ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-brand-muted text-sm">Memuat data...</div>
                    </div>
                  ) : (
                    <Line
                      data={{
                        labels: activeSummary.daily.map(d => d.label),
                        datasets: [
                          {
                            label: 'Revenue',
                            data: activeSummary.daily.map(d => d.revenue),
                            borderColor: 'rgba(34, 197, 94, 1)',
                            backgroundColor: 'rgba(34, 197, 94, 0.2)',
                            tension: 0.4,
                            fill: true,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return formatCurrency(context.parsed.y ?? 0)
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number)
                              }
                            }
                          },
                        },
                      }}
                    />
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ACTIVE TAB CONTENT */}
          {activeTab === 'scanner' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-4">
              <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Scanner QR</p>
                    <h2 className="text-sm font-black uppercase text-foreground">Pengambilan Racepack</h2>
                  </div>
                  <QrCode className="w-5 h-5 text-sport-orange" />
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <div className="relative aspect-video bg-brand-dark border border-card-border rounded-lg overflow-hidden flex items-center justify-center">
                    <div id={scanRegionId} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
                    {!cameraActive && (
                      <div className="absolute flex flex-col items-center gap-2 text-brand-muted">
                        <Camera className="w-8 h-8" />
                        <span className="text-xs font-bold uppercase">Scanner belum aktif</span>
                      </div>
                    )}
                  </div>
                  {cameraError && <p className="text-xs text-red-400 font-medium">{cameraError}</p>}
                  <div className="flex gap-2">
                    <Button type="button" className="flex-1" onClick={startCamera} disabled={cameraActive || isPending}>
                      <Camera className="w-4 h-4 mr-2" />Aktifkan Kamera
                    </Button>
                    <Button type="button" variant="secondary" onClick={stopCamera} disabled={!cameraActive}>
                      Stop
                    </Button>
                  </div>
                </div>
              </section>

              <section className="bg-card-bg border border-card-border rounded-lg p-4 flex flex-col gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Hasil Scan</p>
                  <h2 className="text-sm font-black uppercase text-foreground">Validasi Peserta</h2>
                </div>
                {!scanResult ? (
                  <div className="min-h-64 border border-card-border rounded-lg bg-brand-gray/20 flex flex-col items-center justify-center text-center gap-2 p-6">
                    <QrCode className="w-8 h-8 text-brand-muted" />
                    <p className="text-xs font-bold uppercase text-brand-muted">Belum ada QR discan</p>
                    <p className="text-[10px] text-brand-muted leading-relaxed">
                      Arahkan kamera ke Race Pass peserta. Detail peserta akan muncul di sini untuk dicocokkan oleh petugas.
                    </p>
                  </div>
                ) : (
                  <div className="border border-card-border rounded-lg p-4 bg-brand-gray/30 flex flex-col gap-4">
                    <div>
                      <Badge variant={scanResult.variant}>{scanResult.title}</Badge>
                      <p className="text-xs text-brand-muted mt-2 leading-relaxed">{scanResult.body}</p>
                    </div>

                    {scanResult.participant && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-card-border pt-4">
                        {[
                          { label: 'Nama Lengkap', value: scanResult.participant.full_name },
                          { label: 'Nama BIB', value: scanResult.participant.bib_name },
                          { label: 'Nomor BIB', value: scanResult.participant.participant_code || '-' },
                          { label: 'Tanggal Lahir', value: scanResult.participant.date_of_birth || '-' },
                          { label: 'Ukuran Baju', value: scanResult.participant.tshirt_size },
                          { label: 'Gender', value: scanResult.participant.gender === 'male' ? 'Laki-laki' : 'Perempuan' },
                          { label: 'Gol. Darah', value: scanResult.participant.blood_type || '-' },
                          { label: 'Nama Kontak Darurat', value: scanResult.participant.emergency_contact_name || '-' },
                          { label: 'No. Kontak Darurat', value: scanResult.participant.emergency_contact_phone || '-' },
                          { label: 'WhatsApp', value: scanResult.participant.phone },
                          { label: 'Email', value: scanResult.participant.email },
                          { label: 'Komunitas', value: firstRelation(scanResult.participant.community)?.name || '-' },
                          { label: 'Kode Komunitas', value: firstRelation(scanResult.participant.community)?.community_code || '-' },
                          { label: 'Status Bayar', value: scanResult.participant.payment_status === 'paid' ? 'Paid' : scanResult.participant.payment_status === 'failed' ? 'Failed' : scanResult.participant.payment_status === 'expired' ? 'Expired' : 'Pending' },
                          { label: 'Racepack', value: scanResult.participant.checked_in ? 'Sudah diambil' : 'Belum diambil' },
                          { label: 'Waktu Ambil', value: formatDateTime(scanResult.participant.checked_in_at) },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg border border-card-border bg-brand-dark/30 p-3 min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">{item.label}</p>
                            <p className="text-sm font-bold text-foreground wrap-break-word">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'participants' && (
            <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
              <div className="flex border-b border-card-border">
                <button
                  onClick={() => setPackageType('community')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'community'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Community Package
                </button>
                <button
                  onClick={() => setPackageType('family')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'family'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Bro & Sist Package
                </button>
                <button
                  onClick={() => setPackageType('individual')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'individual'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Individu
                </button>
              </div>

              {/* Filter Tanggal & Pengurutan Toolbar */}
              <div className="p-3.5 bg-brand-dark/40 border-b border-card-border flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
                {/* Date Filter & Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-brand-muted text-[10px] font-black uppercase tracking-wider">
                    <CalendarDays className="w-3.5 h-3.5 text-sport-orange" />
                    <span>Tgl Daftar:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 bg-brand-gray/30 p-1 rounded-lg border border-card-border">
                    {(
                      [
                        { id: 'all', label: 'Semua' },
                        { id: 'today', label: 'Hari Ini' },
                        { id: '7d', label: '7 Hari' },
                        { id: '30d', label: '30 Hari' },
                        { id: 'this_month', label: 'Bulan Ini' },
                      ] as const
                    ).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleDatePresetChange(preset.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                          participantDatePreset === preset.id
                            ? 'bg-sport-orange text-white shadow-xs'
                            : 'text-brand-muted hover:text-foreground hover:bg-brand-gray/50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom date range inputs */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={participantStartDate}
                      onChange={(e) => {
                        setParticipantStartDate(e.target.value)
                        setParticipantDatePreset('custom')
                      }}
                      className="px-2 py-1 bg-brand-gray/40 border border-card-border rounded text-[10px] font-bold text-foreground focus:outline-none focus:border-sport-orange cursor-pointer"
                      title="Dari Tanggal Pendaftaran"
                    />
                    <span className="text-[10px] text-brand-muted font-bold">-</span>
                    <input
                      type="date"
                      value={participantEndDate}
                      onChange={(e) => {
                        setParticipantEndDate(e.target.value)
                        setParticipantDatePreset('custom')
                      }}
                      className="px-2 py-1 bg-brand-gray/40 border border-card-border rounded text-[10px] font-bold text-foreground focus:outline-none focus:border-sport-orange cursor-pointer"
                      title="Sampai Tanggal Pendaftaran"
                    />

                    {(participantStartDate || participantEndDate) && (
                      <button
                        type="button"
                        onClick={() => handleDatePresetChange('all')}
                        className="p-1 text-brand-muted hover:text-sport-red hover:bg-sport-red/10 rounded transition-colors cursor-pointer"
                        title="Reset Filter Tanggal"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sorting Controls */}
                <div className="flex items-center gap-2 self-start xl:self-auto">
                  <div className="flex items-center gap-1.5 text-brand-muted text-[10px] font-black uppercase tracking-wider">
                    <ArrowUpDown className="w-3.5 h-3.5 text-sport-orange" />
                    <span>Urutkan:</span>
                  </div>
                  <select
                    value={participantSort}
                    onChange={(e) => setParticipantSort(e.target.value as 'newest' | 'oldest' | 'name_asc' | 'name_desc')}
                    className="px-2.5 py-1.5 bg-brand-gray/40 border border-card-border rounded-lg text-[10px] font-bold text-foreground focus:outline-none focus:border-sport-orange cursor-pointer"
                  >
                    <option value="newest">⚡ Pendaftaran Terbaru</option>
                    <option value="oldest">⏳ Pendaftaran Terlama</option>
                    <option value="name_asc">🔤 Abjad (A → Z)</option>
                    <option value="name_desc">🔤 Abjad (Z → A)</option>
                  </select>
                </div>
              </div>

              <div className="bg-brand-dark/30 border-b border-card-border px-4 py-3 grid grid-cols-[1fr_auto] gap-3 items-center">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">
                    {entityLabel}
                  </p>
                  <p className="text-xs font-bold text-foreground">
                    {groupedParticipants.length} {groupWord} ditemukan
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(participantStartDate || participantEndDate) && (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-sport-orange/10 border border-sport-orange/30 text-[9px] font-bold text-sport-orange">
                      Filter Tanggal Aktif
                    </span>
                  )}
                  <p className="text-[10px] font-bold text-brand-muted">{filteredParticipants.length} peserta</p>
                </div>
              </div>

              {groupedParticipants.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-bold text-foreground">Data peserta tidak ditemukan</p>
                  <p className="text-xs text-brand-muted mt-1">Coba gunakan kata pencarian lain atau ubah filter tanggal.</p>
                  {(participantStartDate || participantEndDate || query) && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        handleDatePresetChange('all')
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sport-orange text-white text-[10px] font-bold uppercase cursor-pointer hover:bg-sport-orange/90 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Semua Filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-card-border">
                  {groupedParticipants.map((group) => {
                    const isOpen = expandedCommunities.has(group.key)
                    const editableCommunity = communitiesByKey.get(group.key)
                    const paidCount = group.participants.filter((participant) => participant.payment_status === 'paid').length
                    const pickedUpCount = group.participants.filter((participant) => participant.checked_in).length
                    const pendingCount = group.participants.filter((participant) => participant.payment_status === 'pending').length

                    return (
                      <div key={group.key}>
                        <div className="w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto_auto] gap-3 text-left items-center hover:bg-brand-gray/20 transition-colors">
                          <div className="min-w-0 flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleCommunity(group.key)}
                              className="mt-0.5 p-1.5 rounded-lg bg-brand-gray/40 border border-card-border text-brand-muted cursor-pointer"
                            >
                              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-foreground wrap-break-word">{group.name}</p>
                              <div className="text-[10px] font-bold text-brand-muted flex flex-wrap items-center gap-2 mt-0.5">
                                <span>{group.code}</span>
                                {editableCommunity && (editableCommunity.provinsi || editableCommunity.kota || editableCommunity.kecamatan) && (
                                  <span className="px-1.5 py-0.5 rounded bg-brand-gray/50 text-[9px] font-bold text-foreground">
                                    {[
                                      resolveLocationName(editableCommunity.kecamatan),
                                      resolveLocationName(editableCommunity.kota),
                                      resolveLocationName(editableCommunity.provinsi),
                                    ].filter((v) => v && v !== '-').join(', ') || '-'}
                                  </span>
                                )}
                                {group.latestCreatedAt > 0 && (
                                  <span className="text-[9px] text-brand-muted flex items-center gap-1 font-medium">
                                    <Clock className="w-2.5 h-2.5 text-sport-orange/70" />
                                    Daftar: {formatDateTime(new Date(group.latestCreatedAt).toISOString())}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Badge variant="neutral">{group.participants.length} Peserta</Badge>
                            <Badge variant={paidCount === group.participants.length ? 'success' : 'warning'}>
                              {paidCount} Lunas
                            </Badge>
                            {pendingCount > 0 && <Badge variant="warning">{pendingCount} Pending</Badge>}
                          </div>

                          <div className="text-xs font-bold text-brand-muted lg:text-right">
                            Racepack
                            <span className="block text-sm font-black text-foreground">{pickedUpCount}/{group.participants.length}</span>
                          </div>

                          <div className="flex items-center gap-2 lg:justify-end">
                            {editableCommunity && (
                              <button
                                type="button"
                                onClick={() => openCommunityEditor(editableCommunity)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-card-border rounded text-[9px] font-black uppercase text-brand-muted hover:text-foreground cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />Edit {packageType === 'community' ? 'Komunitas' : packageType === 'individual' ? 'Peserta' : 'Grup'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleCommunity(group.key)}
                              className="text-[10px] font-black uppercase tracking-wider text-sport-orange cursor-pointer"
                            >
                              {isOpen ? 'Tutup Detail' : 'Lihat Detail'}
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="border-t border-card-border bg-brand-dark/20 overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-card-border">
                                  {['Peserta', 'Status', 'Racepack', 'Kontak', 'Jersey', 'Aksi'].map((heading) => (
                                    <th key={heading} className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-brand-muted">{heading}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {group.participants.map((participant) => (
                                  <tr key={participant.id} className="border-b border-card-border last:border-b-0 hover:bg-brand-gray/20">
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-bold text-foreground">{participant.full_name}</p>
                                      <p className="text-[10px] text-sport-orange font-bold">{participant.participant_code || 'Belum ada kode'}</p>
                                      <p className="text-[10px] text-brand-muted">{participant.bib_name}</p>
                                      {participant.created_at && (
                                        <p className="text-[9px] text-brand-muted/80 flex items-center gap-1 mt-0.5">
                                          <Clock className="w-2.5 h-2.5 text-sport-orange/70" />
                                          {formatDateTime(participant.created_at)}
                                        </p>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge
                                        variant={
                                          participant.payment_status === 'testing'
                                            ? 'warning'
                                            : participant.payment_status === 'paid'
                                            ? 'success'
                                            : participant.payment_status === 'failed'
                                            ? 'danger'
                                            : participant.payment_status === 'expired'
                                            ? 'neutral'
                                            : 'warning'
                                        }
                                      >
                                        {participant.payment_status === 'testing'
                                          ? 'TESTING'
                                          : participant.payment_status === 'paid'
                                          ? 'Paid'
                                          : participant.payment_status === 'failed'
                                          ? 'Failed'
                                          : participant.payment_status === 'expired'
                                          ? 'Expired'
                                          : 'Pending'}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge variant={participant.checked_in ? 'success' : 'neutral'}>
                                        {participant.checked_in ? 'Sudah Diambil' : 'Belum'}
                                      </Badge>
                                      <p className="text-[10px] text-brand-muted mt-1">{formatDateTime(participant.checked_in_at)}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <p className="text-xs text-foreground">{participant.phone}</p>
                                      <p className="text-[10px] text-brand-muted break-all">{participant.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-black text-foreground">{participant.tshirt_size}</td>
                                    <td className="px-4 py-3">
                                      <button
                                        type="button"
                                        onClick={() => openParticipantEditor(participant)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-card-border rounded text-[9px] font-black uppercase text-brand-muted hover:text-foreground cursor-pointer"
                                      >
                                        <Pencil className="w-3 h-3" />Edit
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {activeTab === 'payments' && (
            <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
              <div className="flex border-b border-card-border">
                <button
                  onClick={() => setPackageType('community')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'community'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Community Package
                </button>
                <button
                  onClick={() => setPackageType('family')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'family'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Bro & Sist Package
                </button>
                <button
                  onClick={() => setPackageType('individual')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'individual'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Individu
                </button>
              </div>

              {/* Filter Toolbar: Status Filter Buttons */}
              <div className="p-3.5 bg-brand-dark/40 border-b border-card-border flex flex-col gap-3 text-xs">
                {/* Status Badges Filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-1.5 text-brand-muted text-[10px] font-black uppercase tracking-wider mr-1">
                    <Filter className="w-3.5 h-3.5 text-sport-orange" />
                    <span>Status:</span>
                  </div>
                  {(
                    [
                      { id: 'all', label: 'Semua Status', count: paymentStats.total, activeColor: 'bg-sport-orange text-white border-sport-orange shadow-xs', badgeColor: 'bg-white/20 text-white' },
                      { id: 'pending', label: 'Pending', count: paymentStats.pending, activeColor: 'bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-xs', badgeColor: 'bg-amber-500/20 text-amber-500' },
                      { id: 'paid', label: 'Success', count: paymentStats.paid, activeColor: 'bg-green-500/20 text-green-500 border-green-500/50 shadow-xs', badgeColor: 'bg-green-500/20 text-green-500' },
                      { id: 'failed', label: 'Failed', count: paymentStats.failed, activeColor: 'bg-red-500/20 text-red-500 border-red-500/50 shadow-xs', badgeColor: 'bg-red-500/20 text-red-500' },
                      { id: 'expired', label: 'Expired', count: paymentStats.expired, activeColor: 'bg-gray-500/20 text-gray-400 border-gray-500/50 shadow-xs', badgeColor: 'bg-gray-500/20 text-gray-400' },
                      { id: 'testing', label: 'Testing', count: paymentStats.testing, activeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-xs', badgeColor: 'bg-blue-500/20 text-blue-400' },
                    ] as const
                  ).map((tab) => {
                    const isActive = paymentStatusFilter === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPaymentStatusFilter(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border cursor-pointer ${
                          isActive
                            ? tab.activeColor
                            : 'bg-brand-gray/30 border-card-border text-brand-muted hover:text-foreground hover:bg-brand-gray/50'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            isActive
                              ? tab.id === 'all'
                                ? 'bg-black/20 text-white'
                                : tab.badgeColor
                              : 'bg-brand-dark/40 text-brand-muted'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Date & Sort Filter */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-2 border-t border-card-border/50">
                  {/* Date Filter & Presets */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-brand-muted text-[10px] font-black uppercase tracking-wider">
                      <CalendarDays className="w-3.5 h-3.5 text-sport-orange" />
                      <span>Tgl Bayar:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 bg-brand-gray/30 p-1 rounded-lg border border-card-border">
                      {(
                        [
                          { id: 'all', label: 'Semua' },
                          { id: 'today', label: 'Hari Ini' },
                          { id: '7d', label: '7 Hari' },
                          { id: '30d', label: '30 Hari' },
                          { id: 'this_month', label: 'Bulan Ini' },
                        ] as const
                      ).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handlePaymentDatePresetChange(preset.id)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                            paymentDatePreset === preset.id
                              ? 'bg-sport-orange text-white shadow-xs'
                              : 'text-brand-muted hover:text-foreground hover:bg-brand-gray/50'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom date range inputs */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={paymentStartDate}
                        onChange={(e) => {
                          setPaymentStartDate(e.target.value)
                          setPaymentDatePreset('custom')
                        }}
                        className="px-2 py-1 bg-brand-gray/40 border border-card-border rounded text-[10px] font-bold text-foreground focus:outline-none focus:border-sport-orange cursor-pointer"
                        title="Dari Tanggal Pembayaran"
                      />
                      <span className="text-[10px] text-brand-muted font-bold">-</span>
                      <input
                        type="date"
                        value={paymentEndDate}
                        onChange={(e) => {
                          setPaymentEndDate(e.target.value)
                          setPaymentDatePreset('custom')
                        }}
                        className="px-2 py-1 bg-brand-gray/40 border border-card-border rounded text-[10px] font-bold text-foreground focus:outline-none focus:border-sport-orange cursor-pointer"
                        title="Sampai Tanggal Pembayaran"
                      />

                      {(paymentStartDate || paymentEndDate) && (
                        <button
                          type="button"
                          onClick={() => handlePaymentDatePresetChange('all')}
                          className="p-1 text-brand-muted hover:text-sport-red hover:bg-sport-red/10 rounded transition-colors cursor-pointer"
                          title="Reset Filter Tanggal"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sorting Controls */}
                  <div className="flex items-center gap-2 self-start xl:self-auto">
                    <div className="flex items-center gap-1.5 text-brand-muted text-[10px] font-black uppercase tracking-wider">
                      <ArrowUpDown className="w-3.5 h-3.5 text-sport-orange" />
                      <span>Urutkan:</span>
                    </div>
                    <select
                      value={paymentSort}
                      onChange={(e) => setPaymentSort(e.target.value as 'newest' | 'oldest' | 'amount_desc' | 'amount_asc')}
                      className="px-2.5 py-1.5 bg-brand-gray/40 border border-card-border rounded-lg text-[10px] font-bold text-foreground focus:outline-none focus:border-sport-orange cursor-pointer"
                    >
                      <option value="newest">⚡ Terbaru</option>
                      <option value="oldest">⏳ Terlama</option>
                      <option value="amount_desc">💰 Nominal Tertinggi</option>
                      <option value="amount_asc">💵 Nominal Terendah</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sub-header / Status Info */}
              <div className="bg-brand-dark/30 border-b border-card-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">
                      Total Data Ditemukan
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      {filteredPayments.length} transaksi pembayaran
                    </p>
                  </div>
                  <div className="h-6 w-px bg-card-border hidden sm:block" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">
                      Total Nominal
                    </p>
                    <p className="text-xs font-black text-sport-orange">
                      {formatCurrency(filteredPaymentsTotalNominal)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(paymentStartDate || paymentEndDate) && (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-sport-orange/10 border border-sport-orange/30 text-[9px] font-bold text-sport-orange">
                      Filter Tanggal Aktif
                    </span>
                  )}
                  {paymentStatusFilter !== 'all' && (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-sport-orange/10 border border-sport-orange/30 text-[9px] font-bold text-sport-orange">
                      Filter Status: {paymentStatusFilter.toUpperCase()}
                    </span>
                  )}
                  {(paymentStartDate || paymentEndDate || paymentStatusFilter !== 'all' || query) && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setPaymentStatusFilter('all')
                        handlePaymentDatePresetChange('all')
                        setPaymentSort('newest')
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand-gray/40 border border-card-border hover:border-sport-red hover:text-sport-red text-[10px] font-bold text-brand-muted transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Filter
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-brand-dark/30 border-b border-card-border">
                    <tr>
                      {['Referensi', packageType === 'community' ? 'Komunitas' : packageType === 'individual' ? 'Peserta' : 'Grup', 'Nominal', 'Metode', 'Status', 'Tanggal', 'Aksi'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-brand-muted">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => {
                      const community = getPaymentCommunity(payment)
                      const hasChange = paymentStatusChanges.has(payment.id)
                      const newStatus = paymentStatusChanges.get(payment.id) || payment.status
                      return (
                        <tr key={payment.id} className={`border-b border-card-border hover:bg-brand-gray/20 ${hasChange ? 'bg-yellow-50' : ''}`}>
                          <td className="px-4 py-3 text-xs font-bold text-foreground">{payment.payment_reference}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-foreground">{community?.name || '-'}</p>
                            <p className="text-[10px] text-brand-muted">{community?.community_code || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-foreground">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3 text-xs font-bold text-brand-muted">{payment.payment_method || '-'}</td>
                          <td className="px-4 py-3">
                             <select
                               value={newStatus}
                               onChange={(e) => handlePaymentStatusChange(payment.id, e.target.value as 'pending' | 'paid' | 'failed' | 'expired' | 'testing')}
                               className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all cursor-pointer ${
                                 newStatus === 'paid'
                                   ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                                   : newStatus === 'failed'
                                   ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                                   : newStatus === 'expired'
                                   ? 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                                   : newStatus === 'testing'
                                   ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                   : 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100'
                               }`}
                             >
                               <option value="pending">Pending</option>
                               <option value="paid">Success</option>
                               <option value="failed">Failed</option>
                               <option value="expired">Expired</option>
                               <option value="testing">Testing</option>
                             </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-brand-muted">{formatDateTime(payment.paid_at || payment.created_at)}</td>
                          <td className="px-4 py-3">
                            {hasChange ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSavePaymentStatus(payment.id)}
                                  disabled={isPending}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-sport-orange rounded-lg hover:bg-sport-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => handleCancelPaymentStatusChange(payment.id)}
                                  disabled={isPending}
                                  className="px-3 py-1.5 text-xs font-bold text-brand-muted bg-white border border-card-border rounded-lg hover:bg-brand-gray/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-brand-muted">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredPayments.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-xs font-bold text-brand-muted">
                          <p className="text-foreground">Tidak ada pembayaran yang cocok dengan filter / pencarian.</p>
                          {(paymentStartDate || paymentEndDate || paymentStatusFilter !== 'all' || query) && (
                            <button
                              type="button"
                              onClick={() => {
                                setQuery('')
                                setPaymentStatusFilter('all')
                                handlePaymentDatePresetChange('all')
                                setPaymentSort('newest')
                              }}
                              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sport-orange text-white text-[10px] font-bold uppercase cursor-pointer hover:bg-sport-orange/90 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" /> Reset Semua Filter
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'logs' && currentAdmin.role === 'superadmin' && (
            <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-card-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Axiom</p>
                  <h2 className="text-sm font-black uppercase text-foreground">Log Aplikasi (100 data terbaru)</h2>
                </div>
                <Button type="button" variant="secondary" onClick={handleRefreshLogs} isLoading={isPending}>
                  <RefreshCw className="w-4 h-4 mr-2" />Refresh Log
                </Button>
              </div>

              {logsMessage && (
                <div className="px-4 py-3 border-b border-card-border text-xs font-bold text-brand-muted">
                  {logsMessage}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-brand-dark/30 border-b border-card-border">
                    <tr>
                      {['Waktu', 'Level', 'Sumber', 'Pesan'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-brand-muted">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => (
                      <tr key={`${log.time}-${index}`} className="border-b border-card-border hover:bg-brand-gray/20">
                        <td className="px-4 py-3 text-xs text-brand-muted whitespace-nowrap">{formatDateTime(log.time)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={log.level.toLowerCase().includes('error') ? 'danger' : log.level.toLowerCase().includes('warn') ? 'warning' : 'neutral'}>
                            {log.level}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-foreground">{log.source}</td>
                        <td className="px-4 py-3 text-xs text-brand-muted w-88">{log.message}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-xs font-bold text-brand-muted">
                          Belum ada log yang ditampilkan dari Axiom.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'admins' && currentAdmin.role === 'superadmin' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
              <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-card-border">
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Tambah Admin</p>
                  <h2 className="text-sm font-black uppercase text-foreground">Buat Akun Admin Baru</h2>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-brand-muted">Nama</span>
                    <input
                      value={adminCreateForm.name}
                      onChange={(event) => setAdminCreateForm({ ...adminCreateForm, name: event.target.value })}
                      placeholder="Nama admin"
                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-brand-muted">Role</span>
                    <select
                      value={adminCreateForm.role}
                      onChange={(event) => setAdminCreateForm({ ...adminCreateForm, role: event.target.value as 'admin' | 'superadmin' })}
                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                    >
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-brand-muted">Username</span>
                    <input
                      value={adminCreateForm.username}
                      onChange={(event) => setAdminCreateForm({ ...adminCreateForm, username: event.target.value })}
                      placeholder="contoh: admin_event"
                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-brand-muted">Password</span>
                    <input
                      type="password"
                      value={adminCreateForm.password}
                      onChange={(event) => setAdminCreateForm({ ...adminCreateForm, password: event.target.value })}
                      placeholder="Minimal 6 karakter"
                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                    />
                  </label>
                  {adminCreateForm.role === 'admin' ? (
                    <div className="flex flex-col gap-2 border border-card-border rounded-lg p-3 bg-brand-dark/20">
                      <span className="text-[10px] font-black uppercase text-sport-orange">Hak Akses Menu</span>
                      <p className="text-[9px] text-brand-muted">Pilih menu sidebar yang boleh diakses:</p>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {[
                          { id: 'summary', label: 'Ringkasan' },
                          { id: 'scanner', label: 'Scan Racepack' },
                          { id: 'participants', label: 'Peserta' },
                          { id: 'payments', label: 'Pembayaran' },
                          { id: 'export_participants', label: 'Export Peserta' },
                          { id: 'export_payments', label: 'Export Pembayaran' },
                          { id: 'pacer', label: 'Pacer' },
                          { id: 'packages', label: 'Kelola Paket' },
                          { id: 'periods', label: 'Kelola Periode' },
                          { id: 'logs', label: 'Log Axiom' },
                          { id: 'admins', label: 'Kelola Admin' },
                          { id: 'settings', label: 'Pengaturan' },
                        ].map((tab) => {
                          const isChecked = adminCreateForm.allowed_tabs.includes(tab.id)
                          return (
                            <label key={tab.id} className="inline-flex items-center gap-2 text-[10px] font-bold text-foreground cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  const nextTabs = checked
                                    ? [...adminCreateForm.allowed_tabs, tab.id]
                                    : adminCreateForm.allowed_tabs.filter((t) => t !== tab.id)
                                  setAdminCreateForm({ ...adminCreateForm, allowed_tabs: nextTabs })
                                }}
                                className="rounded border-card-border bg-brand-dark text-sport-orange focus:ring-0 focus:ring-offset-0"
                              />
                              {tab.label}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-card-border/50 rounded-lg p-3 bg-sport-orange/5 text-center">
                      <p className="text-[10px] font-black uppercase text-sport-orange">Akses Penuh</p>
                      <p className="text-[9px] text-brand-muted mt-0.5">Superadmin otomatis memiliki akses ke semua menu sidebar.</p>
                    </div>
                  )}
                  <Button type="button" onClick={handleCreateAdmin} isLoading={isPending}>
                    Tambah Admin
                  </Button>
                </div>
              </section>

              <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-card-border">
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Daftar Admin</p>
                  <h2 className="text-sm font-black uppercase text-foreground">{managedAdmins.length} akun admin terdaftar</h2>
                </div>
                <div className="divide-y divide-card-border">
                  {managedAdmins.map((admin) => (
                    <div key={admin.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-foreground">{admin.name}</p>
                          <p className="text-[10px] font-bold text-brand-muted">@{admin.username}</p>
                          {admin.role === 'admin' ? (
                            <p className="text-[9px] text-brand-muted mt-1 leading-relaxed">
                              Akses: {admin.allowed_tabs && admin.allowed_tabs.length > 0 ? (
                                admin.allowed_tabs.map((tabId: string) => {
                                  const labelMap: Record<string, string> = {
                                    summary: 'Ringkasan',
                                    scanner: 'Scanner',
                                    participants: 'Peserta',
                                    payments: 'Pembayaran',
                                    export_participants: 'Export Peserta',
                                    export_payments: 'Export Pembayaran',
                                    pacer: 'Pacer',
                                    packages: 'Kelola Paket',
                                    periods: 'Kelola Periode',
                                    logs: 'Logs',
                                    admins: 'Kelola Admin',
                                    settings: 'Pengaturan'
                                  }
                                  return labelMap[tabId] || tabId
                                }).join(', ')
                              ) : (
                                <span className="text-sport-red italic font-semibold">Tidak ada akses menu</span>
                              )}
                            </p>
                          ) : (
                            <p className="text-[9px] text-sport-orange font-bold mt-1">Akses: Semua Menu (Superadmin)</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">{admin.role}</Badge>
                          <Badge variant={admin.is_active ? 'success' : 'warning'}>
                            {admin.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setAdminEditForm({
                              id: admin.id,
                              name: admin.name,
                              username: admin.username,
                              password: '',
                              is_active: admin.is_active,
                              role: admin.role,
                              allowed_tabs: admin.allowed_tabs || [],
                            })
                          }
                        >
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteAdmin(admin.id, admin.name)}>
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                  {managedAdmins.length === 0 && (
                    <div className="p-6 text-center text-xs font-bold text-brand-muted">
                      Belum ada admin tambahan. Tambahkan akun admin baru dari form sebelah kiri.
                    </div>
                  )}
                </div>
                {adminMessage && <p className="px-4 py-3 text-xs font-bold text-green-300 border-t border-card-border">{adminMessage}</p>}
              </section>
            </div>
          )}

          {activeTab === 'pacer' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Pacer</p>
                  <h2 className="text-sm font-black uppercase text-foreground">Pendaftar Pacer ({pacerRows.length})</h2>
                  <p className="text-[11px] text-brand-muted mt-1">Tanpa pembayaran — review &amp; setujui/tolak pendaftar di bawah ini.</p>
                </div>
                <Button onClick={exportPacerRows} disabled={pacerRows.length === 0} className="shrink-0">
                  <Download className="w-4 h-4 mr-2" />Export ke Excel
                </Button>
              </div>

              <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden shadow-lg">
                {pacerRows.length === 0 ? (
                  <div className="p-8 text-center text-xs font-bold text-brand-muted">Belum ada pendaftar pacer.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-card-border bg-brand-dark/20">
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted">Nama / BIB</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted">Kontak</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted">Kategori</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted text-center">Usia</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted text-center">Foto</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted text-center">PB</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted text-center">Status</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pacerRows.map((row) => (
                          <tr key={row.id} className="border-b border-card-border hover:bg-brand-gray/20 transition-colors">
                            <td className="px-4 py-3.5">
                              <p className="text-sm font-bold text-foreground">{row.full_name}</p>
                              <p className="text-[10px] font-bold text-sport-orange uppercase">BIB: {row.bib_name}</p>
                              <p className="text-[10px] text-brand-muted">{row.pacer_code}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-xs text-foreground">{row.phone}</p>
                              <p className="text-[10px] text-brand-muted">{row.email}</p>
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-foreground">{row.category}</td>
                            <td className="px-4 py-3.5 text-center text-xs text-foreground">{row.age ?? '-'}</td>
                            <td className="px-4 py-3.5 text-center text-xs font-bold text-foreground">{row.media_urls.length}</td>
                            <td className="px-4 py-3.5 text-center text-xs font-bold text-foreground">{row.pb_media_urls.length}</td>
                            <td className="px-4 py-3.5 text-center">
                              <Badge variant={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'}>
                                {row.status.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => setPacerDetail(row)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 bg-brand-gray border border-card-border text-brand-muted hover:text-foreground rounded text-[9px] font-black uppercase cursor-pointer"
                                >
                                  Detail
                                </button>
                                <button
                                  onClick={() => openPacerEdit(row)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 bg-brand-gray border border-card-border text-brand-muted hover:text-foreground rounded text-[9px] font-black uppercase cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                {row.status !== 'approved' && (
                                  <button
                                    onClick={() => handlePacerApprove(row)}
                                    disabled={isPending || processingPacerId !== null}
                                    className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/25 text-green-400 rounded text-[9px] font-black uppercase cursor-pointer disabled:opacity-50 min-w-[28px] min-h-[28px]"
                                    title="Setujui Pacer"
                                  >
                                    {processingPacerId === row.pacer_id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ThumbsUp className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                                {row.status !== 'rejected' && (
                                  <button
                                    onClick={() => handlePacerReject(row)}
                                    disabled={isPending || processingPacerId !== null}
                                    className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-sport-red/10 hover:bg-sport-red/20 border border-sport-red/25 text-sport-red rounded text-[9px] font-black uppercase cursor-pointer disabled:opacity-50 min-w-[28px] min-h-[28px]"
                                    title="Tolak Pacer"
                                  >
                                    {processingPacerId === row.pacer_id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ThumbsDown className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'packages' && currentAdmin.role === 'superadmin' && (
            <div className="flex flex-col gap-4">

              {/* ── Package picker ── */}
              {!selectedPackagesPackage && (
                <>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Kelola Paket</p>
                    <h2 className="text-sm font-black uppercase text-foreground">Pilih Paket yang Ingin Dikonfigurasi</h2>
                    <p className="text-[11px] text-brand-muted mt-1">Atur buka/tutup paket, size chart jersey, isi form pendaftaran, template email, dan webhook per paket. Jadwal &amp; harga ada di tab Kelola Periode.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                      { key: 'community'  as PackageKey, icon: '🏃', accent: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/30', badge: 'bg-orange-500/20 text-orange-400' },
                      { key: 'family'     as PackageKey, icon: '👨‍👩‍👧', accent: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-400' },
                      { key: 'individual' as PackageKey, icon: '⚡', accent: 'from-blue-500/20 to-blue-500/5',   border: 'border-blue-500/30',   badge: 'bg-blue-500/20 text-blue-400'   },
                      { key: 'pacer'      as PackageKey, icon: '🎽', accent: 'from-green-500/20 to-green-500/5', border: 'border-green-500/30', badge: 'bg-green-500/20 text-green-400'  },
                    ]).map(({ key, icon, accent, border, badge }) => {
                      const config = settingsForm.packages[key]
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedPackagesPackage(key)}
                          className={`group relative flex flex-col gap-4 p-6 rounded-xl border ${border} bg-gradient-to-br ${accent} hover:scale-[1.015] hover:shadow-lg hover:shadow-black/30 transition-all duration-200 text-left cursor-pointer`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="text-3xl">{icon}</div>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${badge}`}>
                              {config.enabled ? 'Buka' : 'Tutup'}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-base font-black uppercase text-foreground tracking-wide">{config.label}</h3>
                            <p className="text-[11px] text-brand-muted mt-1">
                              {config.sizeChartImage ? 'Size chart tersedia' : 'Belum ada size chart'} · klik untuk mengatur
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-muted group-hover:text-foreground transition-colors">
                            <span>Buka Pengaturan</span>
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ── Full-page per-package settings ── */}
              {selectedPackagesPackage && (() => {
                const pkg    = selectedPackagesPackage
                const config = settingsForm.packages[pkg]
                return (
                  <>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPackagesPackage(null)}
                          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-brand-muted hover:text-foreground transition-colors"
                        >
                          <span>←</span> Semua Paket
                        </button>
                        <span className="text-brand-muted/40 text-xs">/</span>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Kelola Paket</p>
                          <h2 className="text-sm font-black uppercase text-foreground">{config.label}</h2>
                        </div>
                      </div>
                      <Button onClick={savePackages} isLoading={isPending} className="shrink-0">
                        <CheckCircle className="w-4 h-4 mr-2" />Simpan Paket
                      </Button>
                    </div>

                    {settingsMessage && (
                      <p className="text-[11px] font-bold text-green-400">{settingsMessage}</p>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* Left column — identity + size chart */}
                      <div className="flex flex-col gap-5">

                        {/* Identity */}
                        <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
                          <div className="px-5 py-3.5 border-b border-card-border bg-brand-gray/20">
                            <p className="text-[9px] font-black uppercase text-sport-orange tracking-widest">Identitas Paket</p>
                          </div>
                          <div className="p-5 flex flex-col gap-4">
                            <label className="flex flex-col gap-1.5">
                              <span className="text-[9px] font-black uppercase text-brand-muted">Nama Paket</span>
                              <input
                                value={config.label}
                                onChange={(e) => updatePackageField(pkg, { label: e.target.value })}
                                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-sm font-bold text-foreground"
                              />
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={config.enabled}
                                  onChange={(e) => updatePackageField(pkg, { enabled: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-10 h-5 bg-brand-dark/60 border border-card-border rounded-full peer-checked:bg-sport-orange/80 transition-colors" />
                                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                              </div>
                              <span className="text-xs font-bold text-foreground">
                                Paket {config.enabled ? <span className="text-green-400">Dibuka</span> : <span className="text-red-400">Ditutup</span>}
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Size Chart */}
                        <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
                          <div className="px-5 py-3.5 border-b border-card-border bg-brand-gray/20">
                            <p className="text-[9px] font-black uppercase text-sport-orange tracking-widest">Gambar Size Chart Jersey</p>
                          </div>
                          <div className="p-5 flex flex-col gap-4">
                            {config.sizeChartImage && (
                              <Image
                                src={config.sizeChartImage}
                                alt={`Size chart ${config.label}`}
                                width={400}
                                height={400}
                                unoptimized
                                className="w-full max-w-xs h-auto rounded-lg border border-card-border object-contain bg-white"
                              />
                            )}
                            <div className="flex items-center gap-3">
                              <input
                                type="file"
                                accept="image/*"
                                disabled={uploadingAsset === `sizeChart-${pkg}`}
                                onChange={(e) => handleSizeChartUpload(pkg, e.target.files?.[0])}
                                className="flex-1 text-[10px] text-brand-muted file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-brand-dark/60 file:text-foreground file:text-[10px] file:font-bold disabled:opacity-50"
                              />
                              {uploadingAsset === `sizeChart-${pkg}` && (
                                <span className="text-[10px] text-brand-muted shrink-0">Mengupload...</span>
                              )}
                              {config.sizeChartImage && (
                                <button
                                  type="button"
                                  onClick={() => updatePackageField(pkg, { sizeChartImage: '' })}
                                  className="text-red-400 hover:text-red-500 shrink-0"
                                  title="Hapus gambar (pakai default)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <p className="text-[9px] text-brand-muted">Kosongkan untuk pakai gambar default. Maks 2MB. Opsi ukuran (dropdown) diatur di &quot;Edit Form Pendaftaran&quot;.</p>
                          </div>
                        </div>
                      </div>

                      {/* Right column — quick-action modals */}
                      <div className="flex flex-col gap-5">
                        <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
                          <div className="px-5 py-3.5 border-b border-card-border bg-brand-gray/20">
                            <p className="text-[9px] font-black uppercase text-sport-orange tracking-widest">Konfigurasi Lanjutan</p>
                          </div>
                          <div className="p-5 flex flex-col gap-3">
                            <button
                              type="button"
                              onClick={() => setFormEditingPkg(pkg)}
                              className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-card-border bg-brand-gray/20 hover:border-sport-orange/50 hover:bg-brand-gray/40 transition-colors group"
                            >
                              <div className="text-left">
                                <p className="text-xs font-black uppercase text-foreground">Edit Form Pendaftaran</p>
                                <p className="text-[10px] text-brand-muted mt-0.5">Atur field, ukuran jersey, validasi &amp; pilihan kategori</p>
                              </div>
                              <Pencil className="w-4 h-4 text-sport-orange shrink-0 group-hover:scale-110 transition-transform" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEmailEditingPkg(pkg)}
                              className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-card-border bg-brand-gray/20 hover:border-sport-orange/50 hover:bg-brand-gray/40 transition-colors group"
                            >
                              <div className="text-left">
                                <p className="text-xs font-black uppercase text-foreground">Edit Template Email</p>
                                <p className="text-[10px] text-brand-muted mt-0.5">Kustomisasi isi email konfirmasi &amp; tagihan</p>
                              </div>
                              <Pencil className="w-4 h-4 text-sport-orange shrink-0 group-hover:scale-110 transition-transform" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setWebhookEditingPkg(pkg)}
                              className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-card-border bg-brand-gray/20 hover:border-sport-orange/50 hover:bg-brand-gray/40 transition-colors group"
                            >
                              <div className="text-left">
                                <p className="text-xs font-black uppercase text-foreground">Edit Webhook</p>
                                <p className="text-[10px] text-brand-muted mt-0.5">Atur URL &amp; event notifikasi ke sistem eksternal</p>
                              </div>
                              <Pencil className="w-4 h-4 text-sport-orange shrink-0 group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}

            </div>
          )}

          {activeTab === 'periods' && currentAdmin.role === 'superadmin' && (
            <div className="flex flex-col gap-4">

              {/* ── Package picker ── */}
              {!selectedPeriodPackage && (
                <>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Kelola Periode</p>
                    <h2 className="text-sm font-black uppercase text-foreground">Pilih Paket yang Ingin Dikonfigurasi</h2>
                    <p className="text-[11px] text-brand-muted mt-1">Tiap paket punya jadwal, kategori, harga, dan kuota tersendiri. Pilih salah satu paket untuk mulai mengatur periodenya.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                      { key: 'community' as PackageKey, icon: '🏃', accent: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/30', badge: 'bg-orange-500/20 text-orange-400' },
                      { key: 'family'    as PackageKey, icon: '👨‍👩‍👧', accent: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-400' },
                      { key: 'individual'as PackageKey, icon: '⚡', accent: 'from-blue-500/20 to-blue-500/5',   border: 'border-blue-500/30',   badge: 'bg-blue-500/20 text-blue-400'   },
                      { key: 'pacer'     as PackageKey, icon: '🎽', accent: 'from-green-500/20 to-green-500/5', border: 'border-green-500/30', badge: 'bg-green-500/20 text-green-400'  },
                    ]).map(({ key, icon, accent, border, badge }) => {
                      const config = settingsForm.packages[key]
                      const periodCount = config.periods.length
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedPeriodPackage(key)}
                          className={`group relative flex flex-col gap-4 p-6 rounded-xl border ${border} bg-gradient-to-br ${accent} hover:scale-[1.015] hover:shadow-lg hover:shadow-black/30 transition-all duration-200 text-left cursor-pointer`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="text-3xl">{icon}</div>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${badge}`}>
                              {periodCount} Periode
                            </span>
                          </div>
                          <div>
                            <h3 className="text-base font-black uppercase text-foreground tracking-wide">{config.label}</h3>
                            <p className="text-[11px] text-brand-muted mt-1">
                              {periodCount === 0
                                ? 'Belum ada periode — klik untuk menambahkan'
                                : `${periodCount} periode aktif — klik untuk mengatur jadwal & harga`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-muted group-hover:text-foreground transition-colors">
                            <span>Buka Pengaturan</span>
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ── Full-page per-package settings ── */}
              {selectedPeriodPackage && (() => {
                const pkg    = selectedPeriodPackage
                const config = settingsForm.packages[pkg]
                return (
                  <>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPeriodPackage(null)}
                          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-brand-muted hover:text-foreground transition-colors"
                        >
                          <span>←</span> Semua Paket
                        </button>
                        <span className="text-brand-muted/40 text-xs">/</span>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Kelola Periode</p>
                          <h2 className="text-sm font-black uppercase text-foreground">{config.label}</h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => addPackagePeriod(pkg)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-sport-purple/40 bg-sport-purple/10 text-[10px] font-black uppercase text-sport-purple hover:bg-sport-purple/20 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Periode
                        </button>
                        <Button onClick={savePackages} isLoading={isPending} className="shrink-0">
                          <CheckCircle className="w-4 h-4 mr-2" />Simpan Periode
                        </Button>
                      </div>
                    </div>

                    {settingsMessage && (
                      <p className="text-[11px] font-bold text-green-400">{settingsMessage}</p>
                    )}

                    {/* Period list – 2-column grid on wider screens */}
                    {config.periods.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-card-border rounded-xl">
                        <Calendar className="w-10 h-10 text-brand-muted/40" />
                        <p className="text-sm font-bold text-brand-muted">Belum ada periode untuk paket ini.</p>
                        <button
                          type="button"
                          onClick={() => addPackagePeriod(pkg)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sport-orange/20 border border-sport-orange/30 text-[10px] font-black uppercase text-sport-orange hover:bg-sport-orange/30 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Periode Pertama
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {config.periods.map((period, periodIndex) => (
                          <div key={period.key} className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
                            {/* Period header */}
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-card-border bg-brand-gray/20">
                              <input
                                value={period.label}
                                onChange={(e) => updatePackagePeriod(pkg, periodIndex, { label: e.target.value })}
                                className="bg-transparent text-xs font-black uppercase text-sport-orange outline-none min-w-0 flex-1"
                              />
                              {config.periods.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removePackagePeriod(pkg, periodIndex)}
                                  className="ml-3 text-red-400 hover:text-red-500 shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <div className="p-5 flex flex-col gap-5">
                              {/* Dates */}
                              <div>
                                <p className="text-[9px] font-black uppercase text-brand-muted tracking-widest mb-2.5">Jadwal</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <label className="flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black uppercase text-brand-muted">Buka Pendaftaran</span>
                                    <input
                                      type="datetime-local"
                                      value={period.registrationStart}
                                      onChange={(e) => updatePackagePeriod(pkg, periodIndex, { registrationStart: e.target.value })}
                                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black uppercase text-brand-muted">Tutup Pendaftaran</span>
                                    <input
                                      type="datetime-local"
                                      value={period.registrationEnd}
                                      onChange={(e) => updatePackagePeriod(pkg, periodIndex, { registrationEnd: e.target.value })}
                                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black uppercase text-brand-muted">Buka Pembayaran</span>
                                    <input
                                      type="datetime-local"
                                      value={period.paymentStart}
                                      onChange={(e) => updatePackagePeriod(pkg, periodIndex, { paymentStart: e.target.value })}
                                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black uppercase text-brand-muted">Tutup Pembayaran</span>
                                    <input
                                      type="datetime-local"
                                      value={period.paymentEnd}
                                      onChange={(e) => updatePackagePeriod(pkg, periodIndex, { paymentEnd: e.target.value })}
                                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                                    <span className="text-[9px] font-black uppercase text-brand-muted">Tanggal &amp; Jam Pelaksanaan</span>
                                    <input
                                      type="datetime-local"
                                      value={period.eventDate}
                                      onChange={(e) => updatePackagePeriod(pkg, periodIndex, { eventDate: e.target.value })}
                                      className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                    />
                                  </label>
                                </div>
                              </div>

                              {/* Categories */}
                              <div>
                                <div className="flex items-center justify-between mb-2.5">
                                  <p className="text-[9px] font-black uppercase text-brand-muted tracking-widest">Kategori &amp; Harga</p>
                                  <button
                                    type="button"
                                    onClick={() => addPackageCategory(pkg, periodIndex)}
                                    className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-sport-purple hover:text-sport-purple/80"
                                  >
                                    <Plus className="w-3 h-3" /> Tambah
                                  </button>
                                </div>

                                {period.categories.length === 0 && (
                                  <p className="text-[10px] text-brand-muted">Belum ada kategori.</p>
                                )}

                                <div className="flex flex-col gap-3">
                                  {period.categories.map((cat, catIndex) => (
                                    <div key={catIndex} className="border border-card-border rounded-lg p-3 bg-brand-gray/20 flex flex-col gap-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase text-sport-orange">Kategori #{catIndex + 1}</span>
                                        <button
                                          type="button"
                                          onClick={() => removePackageCategory(pkg, periodIndex, catIndex)}
                                          className="text-red-400 hover:text-red-500"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <input
                                        value={cat.label}
                                        onChange={(e) => updatePackageCategory(pkg, periodIndex, catIndex, { label: e.target.value })}
                                        placeholder="Label tampil (mis. 6K — Rp 149.000)"
                                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                      />
                                      <input
                                        value={cat.value}
                                        onChange={(e) => updatePackageCategory(pkg, periodIndex, catIndex, { value: e.target.value })}
                                        placeholder="Nilai kategori (disimpan)"
                                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                      />
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-brand-muted shrink-0">Rp</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={cat.price}
                                          onChange={(e) => updatePackageCategory(pkg, periodIndex, catIndex, { price: Number(e.target.value) })}
                                          placeholder="Harga"
                                          className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                        />
                                      </div>
                                      <label className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-black uppercase text-brand-muted">Kuota Kategori (0 = tak terbatas)</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={cat.quota}
                                          onChange={(e) => updatePackageCategory(pkg, periodIndex, catIndex, { quota: Number(e.target.value) })}
                                          className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                                        />
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-brand-muted leading-relaxed">
                      Catatan: <strong>Nilai kategori</strong> untuk Community &amp; Bro &amp; Sist harus tetap
                      <code className="mx-1 text-sport-orange">6K 1̶4̶9̶.̶0̶0̶0̶ 135.000</code>
                      agar cocok dengan validasi form lama. Kategori Individu bebas diubah. Ubah <strong>harga</strong> kapan saja — langsung dipakai saat checkout.
                    </p>
                  </>
                )
              })()}

            </div>
          )}

          {activeTab === 'vouchers' && currentAdmin.role === 'superadmin' && (
            <VouchersTab
              adminSettings={adminSettings}
              voucherList={voucherList}
              setVoucherList={setVoucherList}
              voucherLoading={voucherLoading}
              setVoucherLoading={setVoucherLoading}
              voucherError={voucherError}
              setVoucherError={setVoucherError}
              voucherSuccess={voucherSuccess}
              setVoucherSuccess={setVoucherSuccess}
              voucherDialogOpen={voucherDialogOpen}
              setVoucherDialogOpen={setVoucherDialogOpen}
              voucherEditTarget={voucherEditTarget}
              setVoucherEditTarget={setVoucherEditTarget}
              voucherForm={voucherForm}
              setVoucherForm={setVoucherForm}
            />
          )}

          {activeTab === 'settings' && currentAdmin.role === 'superadmin' && (
            <div className="grid grid-cols-1 max-w-2xl gap-4">
              <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-card-border">
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Environment</p>
                  <h2 className="text-sm font-black uppercase text-foreground">Edit Key Integrasi</h2>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
                    <p className="text-xs font-bold text-amber-200">
                      Key Supabase/database tidak ditampilkan. Field sensitif sengaja dikosongkan; isi hanya jika ingin mengganti nilainya.
                    </p>
                  </div>
                  <div className="border border-card-border rounded-lg p-3 bg-brand-gray/20 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Field Env Tambahan</p>
                        <p className="text-[10px] text-brand-muted">Tambahkan key integrasi lain agar bisa terlihat di panel ini.</p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={addEnvField}>
                        <Plus className="w-4 h-4 mr-2" />Tambah Env
                      </Button>
                    </div>
                    {settingsForm.envFields.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {settingsForm.envFields.map((field, index) => (
                          <div key={`${field.key}-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                            <input
                              value={field.key}
                              onChange={(event) => updateEnvField(index, { key: event.target.value })}
                              placeholder="NAMA_ENV"
                              className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                            />
                            <input
                              value={field.label}
                              onChange={(event) => updateEnvField(index, { label: event.target.value })}
                              placeholder="Label"
                              className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                            />
                            <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted">
                              <input
                                type="checkbox"
                                checked={field.sensitive}
                                onChange={(event) => updateEnvField(index, { sensitive: event.target.checked })}
                              />
                              Sensitif
                            </label>
                            <button
                              type="button"
                              onClick={() => removeEnvField(index)}
                              className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-red-500/30 text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {envSnapshots.map((field) => (
                    <label key={field.key} className="flex flex-col gap-1.5 border border-card-border rounded-lg p-3 bg-brand-gray/20">
                      <span className="text-[10px] font-black uppercase text-brand-muted">{field.label}</span>
                      <span className="text-[10px] text-brand-muted">{field.key} • {field.hasValue ? 'Sudah terisi' : 'Belum terisi'}</span>
                      <input
                        type={field.sensitive ? 'password' : 'text'}
                        value={envForm[field.key] ?? field.currentValue}
                        onChange={(event) => setEnvForm({ ...envForm, [field.key]: event.target.value })}
                        placeholder={field.sensitive ? 'Kosongkan jika tidak diganti' : field.description}
                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                      />
                    </label>
                  ))}
                  <Button type="button" onClick={saveEnv} isLoading={isPending}>
                    Simpan Env
                  </Button>
                  {settingsMessage && <p className="text-xs font-bold text-green-300">{settingsMessage}</p>}
                </div>
              </section>

              <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-card-border">
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Logo &amp; Media Event</p>
                  <h2 className="text-sm font-black uppercase text-foreground">Hero &amp; Logo Header/Footer</h2>
                  <p className="text-[11px] text-brand-muted mt-1">Gambar diupload ke Cloudinary. Kosongkan untuk pakai gambar default bawaan. Butuh CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET terisi di Environment.</p>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black uppercase text-brand-muted">Gambar Hero (Landing Page)</span>
                    {settingsForm.siteAssets.heroImage && (
                      <Image
                        src={settingsForm.siteAssets.heroImage}
                        alt="Hero"
                        width={280}
                        height={140}
                        unoptimized
                        className="w-full max-w-[280px] h-auto rounded-lg border border-card-border object-contain bg-white"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingAsset === 'heroImage'}
                        onChange={(e) => handleSiteAssetUpload('heroImage', e.target.files?.[0])}
                        className="flex-1 text-[10px] text-brand-muted file:mr-2 file:px-2 file:py-1 file:rounded-lg file:border-0 file:bg-brand-dark/40 file:text-foreground file:text-[10px] file:font-bold disabled:opacity-50"
                      />
                      {uploadingAsset === 'heroImage' && <span className="text-[10px] text-brand-muted shrink-0">Mengupload...</span>}
                      {settingsForm.siteAssets.heroImage && (
                        <button
                          type="button"
                          onClick={() => updateSiteAssets({ heroImage: '' })}
                          className="text-red-400 hover:text-red-500 shrink-0"
                          title="Hapus gambar (pakai default)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black uppercase text-brand-muted">Logo (Header &amp; Footer)</span>
                    {settingsForm.siteAssets.logoImage && (
                      <Image
                        src={settingsForm.siteAssets.logoImage}
                        alt="Logo"
                        width={200}
                        height={60}
                        unoptimized
                        className="w-full max-w-[200px] h-auto rounded-lg border border-card-border object-contain bg-white"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingAsset === 'logoImage'}
                        onChange={(e) => handleSiteAssetUpload('logoImage', e.target.files?.[0])}
                        className="flex-1 text-[10px] text-brand-muted file:mr-2 file:px-2 file:py-1 file:rounded-lg file:border-0 file:bg-brand-dark/40 file:text-foreground file:text-[10px] file:font-bold disabled:opacity-50"
                      />
                      {uploadingAsset === 'logoImage' && <span className="text-[10px] text-brand-muted shrink-0">Mengupload...</span>}
                      {settingsForm.siteAssets.logoImage && (
                        <button
                          type="button"
                          onClick={() => updateSiteAssets({ logoImage: '' })}
                          className="text-red-400 hover:text-red-500 shrink-0"
                          title="Hapus gambar (pakai default)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <Button type="button" onClick={savePackages} isLoading={isPending}>
                    Simpan Logo &amp; Media
                  </Button>
                  {settingsMessage && <p className="text-xs font-bold text-green-300">{settingsMessage}</p>}
                </div>
              </section>
            </div>
          )}

          {(activeTab === 'export_participants' || activeTab === 'export_payments') && (
            <div className="bg-card-bg border border-card-border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex border-b border-card-border mb-2">
                <button
                  onClick={() => setPackageType('community')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'community'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Community Package
                </button>
                <button
                  onClick={() => setPackageType('family')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'family'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Bro & Sist Package
                </button>
                <button
                  onClick={() => setPackageType('individual')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    packageType === 'individual'
                      ? 'border-sport-orange text-sport-orange bg-sport-orange/5'
                      : 'border-transparent text-brand-muted hover:text-foreground'
                  }`}
                >
                  Individu
                </button>
              </div>
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">
                    {activeTab === 'export_participants' ? 'Export Peserta' : 'Export Pembayaran'}
                  </p>
                  <p className="text-xs font-bold text-brand-muted">
                    Pilih {groupWord}, lalu sistem membuat {combineFiles ? '1 file Excel gabungan' : `1 file Excel untuk tiap ${groupWord}`}.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={combineFiles}
                      onChange={(event) => setCombineFiles(event.target.checked)}
                    />
                    Gabung menjadi 1 file Excel
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={communitiesForExport.length > 0 && resolvedSelection.size === communitiesForExport.length}
                      onChange={(event) => setAllExportCommunities(event.target.checked)}
                    />
                    Pilih semua {groupWord}
                  </label>
                </div>
              {(activeTab === 'export_participants' || activeTab === 'export_payments') && (
                <div className="flex items-center gap-1.5 bg-brand-gray/30 border border-card-border rounded-lg px-3 py-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-brand-muted mr-2">Filter Status:</span>
                  {(['all', 'paid', 'unpaid'] as const).map((opt) => (
                    <label key={opt} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="exportPaymentFilter"
                        value={opt}
                        checked={exportPaymentFilter === opt}
                        onChange={() => { setExportPaymentFilter(opt); setSelectedExportCommunities(null) }}
                        className="accent-sport-orange"
                      />
                      <span className={`text-[10px] font-black uppercase tracking-wide ${
                        exportPaymentFilter === opt ? 'text-sport-orange' : 'text-brand-muted'
                      }`}>
                        {opt === 'all' ? 'Semua' : opt === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                {communitiesForExport.length === 0 && (
                  <p className="col-span-full text-xs text-brand-muted py-2">
                    {exportPaymentFilter === 'paid'
                      ? (activeTab === 'export_payments' ? 'Tidak ada grup dengan pembayaran lunas.' : 'Tidak ada grup dengan peserta lunas.')
                      : exportPaymentFilter === 'unpaid'
                        ? (activeTab === 'export_payments' ? 'Tidak ada grup dengan pembayaran belum lunas.' : 'Tidak ada grup dengan peserta belum lunas.')
                        : 'Tidak ada grup ditemukan.'}
                  </p>
                )}
                {communitiesForExport.map((community) => (
                  <label key={community.id} className="flex items-start gap-2 rounded-lg border border-card-border bg-brand-gray/20 p-2 text-xs">
                    <input
                      type="checkbox"
                      checked={resolvedSelection.has(community.id)}
                      onChange={() => toggleExportCommunity(community.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-black text-foreground">{community.name}</span>
                      <span className="block text-[10px] text-brand-muted">{community.community_code}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => router.refresh()}>
                  <RefreshCw className="w-4 h-4 mr-2" />Refresh Data
                </Button>
                {activeTab === 'export_participants' ? (
                  <Button type="button" variant="secondary" onClick={() => exportWorkbook('participants', 'selected')}>
                    <Download className="w-4 h-4 mr-2" />Export Peserta
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => exportWorkbook('payments', 'selected')}>
                    <Download className="w-4 h-4 mr-2" />Export Pembayaran
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog
        isOpen={!!formEditingPkg}
        onClose={() => setFormEditingPkg(null)}
        title={formEditingPkg ? `Edit Form Pendaftaran — ${settingsForm.packages[formEditingPkg].label}` : 'Edit Form Pendaftaran'}
        className="max-w-3xl"
      >
        {formEditingPkg && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-3">Field Pendaftar</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {communitySettingFields.map(([key, title]) => {
                  const field = settingsForm.registrationForm[formEditingPkg].registrant[key]
                  return (
                    <div key={key} className="border border-card-border rounded-lg p-3 bg-brand-gray/20">
                      <p className="text-[10px] font-black uppercase text-sport-orange mb-2">{title}</p>
                      <input
                        value={field.label}
                        onChange={(event) => updateRegistrantField(formEditingPkg, key, { label: event.target.value })}
                        placeholder="Label field"
                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-2"
                      />
                      <input
                        value={field.placeholder}
                        onChange={(event) => updateRegistrantField(formEditingPkg, key, { placeholder: event.target.value })}
                        placeholder="Placeholder"
                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-2"
                      />
                      <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted">
                          <input
                            type="checkbox"
                            checked={field.visible}
                            onChange={(event) => updateRegistrantField(formEditingPkg, key, { visible: event.target.checked })}
                          />
                          Tampilkan field
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-sport-orange">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(event) => updateRegistrantField(formEditingPkg, key, { required: event.target.checked })}
                          />
                          Wajib diisi
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-3">Field Peserta</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[...participantInputSettingFields, ...(formEditingPkg === 'pacer' ? pacerOnlyInputFields : [])].map(([key, title]) => {
                  const field = settingsForm.registrationForm[formEditingPkg].participants[key] as FormInputConfig
                  return (
                    <div key={key} className="border border-card-border rounded-lg p-3 bg-brand-gray/20">
                      <p className="text-[10px] font-black uppercase text-sport-orange mb-2">{title}</p>
                      <input
                        value={field.label}
                        onChange={(event) => updateParticipantField(formEditingPkg, key, { label: event.target.value })}
                        placeholder="Label field"
                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-2"
                      />
                      <input
                        value={field.placeholder}
                        onChange={(event) => updateParticipantField(formEditingPkg, key, { placeholder: event.target.value })}
                        placeholder="Placeholder"
                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-2"
                      />
                      <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted">
                          <input
                            type="checkbox"
                            checked={field.visible}
                            onChange={(event) => updateParticipantField(formEditingPkg, key, { visible: event.target.checked })}
                          />
                          Tampilkan field
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-sport-orange">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(event) => updateParticipantField(formEditingPkg, key, { required: event.target.checked })}
                          />
                          Wajib diisi
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-3">Dropdown Peserta (termasuk opsi ukuran jersey)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[...participantSelectSettingFields, ...(formEditingPkg === 'pacer' ? pacerOnlySelectFields : [])].map(([key, title]) => {
                  const field = settingsForm.registrationForm[formEditingPkg].participants[key] as FormSelectConfig
                  return (
                    <div key={key} className="border border-card-border rounded-lg p-3 bg-brand-gray/20">
                      <p className="text-[10px] font-black uppercase text-sport-orange mb-2">{title}</p>
                      <input
                        value={field.label}
                        onChange={(event) => updateParticipantField(formEditingPkg, key, { label: event.target.value })}
                        placeholder="Label dropdown"
                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-2"
                      />
                      <input
                        value={field.placeholder}
                        onChange={(event) => updateParticipantField(formEditingPkg, key, { placeholder: event.target.value })}
                        placeholder="Placeholder dropdown"
                        className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-3"
                      />
                      <div className="flex items-center gap-4 mb-3">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted">
                          <input
                            type="checkbox"
                            checked={field.visible}
                            onChange={(event) => updateParticipantField(formEditingPkg, key, { visible: event.target.checked })}
                          />
                          Tampilkan field
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-sport-orange">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(event) => updateParticipantField(formEditingPkg, key, { required: event.target.checked })}
                          />
                          Wajib diisi
                        </label>
                      </div>
                      <div className="flex flex-col gap-2">
                        {field.options.map((option) => (
                          <label key={option.value} className="grid grid-cols-[3.5rem_1fr] gap-2 items-center">
                            <span className="text-[10px] font-black text-brand-muted">{option.value}</span>
                            <input
                              value={option.label}
                              onChange={(event) => updateSelectOptionLabel(formEditingPkg as PackageKey, key, option.value, event.target.value)}
                              className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={savePackages} isLoading={isPending}>
                Simpan
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFormEditingPkg(null)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={!!emailEditingPkg}
        onClose={() => setEmailEditingPkg(null)}
        title={emailEditingPkg ? `Edit Template Email — ${settingsForm.packages[emailEditingPkg].label}` : 'Edit Template Email'}
        className="max-w-2xl"
      >
        {emailEditingPkg && (
          <div className="flex flex-col gap-3">
            <div className="bg-brand-dark/40 border border-card-border rounded-lg p-3">
              <p className="text-[10px] font-black uppercase text-brand-muted mb-2">Variabel yang tersedia:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-brand-muted">
                <div><code className="text-sport-orange">{'{communityName}'}</code> / <code className="text-sport-orange">{'{familyName}'}</code> / <code className="text-sport-orange">{'{individualName}'}</code></div>
                <div><code className="text-sport-orange">{'{leaderName}'}</code> - Nama ketua/perwakilan</div>
                <div><code className="text-sport-orange">{'{participantCount}'}</code> - Jumlah peserta</div>
                <div><code className="text-sport-orange">{'{individualCode}'}</code> - Kode peserta (khusus Individu)</div>
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Subject</span>
              <input
                type="text"
                value={settingsForm.emailTemplates[emailEditingPkg].subject}
                onChange={(e) => updateEmailTemplate(emailEditingPkg, 'subject', e.target.value)}
                placeholder="Subject email"
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Greeting (Salam Pembuka)</span>
              <input
                type="text"
                value={settingsForm.emailTemplates[emailEditingPkg].greeting}
                onChange={(e) => updateEmailTemplate(emailEditingPkg, 'greeting', e.target.value)}
                placeholder="Contoh: Halo {leaderName},"
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Body Intro (Kalimat Pembuka)</span>
              <textarea
                value={settingsForm.emailTemplates[emailEditingPkg].bodyIntro}
                onChange={(e) => updateEmailTemplate(emailEditingPkg, 'bodyIntro', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground resize-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Body Outro (Kalimat Penutup)</span>
              <textarea
                value={settingsForm.emailTemplates[emailEditingPkg].bodyOutro}
                onChange={(e) => updateEmailTemplate(emailEditingPkg, 'bodyOutro', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground resize-none"
              />
            </label>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={savePackages} isLoading={isPending}>
                Simpan
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEmailEditingPkg(null)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={!!webhookEditingPkg}
        onClose={() => setWebhookEditingPkg(null)}
        title={webhookEditingPkg ? `Edit Webhook — ${settingsForm.packages[webhookEditingPkg].label}` : 'Edit Webhook'}
        className="max-w-xl"
      >
        {webhookEditingPkg && (
          <div className="flex flex-col gap-4">
            <p className="text-[10px] text-brand-muted leading-relaxed">
              Kosongkan untuk pakai webhook global (env <code className="text-sport-orange">GHL_REGISTRATION_WEBHOOK_URL</code> / <code className="text-sport-orange">GHL_QR_WEBHOOK_URL</code>).
            </p>
            <div className="border border-card-border rounded-lg p-3 bg-brand-gray/20 flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase text-sport-orange">Webhook Pendaftaran</p>
              <input
                value={settingsForm.webhookSettings[webhookEditingPkg].registration.url}
                onChange={(e) => updateWebhookField(webhookEditingPkg, 'registration', 'url', e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
              />
              <input
                value={settingsForm.webhookSettings[webhookEditingPkg].registration.token}
                onChange={(e) => updateWebhookField(webhookEditingPkg, 'registration', 'token', e.target.value)}
                placeholder="Token (opsional)"
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
              />
            </div>
            <div className="border border-card-border rounded-lg p-3 bg-brand-gray/20 flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase text-sport-orange">Webhook Pembayaran</p>
              <input
                value={settingsForm.webhookSettings[webhookEditingPkg].payment.url}
                onChange={(e) => updateWebhookField(webhookEditingPkg, 'payment', 'url', e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
              />
              <input
                value={settingsForm.webhookSettings[webhookEditingPkg].payment.token}
                onChange={(e) => updateWebhookField(webhookEditingPkg, 'payment', 'token', e.target.value)}
                placeholder="Token (opsional)"
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={savePackages} isLoading={isPending}>
                Simpan
              </Button>
              <Button type="button" variant="secondary" onClick={() => setWebhookEditingPkg(null)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={!!participantEditing}
        onClose={() => {
          setParticipantEditing(null)
          setParticipantForm(null)
        }}
        title="Edit Data Peserta"
        className="max-w-2xl"
      >
        {participantForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['full_name', 'Nama Lengkap'],
              ['bib_name', 'Nama BIB'],
              ['ktp_number', 'No. KTP'],
              ['email', 'Email'],
              ['phone', 'WhatsApp'],
              ['medical_condition', 'Penyakit Bawaan'],
              ['emergency_contact_name', 'Nama Kontak Darurat'],
              ['emergency_contact_phone', 'No. Kontak Darurat'],
            ].map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-brand-muted">{label}</span>
                <input
                  type="text"
                  value={String(participantForm[key as keyof AdminParticipantUpdateValues] || '')}
                  onChange={(event) => setParticipantForm({ ...participantForm, [key]: event.target.value })}
                  className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Tanggal Lahir</span>
              <DateInput
                value={String(participantForm.date_of_birth || '')}
                onChange={(value) => setParticipantForm({ ...participantForm, date_of_birth: value })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              />
            </label>            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Gender</span>
              <select
                value={participantForm.gender}
                onChange={(event) => setParticipantForm({ ...participantForm, gender: event.target.value as 'male' | 'female' })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              >
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Jersey</span>
              <select
                value={participantForm.tshirt_size}
                onChange={(event) => setParticipantForm({ ...participantForm, tshirt_size: event.target.value })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              >
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Gol. Darah</span>
              <select
                value={participantForm.blood_type}
                onChange={(event) => setParticipantForm({ ...participantForm, blood_type: event.target.value })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              >
                {['A', 'B', 'AB', 'O'].map((bloodType) => <option key={bloodType} value={bloodType}>{bloodType}</option>)}
              </select>
            </label>
            <div className="sm:col-span-2 flex gap-2 pt-3 border-t border-card-border">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setParticipantEditing(null)}>Batal</Button>
              <Button type="button" className="flex-1" onClick={saveParticipant} isLoading={isPending}>Simpan</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={!!communityEditing}
        onClose={() => {
          setCommunityEditing(null)
          setCommunityForm(null)
        }}
        title={packageType === 'community' ? 'Edit Data Komunitas' : packageType === 'individual' ? 'Edit Data Peserta Individu' : 'Edit Data Bro & Sist Package'}
        className="max-w-2xl"
      >
        {communityForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['name', packageType === 'community' ? 'Nama Komunitas' : packageType === 'individual' ? 'Nama Peserta' : 'Nama Grup'],
              ['leader_name', packageType === 'community' ? 'Nama Ketua' : packageType === 'individual' ? 'Nama Peserta' : 'Nama Perwakilan'],
              ['email', 'Email'],
              ['phone', 'WhatsApp'],
              ['provinsi', 'Provinsi'],
              ['kota', 'Kota/Kabupaten'],
              ['kecamatan', 'Kecamatan'],
            ].map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-brand-muted">{label}</span>
                <input
                  value={String(communityForm[key as keyof AdminCommunityUpdateValues] || '')}
                  onChange={(event) => setCommunityForm({ ...communityForm, [key]: event.target.value })}
                  className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Password Baru</span>
              <input
                type="password"
                value={communityForm.password}
                onChange={(event) => setCommunityForm({ ...communityForm, password: event.target.value })}
                placeholder="Kosongkan jika tidak diubah"
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              />
            </label>
            <div className="sm:col-span-2 flex gap-2 pt-3 border-t border-card-border">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setCommunityEditing(null)}>Batal</Button>
              <Button type="button" className="flex-1" onClick={saveCommunity} isLoading={isPending}>Simpan</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={!!pacerDetail}
        onClose={() => setPacerDetail(null)}
        title="Detail Pacer"
        className="max-w-2xl"
      >
        {pacerDetail && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Nama / BIB</span>{pacerDetail.full_name} / {pacerDetail.bib_name}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Kode</span>{pacerDetail.pacer_code}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Kontak</span>{pacerDetail.phone} / {pacerDetail.email}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">KTP</span>{pacerDetail.ktp_number}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Usia / Gender</span>{pacerDetail.age ?? '-'} tahun / {pacerDetail.gender === 'male' ? 'Laki-laki' : 'Perempuan'}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Jersey / Gol. Darah</span>{pacerDetail.tshirt_size} / {pacerDetail.blood_type || '-'}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Lokasi</span>{pacerDetailLocation ? [pacerDetailLocation.kecamatan, pacerDetailLocation.kota, pacerDetailLocation.provinsi].filter((v) => v && v !== '-').join(', ') || '-' : 'Memuat...'}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Kontak Darurat</span>{pacerDetail.emergency_contact_name || '-'} ({pacerDetail.emergency_contact_phone || '-'})</div>
              <div className="flex items-center gap-1.5"><AtSign className="w-3 h-3 text-brand-muted" />{pacerDetail.sosmed_instagram ? <a href={pacerDetail.sosmed_instagram} target="_blank" rel="noopener noreferrer" className="text-sport-purple hover:underline truncate">{pacerDetail.sosmed_instagram}</a> : '-'}</div>
              <div className="flex items-center gap-1.5"><Music2 className="w-3 h-3 text-brand-muted" />{pacerDetail.sosmed_tiktok ? <a href={pacerDetail.sosmed_tiktok} target="_blank" rel="noopener noreferrer" className="text-sport-purple hover:underline truncate">{pacerDetail.sosmed_tiktok}</a> : '-'}</div>
              <div className="flex items-center gap-1.5 sm:col-span-2"><LinkIcon className="w-3 h-3 text-brand-muted" />Strava: {pacerDetail.strava_username || '-'} {pacerDetail.strava_link ? `(${pacerDetail.strava_link})` : ''}</div>
              <div className="flex items-center gap-1.5"><Watch className="w-3 h-3 text-brand-muted" />Smartwatch: {pacerDetail.has_smartwatch === 'yes' ? 'Ya' : 'Tidak'}</div>
              <div className="flex items-center gap-1.5 sm:col-span-2"><Banknote className="w-3 h-3 text-brand-muted" />{pacerDetail.bank_name || '-'} — {pacerDetail.bank_account_number || '-'} a.n. {pacerDetail.bank_account_holder || '-'}</div>
            </div>
            {pacerDetail.media_urls.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-2">Foto Portofolio</p>
                <div className="flex flex-wrap gap-3">
                  {pacerDetail.media_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="relative w-24 h-24 rounded-lg overflow-hidden border border-card-border block">
                      <Image src={url} alt="Foto pacer" fill unoptimized className="object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {pacerDetail.pb_media_urls.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-2">Bukti Personal Best (PB)</p>
                <div className="flex flex-wrap gap-3">
                  {pacerDetail.pb_media_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="relative w-24 h-24 rounded-lg overflow-hidden border border-card-border block">
                      <Image src={url} alt="Foto PB pacer" fill unoptimized className="object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {pacerDetail.status === 'rejected' && pacerDetail.status_note && (
              <p className="text-xs text-sport-red">Catatan penolakan: {pacerDetail.status_note}</p>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={!!pacerEditing}
        onClose={() => {
          setPacerEditing(null)
          setPacerForm(null)
        }}
        title="Edit Data Pacer"
        className="max-w-2xl"
      >
        {pacerForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['full_name', 'Nama Lengkap'],
              ['bib_name', 'Nama BIB'],
              ['ktp_number', 'No. KTP'],
              ['email', 'Email'],
              ['phone', 'WhatsApp'],
              ['medical_condition', 'Penyakit Bawaan'],
              ['emergency_contact_name', 'Nama Kontak Darurat'],
              ['emergency_contact_phone', 'No. Kontak Darurat'],
              ['sosmed_instagram', 'Instagram'],
              ['sosmed_tiktok', 'TikTok'],
              ['strava_link', 'Link Strava'],
              ['strava_username', 'Username Strava'],
              ['bank_name', 'Nama Bank'],
              ['bank_account_number', 'No. Rekening'],
              ['bank_account_holder', 'Nama Pemilik Rekening'],
            ].map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-brand-muted">{label}</span>
                <input
                  type="text"
                  value={String(pacerForm[key as keyof AdminPacerParticipantUpdateValues] || '')}
                  onChange={(event) => setPacerForm({ ...pacerForm, [key]: event.target.value })}
                  className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Usia</span>
              <input
                type="number"
                value={pacerForm.age}
                onChange={(event) => setPacerForm({ ...pacerForm, age: Number(event.target.value) })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Tanggal Lahir</span>
              <DateInput
                value={String(pacerForm.date_of_birth || '')}
                onChange={(value) => setPacerForm({ ...pacerForm, date_of_birth: value })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Gender</span>
              <select
                value={pacerForm.gender}
                onChange={(event) => setPacerForm({ ...pacerForm, gender: event.target.value as 'male' | 'female' })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              >
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Jersey</span>
              <select
                value={pacerForm.tshirt_size}
                onChange={(event) => setPacerForm({ ...pacerForm, tshirt_size: event.target.value })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              >
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Gol. Darah</span>
              <select
                value={pacerForm.blood_type}
                onChange={(event) => setPacerForm({ ...pacerForm, blood_type: event.target.value })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              >
                {['A', 'B', 'AB', 'O'].map((bloodType) => <option key={bloodType} value={bloodType}>{bloodType}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Punya Smartwatch?</span>
              <select
                value={pacerForm.has_smartwatch}
                onChange={(event) => setPacerForm({ ...pacerForm, has_smartwatch: event.target.value as 'yes' | 'no' })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              >
                <option value="yes">Ya</option>
                <option value="no">Tidak</option>
              </select>
            </label>
            <div className="sm:col-span-2 flex gap-2 pt-3 border-t border-card-border">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setPacerEditing(null)}>Batal</Button>
              <Button type="button" className="flex-1" onClick={savePacer} isLoading={isPending}>Simpan</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={!!adminEditForm}
        onClose={() => setAdminEditForm(null)}
        title="Edit Akun Admin"
        className="max-w-lg"
      >
        {adminEditForm && (
          <div className="grid grid-cols-1 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Nama</span>
              <input
                value={adminEditForm.name}
                onChange={(event) => setAdminEditForm({ ...adminEditForm, name: event.target.value })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Role</span>
              <select
                value={adminEditForm.role}
                onChange={(event) => setAdminEditForm({ ...adminEditForm, role: event.target.value as 'admin' | 'superadmin' })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Username</span>
              <input
                value={adminEditForm.username}
                onChange={(event) => setAdminEditForm({ ...adminEditForm, username: event.target.value })}
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Password Baru (Opsional)</span>
              <input
                type="password"
                value={adminEditForm.password}
                onChange={(event) => setAdminEditForm({ ...adminEditForm, password: event.target.value })}
                placeholder="Kosongkan jika tidak diganti"
                className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
              />
            </label>
             {adminEditForm.role === 'admin' ? (
              <div className="flex flex-col gap-2 border border-card-border rounded-lg p-3 bg-brand-dark/20">
                <span className="text-[10px] font-black uppercase text-sport-orange">Hak Akses Menu</span>
                <p className="text-[9px] text-brand-muted">Pilih menu sidebar yang boleh diakses:</p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { id: 'summary', label: 'Ringkasan' },
                    { id: 'scanner', label: 'Scan Racepack' },
                    { id: 'participants', label: 'Peserta' },
                    { id: 'payments', label: 'Pembayaran' },
                    { id: 'export_participants', label: 'Export Peserta' },
                    { id: 'export_payments', label: 'Export Pembayaran' },
                    { id: 'pacer', label: 'Pacer' },
                    { id: 'packages', label: 'Kelola Paket' },
                    { id: 'periods', label: 'Kelola Periode' },
                    { id: 'logs', label: 'Log Axiom' },
                    { id: 'admins', label: 'Kelola Admin' },
                    { id: 'settings', label: 'Pengaturan' },
                  ].map((tab) => {
                    const isChecked = adminEditForm.allowed_tabs.includes(tab.id)
                    return (
                      <label key={tab.id} className="inline-flex items-center gap-2 text-[11px] font-bold text-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked
                            const nextTabs = checked
                              ? [...adminEditForm.allowed_tabs, tab.id]
                              : adminEditForm.allowed_tabs.filter((t) => t !== tab.id)
                            setAdminEditForm({ ...adminEditForm, allowed_tabs: nextTabs })
                          }}
                          className="rounded border-card-border bg-brand-dark text-sport-orange focus:ring-0 focus:ring-offset-0"
                        />
                        {tab.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-card-border/50 rounded-lg p-3 bg-sport-orange/5 text-center">
                <p className="text-[10px] font-black uppercase text-sport-orange">Akses Penuh</p>
                <p className="text-[9px] text-brand-muted mt-0.5">Superadmin otomatis memiliki akses ke semua menu sidebar.</p>
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted">
              <input
                type="checkbox"
                checked={adminEditForm.is_active}
                onChange={(event) => setAdminEditForm({ ...adminEditForm, is_active: event.target.checked })}
              />
              Admin aktif
            </label>
            <div className="flex gap-2 pt-2 border-t border-card-border">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setAdminEditForm(null)}>Batal</Button>
              <Button type="button" className="flex-1" onClick={handleUpdateAdmin} isLoading={isPending}>Simpan</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
