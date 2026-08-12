import { create } from 'zustand'
import { fetchIndividualDashboardDataAction } from '@/app/actions/individual-dashboard'
import { Individual, IndividualParticipant, IndividualRegistration, IndividualPayment, IndividualDashboardStats } from '../types'

export type IndividualUser = {
  id: string
  phone: string
  name: string
}

interface IndividualState {
  user: IndividualUser | null
  individual: Individual | null
  participants: IndividualParticipant[]
  registrations: IndividualRegistration[]
  payments: IndividualPayment[]
  isLoading: boolean

  setUser: (user: IndividualUser | null) => void
  fetchIndividualData: (silent?: boolean) => Promise<void>
  getStats: () => IndividualDashboardStats
  clearStore: () => void
}

export const useIndividualStore = create<IndividualState>((set, get) => ({
  user: null,
  individual: null,
  participants: [],
  registrations: [],
  payments: [],
  isLoading: false,

  setUser: (user) => set({ user }),

  fetchIndividualData: async (silent = false) => {
    if (!silent) set({ isLoading: true })
    try {
      const result = await fetchIndividualDashboardDataAction()
      if ('error' in result && result.error) {
        console.error('Error fetching individual data:', result.error)
        return
      }
      if ('individual' in result) {
        set({
          individual: result.individual,
          participants: result.participants,
          registrations: result.registrations,
          payments: result.payments,
        })
      }
    } catch (error) {
      console.error('Error fetching individual data:', error)
    } finally {
      if (!silent) set({ isLoading: false })
    }
  },

  getStats: () => {
    const { participants, payments, individual } = get()
    return {
      totalParticipants: participants.length,
      paidParticipants: participants.filter((p) => p.payment_status === 'paid').length,
      pendingParticipants: participants.filter((p) => p.payment_status === 'pending').length,
      totalAmountPaid: payments.filter((p) => p.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0),
      individualCode: individual?.individual_code || '',
    }
  },

  clearStore: () => set({ user: null, individual: null, participants: [], registrations: [], payments: [] }),
}))
