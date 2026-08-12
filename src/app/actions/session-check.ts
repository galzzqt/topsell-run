'use server'

import { getCommunitySession } from '@/lib/auth/community'
import { getFamilySession } from '@/lib/auth/family'
import { getIndividualSession } from '@/lib/auth/individual'

export type ActiveSession =
  | { type: 'community'; name: string; dashboardUrl: string }
  | { type: 'family'; name: string; dashboardUrl: string }
  | { type: 'individual'; name: string; dashboardUrl: string }
  | null

/**
 * Checks both community and family sessions and returns the active one.
 * Used by the landing page header to show the logged-in user's name.
 */
export async function getActiveSessionAction(): Promise<ActiveSession> {
  const [communitySession, familySession, individualSession] = await Promise.all([
    getCommunitySession().catch(() => null),
    getFamilySession().catch(() => null),
    getIndividualSession().catch(() => null),
  ])

  if (communitySession?.name) {
    return {
      type: 'community',
      name: communitySession.name,
      dashboardUrl: '/community-dashboard',
    }
  }

  if (familySession?.name) {
    return {
      type: 'family',
      name: familySession.name,
      dashboardUrl: '/dashboard',
    }
  }

  if (individualSession?.name) {
    return {
      type: 'individual',
      name: individualSession.name,
      dashboardUrl: '/individu-dashboard',
    }
  }

  return null
}
