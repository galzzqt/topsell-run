import { create } from 'zustand'
import { fetchCommunityDashboardDataAction } from '@/app/actions/dashboard'
import { Community, Participant, Registration, Payment, DashboardStats } from '../types'

export type CommunityUser = {
  id: string
  phone: string
  name: string
}

interface AppState {
  user: CommunityUser | null
  community: Community | null
  participants: Participant[]
  registrations: Registration[]
  payments: Payment[]
  isLoading: boolean

  setUser: (user: CommunityUser | null) => void
  setCommunity: (community: Community | null) => void
  setParticipants: (participants: Participant[]) => void
  setRegistrations: (registrations: Registration[]) => void
  setPayments: (payments: Payment[]) => void
  setLoading: (isLoading: boolean) => void

  fetchCommunityData: (silent?: boolean) => Promise<void>
  getStats: () => DashboardStats
  clearStore: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  community: null,
  participants: [],
  registrations: [],
  payments: [],
  isLoading: false,

  setUser: (user) => set({ user }),
  setCommunity: (community) => set({ community }),
  setParticipants: (participants) => set({ participants }),
  setRegistrations: (registrations) => set({ registrations }),
  setPayments: (payments) => set({ payments }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchCommunityData: async (silent = false) => {
    if (!silent) set({ isLoading: true })
    try {
      const result = await fetchCommunityDashboardDataAction()
      if ('error' in result && result.error) {
        console.error('Error fetching community data:', result.error)
        return
      }

      if ('community' in result) {
        set({
          community: result.community,
          participants: result.participants,
          registrations: result.registrations,
          payments: result.payments,
        })
      }
    } catch (error) {
      console.error('Error fetching community data:', error)
    } finally {
      if (!silent) set({ isLoading: false })
    }
  },

  getStats: () => {
    const { participants, payments, community } = get()

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
      communityCode: community?.community_code || '',
    }
  },

  clearStore: () => {
    set({
      user: null,
      community: null,
      participants: [],
      registrations: [],
      payments: [],
    })
  },
}))
