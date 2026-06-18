import { create } from 'zustand'
import { fetchFamilyDashboardDataAction } from '@/app/actions/family-dashboard'
import { Family, FamilyParticipant, FamilyRegistration, FamilyPayment, DashboardStats } from '../types'

export type FamilyUser = {
  id: string
  phone: string
  name: string
}

interface FamilyState {
  user: FamilyUser | null
  family: Family | null
  participants: FamilyParticipant[]
  registrations: FamilyRegistration[]
  payments: FamilyPayment[]
  isLoading: boolean

  setUser: (user: FamilyUser | null) => void
  setFamily: (family: Family | null) => void
  setParticipants: (participants: FamilyParticipant[]) => void
  setRegistrations: (registrations: FamilyRegistration[]) => void
  setPayments: (payments: FamilyPayment[]) => void
  setLoading: (isLoading: boolean) => void

  fetchFamilyData: (silent?: boolean) => Promise<void>
  getStats: () => DashboardStats
  clearStore: () => void
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  user: null,
  family: null,
  participants: [],
  registrations: [],
  payments: [],
  isLoading: false,

  setUser: (user) => set({ user }),
  setFamily: (family) => set({ family }),
  setParticipants: (participants) => set({ participants }),
  setRegistrations: (registrations) => set({ registrations }),
  setPayments: (payments) => set({ payments }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchFamilyData: async (silent = false) => {
    if (!silent) set({ isLoading: true })
    try {
      const result = await fetchFamilyDashboardDataAction()
      if ('error' in result && result.error) {
        console.error('Error fetching family data:', result.error)
        return
      }

      if ('family' in result) {
        set({
          family: result.family,
          participants: result.participants,
          registrations: result.registrations,
          payments: result.payments,
        })
      }
    } catch (error) {
      console.error('Error fetching family data:', error)
    } finally {
      if (!silent) set({ isLoading: false })
    }
  },

  getStats: () => {
    const { participants, payments, family } = get()

    const totalParticipants = participants.length
    const paidParticipants = participants.filter((p) => p.payment_status === 'paid').length
    const pendingParticipants = participants.filter((p) => p.payment_status === 'pending').length
    const totalAmountPaid = payments
      .filter((p) => p.status === 'paid')
      .reduce((acc, curr) => acc + curr.amount, 0)

    return {
      totalParticipants,
      paidParticipants,
      pendingParticipants,
      totalAmountPaid,
      communityCode: family?.family_code || '',
    }
  },

  clearStore: () => {
    set({
      user: null,
      family: null,
      participants: [],
      registrations: [],
      payments: [],
    })
  },
}))
