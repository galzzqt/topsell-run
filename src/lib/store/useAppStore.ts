import { create } from 'zustand'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { Community, Participant, Registration, Payment, DashboardStats } from '../types'

interface AppState {
  user: User | null
  community: Community | null
  participants: Participant[]
  registrations: Registration[]
  payments: Payment[]
  isLoading: boolean

  setUser: (user: User | null) => void
  setCommunity: (community: Community | null) => void
  setParticipants: (participants: Participant[]) => void
  setRegistrations: (registrations: Registration[]) => void
  setPayments: (payments: Payment[]) => void
  setLoading: (isLoading: boolean) => void

  // Data fetching
  fetchCommunityData: (supabase: SupabaseClient, userId: string, silent?: boolean) => Promise<void>
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

  fetchCommunityData: async (supabase, userId, silent = false) => {
    if (!silent) set({ isLoading: true })
    try {
      // 1. Fetch community profile
      const { data: communityData } = await supabase
        .from('communities')
        .select('*')
        .eq('id', userId)
        .single()

      if (communityData) {
        set({ community: communityData })
      }

      // 2. Fetch participants under this community
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('community_id', userId)
        .order('created_at', { ascending: true })

      if (participantsData) {
        set({ participants: participantsData })
      }

      // 3. Fetch registrations (payment groups)
      const { data: registrationsData } = await supabase
        .from('registrations')
        .select('*')
        .eq('community_id', userId)
        .order('created_at', { ascending: false })

      if (registrationsData) {
        set({ registrations: registrationsData })
      }

      // 4. Fetch payments linked to the community's registrations
      if (registrationsData && registrationsData.length > 0) {
        const regIds = registrationsData.map((r: Registration) => r.id)
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .in('registration_id', regIds)
          .order('created_at', { ascending: false })

        if (paymentsData) {
          set({ payments: paymentsData })
        }
      } else {
        set({ payments: [] })
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
