import 'server-only'

import { Axiom } from '@axiomhq/js'

export type AdminLogEvent = {
  level: 'info' | 'warning' | 'error'
  source: string
  event: string
  message: string
  actor?: {
    id: string
    username: string
    name: string
    role: 'superadmin' | 'admin'
  }
  data?: Record<string, unknown>
}

function getAxiomConfig() {
  const token = process.env.AXIOM_TOKEN || ''
  const dataset = process.env.AXIOM_DATASET || ''
  const orgId = process.env.AXIOM_ORG_ID || undefined
  return { token, dataset, orgId }
}

export async function ingestAdminLog(event: AdminLogEvent) {
  const { token, dataset, orgId } = getAxiomConfig()
  if (!token || !dataset) return

  try {
    const axiom = new Axiom({ token, orgId })
    axiom.ingest(dataset, {
      _time: new Date().toISOString(),
      level: event.level,
      source: event.source,
      event: event.event,
      message: event.message,
      actor: event.actor,
      ...(event.data ? { data: event.data } : {}),
    })
    await axiom.flush()
  } catch {
    // Never block the user flow because of logging failures.
  }
}
