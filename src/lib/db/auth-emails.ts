import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Community, Family } from '@/lib/types'
import { exactEmailRegex, stripMongoId } from './utils'

type AuthEmailOwner =
  | { type: 'community'; account: Community }
  | { type: 'family'; account: Family }

export async function findAuthEmailOwner(email: string, exclude?: { type: 'community' | 'family'; id: string }) {
  const db = await getDb()
  const emailFilter = { $regex: exactEmailRegex(email) }

  const community = await db.collection<Community & { _id?: unknown }>('communities').findOne({
    email: emailFilter,
    ...(exclude?.type === 'community' ? { id: { $ne: exclude.id } } : {}),
  })

  if (community) {
    return { type: 'community' as const, account: stripMongoId(community) as Community } satisfies AuthEmailOwner
  }

  const family = await db.collection<Family & { _id?: unknown }>('families').findOne({
    email: emailFilter,
    ...(exclude?.type === 'family' ? { id: { $ne: exclude.id } } : {}),
  })

  if (family) {
    return { type: 'family' as const, account: stripMongoId(family) as Family } satisfies AuthEmailOwner
  }

  return null
}
