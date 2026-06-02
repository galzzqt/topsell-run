import 'server-only'

import { Axiom } from '@axiomhq/js'

export type AdminLogEntry = {
  time: string
  level: string
  source: string
  message: string
  raw: Record<string, unknown>
}

export type AdminLogsResult = {
  logs: AdminLogEntry[]
  error: string | null
}

function getAxiomConfig() {
  const token = process.env.AXIOM_TOKEN || ''
  const dataset = process.env.AXIOM_DATASET || ''
  const orgId = process.env.AXIOM_ORG_ID || undefined
  return { token, dataset, orgId }
}

function toText(value: unknown, fallback = '-') {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export async function queryAdminLogs(limit = 100): Promise<AdminLogsResult> {
  const { token, dataset, orgId } = getAxiomConfig()
  if (!token || !dataset) {
    return {
      logs: [],
      error: 'Konfigurasi Axiom belum lengkap. Isi AXIOM_TOKEN dan AXIOM_DATASET di env.',
    }
  }

  try {
    const axiom = new Axiom({ token, orgId })
    const queryLimit = Math.min(Math.max(limit, 10), 200)
    const apl = `['${dataset}'] | order by _time desc | limit ${queryLimit}`
    // Axiom often defaults to a narrow time range if not provided.
    // For admin logs, show last 30 days by default so the table doesn't appear empty.
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - 30)
    const result = await axiom.query(apl, {
      format: 'tabular',
      noCache: true,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    })
    const table = result.tables[0]
    if (!table?.events) return { logs: [], error: null }

    const logs = Array.from(table.events()).map((entry) => {
      const time = toText(entry._time, new Date().toISOString())
      const level = toText(entry.level ?? entry.severity ?? entry.log_level, 'info')
      const source = toText(entry.source ?? entry.service ?? entry.component, 'app')
      const message = toText(entry.message ?? entry.msg ?? entry.event, '(tanpa pesan)')
      return {
        time,
        level,
        source,
        message,
        raw: entry,
      }
    })

    return { logs, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil log dari Axiom.'
    return { logs: [], error: message }
  }
}
