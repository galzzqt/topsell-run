import { create } from 'zustand'
import { fetchPacerDashboardDataAction } from '@/app/actions/pacer-dashboard'
import { PacerRegistration, PacerParticipant } from '../types'

export type PacerUser = {
  id: string
  phone: string
  name: string
}

interface PacerState {
  user: PacerUser | null
  pacer: PacerRegistration | null
  participant: PacerParticipant | null
  isLoading: boolean

  setUser: (user: PacerUser | null) => void
  fetchPacerData: (silent?: boolean) => Promise<void>
  clearStore: () => void
}

export const usePacerStore = create<PacerState>((set) => ({
  user: null,
  pacer: null,
  participant: null,
  isLoading: false,

  setUser: (user) => set({ user }),

  fetchPacerData: async (silent = false) => {
    if (!silent) set({ isLoading: true })
    try {
      const result = await fetchPacerDashboardDataAction()
      if ('error' in result && result.error) {
        console.error('Error fetching pacer data:', result.error)
        return
      }
      if ('pacer' in result) {
        set({
          pacer: result.pacer,
          participant: result.participant,
        })
      }
    } catch (error) {
      console.error('Error fetching pacer data:', error)
    } finally {
      if (!silent) set({ isLoading: false })
    }
  },

  clearStore: () => set({ user: null, pacer: null, participant: null }),
}))
