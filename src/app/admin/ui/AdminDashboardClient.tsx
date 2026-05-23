'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Activity,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  LogOut,
  Pencil,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  TicketCheck,
  Users,
} from 'lucide-react'
import {
  logoutAdmin,
  markRacepackPickedUp,
  saveEditableEnvValues,
  saveRegistrationFormSettings,
  updateAdminCommunity,
  updateAdminParticipant,
  type AdminCommunityUpdateValues,
  type AdminParticipantUpdateValues,
} from '../actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils/format'
import type { AdminEnvSnapshot, AdminSettings, FormInputConfig, FormSelectConfig } from '@/lib/admin/settings-schema'

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
}

type RegistrationInfo = {
  community_id: string
  community: Relation<CommunityInfo>
}

export type AdminParticipant = {
  id: string
  full_name: string
  bib_name: string
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
  payment_status: 'pending' | 'paid' | 'failed'
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
}

export type AdminPayment = {
  id: string
  registration_id: string
  amount: number
  payment_method: string | null
  payment_reference: string
  status: 'pending' | 'paid' | 'failed'
  paid_at: string | null
  created_at: string
  registration: Relation<RegistrationInfo>
}

export type AdminStats = {
  communities: number
  participants: number
  paidParticipants: number
  pendingParticipants: number
  racepacksPickedUp: number
  revenue: number
}

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
  payment_status: 'pending' | 'paid' | 'failed'
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
  adminSettings,
  editableEnv,
}: {
  stats: AdminStats
  participants: AdminParticipant[]
  communities: AdminCommunity[]
  payments: AdminPayment[]
  adminSettings: AdminSettings
  editableEnv: AdminEnvSnapshot[]
}) {
  const router = useRouter()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef('')
  const scanRegionId = 'admin-racepack-reader'
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'participants' | 'payments' | 'scanner' | 'settings'>('scanner')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [expandedCommunities, setExpandedCommunities] = useState<Set<string>>(new Set())
  const [participantEditing, setParticipantEditing] = useState<AdminParticipant | null>(null)
  const [communityEditing, setCommunityEditing] = useState<AdminCommunity | null>(null)
  const [participantForm, setParticipantForm] = useState<AdminParticipantUpdateValues | null>(null)
  const [communityForm, setCommunityForm] = useState<AdminCommunityUpdateValues | null>(null)
  const [settingsForm, setSettingsForm] = useState<AdminSettings>(adminSettings)
  const [envSnapshots, setEnvSnapshots] = useState<AdminEnvSnapshot[]>(editableEnv)
  const [envForm, setEnvForm] = useState<Record<string, string>>({})
  const [selectedExportCommunities, setSelectedExportCommunities] = useState<Set<string>>(new Set(communities.map((community) => community.id)))
  const [settingsMessage, setSettingsMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const filteredParticipants = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return participants
    return participants.filter((participant) => {
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
  }, [participants, query])

  const groupedParticipants = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; code: string; participants: AdminParticipant[] }>()

    for (const participant of filteredParticipants) {
      const community = getParticipantCommunity(participant)
      const code = community?.community_code || 'TANPA-KODE'
      const name = community?.name || 'Tanpa Komunitas'
      const key = `${code}:${name}`
      const current = groups.get(key)

      if (current) {
        current.participants.push(participant)
      } else {
        groups.set(key, { key, name, code, participants: [participant] })
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredParticipants])

  const communitiesByKey = useMemo(() => {
    const map = new Map<string, AdminCommunity>()
    for (const community of communities) {
      map.set(`${community.community_code}:${community.name}`, community)
    }
    return map
  }, [communities])

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
      Status: payment.status,
      'Dibayar Pada': payment.paid_at ? formatDateTime(payment.paid_at) : '',
      'Dibuat Pada': formatDateTime(payment.created_at),
    }
  })

  const exportWorkbook = async (type: 'participants' | 'payments' | 'all', mode: 'all' | 'selected' = 'all') => {
    const XLSX = await import('xlsx')
    const today = new Date().toISOString().slice(0, 10)
    const selectedIds = mode === 'selected' ? selectedExportCommunities : new Set(communities.map((community) => community.id))
    const selectedCommunities = communities.filter((community) => selectedIds.has(community.id))

    if (mode === 'selected' && selectedCommunities.length === 0) {
      alert('Pilih minimal satu komunitas untuk diekspor.')
      return
    }

    for (const community of selectedCommunities) {
      const communityParticipants = participants.filter((participant) => getParticipantCommunity(participant)?.id === community.id)
      const communityPayments = payments.filter((payment) => getPaymentCommunity(payment)?.id === community.id)
      const workbook = XLSX.utils.book_new()

      if (type === 'participants' || type === 'all') {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildParticipantExportRows(communityParticipants)), 'Peserta')
      }

      if (type === 'payments' || type === 'all') {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildPaymentExportRows(communityPayments)), 'Pembayaran')
      }

      XLSX.writeFile(workbook, `topsell-run-${slugify(community.community_code)}-${slugify(community.name)}-${type}-${today}.xlsx`)
    }
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAdmin()
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
      provinsi: community.provinsi || '',
      kota: community.kota || '',
      kecamatan: community.kecamatan || '',
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
      const result = await updateAdminCommunity(communityForm)
      if (result.error) {
        alert(result.error)
        return
      }
      setCommunityEditing(null)
      setCommunityForm(null)
      router.refresh()
    })
  }

  const updateCommunityField = (key: keyof AdminSettings['registrationForm']['community'], value: Partial<FormInputConfig>) => {
    setSettingsForm((current) => ({
      ...current,
      registrationForm: {
        ...current.registrationForm,
        community: {
          ...current.registrationForm.community,
          [key]: { ...current.registrationForm.community[key], ...value },
        },
      },
    }))
  }

  const updateParticipantField = (key: keyof AdminSettings['registrationForm']['participants'], value: Partial<FormInputConfig>) => {
    setSettingsForm((current) => ({
      ...current,
      registrationForm: {
        ...current.registrationForm,
        participants: {
          ...current.registrationForm.participants,
          [key]: { ...current.registrationForm.participants[key], ...value },
        },
      },
    }))
  }

  const updateSelectOptionLabel = (
    key: 'gender' | 'tshirt_size' | 'blood_type',
    value: string,
    label: string
  ) => {
    setSettingsForm((current) => {
      const field = current.registrationForm.participants[key] as FormSelectConfig
      return {
        ...current,
        registrationForm: {
          ...current.registrationForm,
          participants: {
            ...current.registrationForm.participants,
            [key]: {
              ...field,
              options: field.options.map((option) => (option.value === value ? { ...option, label } : option)),
            },
          },
        },
      }
    })
  }

  const saveSettings = () => {
    setSettingsMessage('')
    startTransition(async () => {
      const result = await saveRegistrationFormSettings(settingsForm)
      if (result.error) {
        alert(result.error)
        return
      }
      setSettingsMessage('Pengaturan form pendaftaran berhasil disimpan.')
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

  const toggleExportCommunity = (communityId: string) => {
    setSelectedExportCommunities((current) => {
      const next = new Set(current)
      if (next.has(communityId)) next.delete(communityId)
      else next.add(communityId)
      return next
    })
  }

  const setAllExportCommunities = (checked: boolean) => {
    setSelectedExportCommunities(checked ? new Set(communities.map((community) => community.id)) : new Set())
  }

  const communitySettingFields: Array<[keyof AdminSettings['registrationForm']['community'], string]> = [
    ['name', 'Nama Komunitas'],
    ['leader_name', 'Nama Ketua / PIC'],
    ['phone', 'No. WhatsApp Ketua'],
    ['email', 'Email Komunitas'],
    ['provinsi', 'Provinsi'],
    ['kota', 'Kota / Kabupaten'],
    ['kecamatan', 'Kecamatan'],
    ['password', 'Password'],
    ['confirmPassword', 'Konfirmasi Password'],
  ]

  const participantInputSettingFields: Array<[keyof AdminSettings['registrationForm']['participants'], string]> = [
    ['full_name', 'Nama Lengkap Peserta'],
    ['bib_name', 'Nama BIB'],
    ['email', 'Email Peserta'],
    ['phone', 'No. WhatsApp Peserta'],
    ['date_of_birth', 'Tanggal Lahir'],
    ['medical_condition', 'Penyakit Bawaan'],
    ['emergency_contact_name', 'Nama Kontak Darurat'],
    ['emergency_contact_phone', 'No. Kontak Darurat'],
  ]

  const participantSelectSettingFields: Array<['gender' | 'tshirt_size' | 'blood_type', string]> = [
    ['gender', 'Jenis Kelamin'],
    ['tshirt_size', 'Ukuran Jersey'],
    ['blood_type', 'Golongan Darah'],
  ]

  return (
    <main className="min-h-screen bg-brand-dark text-foreground">
      <header className="sports-glass sticky top-0 z-30 border-b border-card-border px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-sport-red to-sport-orange rounded-lg">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">TOPSELL RUN 2026</p>
              <h1 className="text-sm font-black uppercase text-foreground">Super Admin Dashboard</h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} isLoading={isPending}>
            <LogOut className="w-4 h-4 mr-2" />Keluar
          </Button>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: 'Komunitas', value: stats.communities, icon: <Activity className="w-4 h-4" /> },
            { label: 'Peserta', value: stats.participants, icon: <Users className="w-4 h-4" /> },
            { label: 'Lunas', value: stats.paidParticipants, icon: <CheckCircle className="w-4 h-4" /> },
            { label: 'Pending', value: stats.pendingParticipants, icon: <CreditCard className="w-4 h-4" /> },
            { label: 'Racepack', value: stats.racepacksPickedUp, icon: <TicketCheck className="w-4 h-4" /> },
            { label: 'Revenue', value: formatCurrency(stats.revenue), icon: <CreditCard className="w-4 h-4" /> },
          ].map((item) => (
            <div key={item.label} className="bg-card-bg border border-card-border rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">{item.label}</p>
                <p className="text-lg font-black text-foreground">{item.value}</p>
              </div>
              <div className="p-2 bg-sport-orange/10 border border-sport-orange/20 rounded-lg text-sport-orange">
                {item.icon}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card-bg border border-card-border rounded-lg p-3 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex gap-2">
            {(['scanner', 'participants', 'payments', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                  activeTab === tab ? 'bg-sport-orange/15 text-sport-orange border border-sport-orange/40' : 'text-brand-muted hover:text-foreground'
                }`}
              >
                {tab === 'scanner' ? 'Scan Racepack' : tab === 'participants' ? 'Peserta' : tab === 'payments' ? 'Pembayaran' : 'Pengaturan'}
              </button>
            ))}
          </div>
          <label className="relative w-full lg:max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari peserta, komunitas, BIB, email..."
              className="w-full pl-9 pr-3 py-2.5 bg-brand-gray/40 border border-card-border rounded-lg text-xs text-foreground placeholder:text-brand-muted focus:outline-none focus:border-sport-orange"
            />
          </label>
        </div>

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
                        { label: 'Status Bayar', value: scanResult.participant.payment_status === 'paid' ? 'Lunas' : scanResult.participant.payment_status },
                        { label: 'Racepack', value: scanResult.participant.checked_in ? 'Sudah diambil' : 'Belum diambil' },
                        { label: 'Waktu Ambil', value: formatDateTime(scanResult.participant.checked_in_at) },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-card-border bg-brand-dark/30 p-3 min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">{item.label}</p>
                          <p className="text-sm font-bold text-foreground break-words">{item.value}</p>
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
            <div className="bg-brand-dark/30 border-b border-card-border px-4 py-3 grid grid-cols-[1fr_auto] gap-3 items-center">
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">Komunitas</p>
                <p className="text-xs font-bold text-foreground">{groupedParticipants.length} komunitas ditemukan</p>
              </div>
              <p className="text-[10px] font-bold text-brand-muted">{filteredParticipants.length} peserta</p>
            </div>

            {groupedParticipants.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-bold text-foreground">Data peserta tidak ditemukan</p>
                <p className="text-xs text-brand-muted mt-1">Coba gunakan kata pencarian lain.</p>
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
                            className="mt-0.5 p-1.5 rounded-lg bg-brand-gray/40 border border-card-border text-brand-muted"
                          >
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground break-words">{group.name}</p>
                            <p className="text-[10px] font-bold text-brand-muted">{group.code}</p>
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
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-card-border rounded text-[9px] font-black uppercase text-brand-muted hover:text-foreground"
                            >
                              <Pencil className="w-3 h-3" />Edit Komunitas
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleCommunity(group.key)}
                            className="text-[10px] font-black uppercase tracking-wider text-sport-orange"
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
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge variant={participant.payment_status === 'paid' ? 'success' : 'warning'}>
                                      {participant.payment_status === 'paid' ? 'Lunas' : 'Pending'}
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
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-card-border rounded text-[9px] font-black uppercase text-brand-muted hover:text-foreground"
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
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-brand-dark/30 border-b border-card-border">
                  <tr>
                    {['Referensi', 'Komunitas', 'Nominal', 'Metode', 'Status', 'Tanggal'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-brand-muted">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const community = getPaymentCommunity(payment)
                    return (
                      <tr key={payment.id} className="border-b border-card-border hover:bg-brand-gray/20">
                        <td className="px-4 py-3 text-xs font-bold text-foreground">{payment.payment_reference}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-foreground">{community?.name || '-'}</p>
                          <p className="text-[10px] text-brand-muted">{community?.community_code || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-black text-foreground">{formatCurrency(payment.amount)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-brand-muted">{payment.payment_method || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={payment.status === 'paid' ? 'success' : 'warning'}>{payment.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-brand-muted">{formatDateTime(payment.paid_at || payment.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
            <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Form Pendaftaran</p>
                  <h2 className="text-sm font-black uppercase text-foreground">Edit Label, Placeholder, dan Dropdown</h2>
                </div>
                <Settings className="w-5 h-5 text-sport-orange" />
              </div>
              <div className="p-4 flex flex-col gap-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-3">Field Komunitas</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {communitySettingFields.map(([key, title]) => {
                      const field = settingsForm.registrationForm.community[key]
                      return (
                        <div key={key} className="border border-card-border rounded-lg p-3 bg-brand-gray/20">
                          <p className="text-[10px] font-black uppercase text-sport-orange mb-2">{title}</p>
                          <input
                            value={field.label}
                            onChange={(event) => updateCommunityField(key, { label: event.target.value })}
                            placeholder="Label field"
                            className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-2"
                          />
                          <input
                            value={field.placeholder}
                            onChange={(event) => updateCommunityField(key, { placeholder: event.target.value })}
                            placeholder="Placeholder"
                            className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-3">Field Peserta</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {participantInputSettingFields.map(([key, title]) => {
                      const field = settingsForm.registrationForm.participants[key] as FormInputConfig
                      return (
                        <div key={key} className="border border-card-border rounded-lg p-3 bg-brand-gray/20">
                          <p className="text-[10px] font-black uppercase text-sport-orange mb-2">{title}</p>
                          <input
                            value={field.label}
                            onChange={(event) => updateParticipantField(key, { label: event.target.value })}
                            placeholder="Label field"
                            className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-2"
                          />
                          <input
                            value={field.placeholder}
                            onChange={(event) => updateParticipantField(key, { placeholder: event.target.value })}
                            placeholder="Placeholder"
                            className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-3">Dropdown Peserta</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {participantSelectSettingFields.map(([key, title]) => {
                      const field = settingsForm.registrationForm.participants[key] as FormSelectConfig
                      return (
                        <div key={key} className="border border-card-border rounded-lg p-3 bg-brand-gray/20">
                          <p className="text-[10px] font-black uppercase text-sport-orange mb-2">{title}</p>
                          <input
                            value={field.label}
                            onChange={(event) => updateParticipantField(key, { label: event.target.value })}
                            placeholder="Label dropdown"
                            className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-2"
                          />
                          <input
                            value={field.placeholder}
                            onChange={(event) => updateParticipantField(key, { placeholder: event.target.value })}
                            placeholder="Placeholder dropdown"
                            className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground mb-3"
                          />
                          <div className="flex flex-col gap-2">
                            {field.options.map((option) => (
                              <label key={option.value} className="grid grid-cols-[3.5rem_1fr] gap-2 items-center">
                                <span className="text-[10px] font-black text-brand-muted">{option.value}</span>
                                <input
                                  value={option.label}
                                  onChange={(event) => updateSelectOptionLabel(key, option.value, event.target.value)}
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

                <Button type="button" onClick={saveSettings} isLoading={isPending}>
                  Simpan Pengaturan Form
                </Button>
              </div>
            </section>

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
          </div>
        )}

        <div className="bg-card-bg border border-card-border rounded-lg p-4 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Export Data</p>
              <p className="text-xs font-bold text-brand-muted">Pilih komunitas, lalu sistem membuat 1 file Excel untuk tiap komunitas.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted">
              <input
                type="checkbox"
                checked={selectedExportCommunities.size === communities.length && communities.length > 0}
                onChange={(event) => setAllExportCommunities(event.target.checked)}
              />
              Pilih semua komunitas
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
            {communities.map((community) => (
              <label key={community.id} className="flex items-start gap-2 rounded-lg border border-card-border bg-brand-gray/20 p-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedExportCommunities.has(community.id)}
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
          <Button type="button" variant="secondary" onClick={() => exportWorkbook('participants', 'selected')}>
            <Download className="w-4 h-4 mr-2" />Export Peserta
          </Button>
          <Button type="button" variant="secondary" onClick={() => exportWorkbook('payments', 'selected')}>
            <Download className="w-4 h-4 mr-2" />Export Pembayaran
          </Button>
          <Button type="button" variant="outline" onClick={() => exportWorkbook('all', 'selected')}>
            <Download className="w-4 h-4 mr-2" />Export Semua
          </Button>
          </div>
        </div>
      </section>

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
              ['email', 'Email'],
              ['phone', 'WhatsApp'],
              ['date_of_birth', 'Tanggal Lahir'],
              ['medical_condition', 'Penyakit Bawaan'],
              ['emergency_contact_name', 'Nama Kontak Darurat'],
              ['emergency_contact_phone', 'No. Kontak Darurat'],
            ].map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-brand-muted">{label}</span>
                <input
                  type={key === 'date_of_birth' ? 'date' : 'text'}
                  value={String(participantForm[key as keyof AdminParticipantUpdateValues] || '')}
                  onChange={(event) => setParticipantForm({ ...participantForm, [key]: event.target.value })}
                  className="w-full px-3 py-2 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
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
        title="Edit Data Komunitas"
        className="max-w-2xl"
      >
        {communityForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['name', 'Nama Komunitas'],
              ['leader_name', 'Nama Ketua'],
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
    </main>
  )
}
