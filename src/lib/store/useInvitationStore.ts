import { create } from 'zustand'
import { fetchInvitationDashboardDataAction } from '@/app/actions/invitation-dashboard'
import { Invitation, InvitationParticipant, InvitationRegistration, InvitationPayment, InvitationDashboardStats } from '../types'

export type InvitationUser = {
  id: string
  phone: string
  name: string
}

interface InvitationState {
  user: InvitationUser | null
  invitation: Invitation | null
  participants: InvitationParticipant[]
  registrations: InvitationRegistration[]
  payments: InvitationPayment[]
  isLoading: boolean

  setUser: (user: InvitationUser | null) => void
  fetchInvitationData: (silent?: boolean) => Promise<void>
  getStats: () => InvitationDashboardStats
  clearStore: () => void
}

export const useInvitationStore = create<InvitationState>((set, get) => ({
  user: null,
  invitation: null,
  participants: [],
  registrations: [],
  payments: [],
  isLoading: false,

  setUser: (user) => set({ user }),

  fetchInvitationData: async (silent = false) => {
    if (!silent) set({ isLoading: true })
    try {
      const result = await fetchInvitationDashboardDataAction()
      if ('error' in result && result.error) {
        console.error('Error fetching invitation data:', result.error)
        return
      }
      if ('invitation' in result) {
        set({
          invitation: result.invitation,
          participants: result.participants,
          registrations: result.registrations,
          payments: result.payments,
        })
      }
    } catch (error) {
      console.error('Error fetching invitation data:', error)
    } finally {
      if (!silent) set({ isLoading: false })
    }
  },

  getStats: () => {
    const { participants, payments, invitation } = get()
    return {
      totalParticipants: participants.length,
      paidParticipants: participants.filter((p) => p.payment_status === 'paid').length,
      pendingParticipants: participants.filter((p) => p.payment_status === 'pending').length,
      totalAmountPaid: payments.filter((p) => p.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0),
      invitationCode: invitation?.invitation_code || '',
    }
  },

  clearStore: () => set({ user: null, invitation: null, participants: [], registrations: [], payments: [] }),
}))
