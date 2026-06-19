'use server'

import { getCommunitySession } from '@/lib/auth/community'
import { getFamilySession } from '@/lib/auth/family'

export type ActiveSession =
  | { type: 'community'; name: string; dashboardUrl: string }
  | { type: 'family'; name: string; dashboardUrl: string }
  | null

/**
 * Checks both community and family sessions and returns the active one.
 * Used by the landing page header to show the logged-in user's name.
 */
export async function getActiveSessionAction(): Promise<ActiveSession> {
  const [communitySession, familySession] = await Promise.all([
    getCommunitySession().catch(() => null),
    getFamilySession().catch(() => null),
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

  return null
}
