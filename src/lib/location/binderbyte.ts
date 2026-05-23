import { NextResponse } from 'next/server'

const BASE_URL = 'https://api.binderbyte.com/wilayah'

export function getBinderbyteApiKey() {
  return process.env.BINDERBYTE_API_KEY || ''
}

export function validateLocationId(value: string | null, name: string) {
  if (!value) {
    return { error: NextResponse.json({ error: `${name} parameter is required` }, { status: 400 }) }
  }

  if (!/^[0-9.]+$/.test(value)) {
    return { error: NextResponse.json({ error: `${name} parameter is invalid` }, { status: 400 }) }
  }

  return { value }
}

export async function fetchBinderbyte(path: string, params: Record<string, string> = {}) {
  const apiKey = getBinderbyteApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: 'Location API is not configured' }, { status: 500 })
  }

  const url = new URL(`${BASE_URL}/${path}`)
  url.searchParams.set('api_key', apiKey)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  const text = await response.text()
  if (!response.ok) {
    console.error('[Location API] Upstream error:', response.status, text.slice(0, 200))
    return NextResponse.json({ error: 'Failed to fetch location data' }, { status: response.status })
  }

  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    console.error('[Location API] Invalid JSON from upstream:', text.slice(0, 200))
    return NextResponse.json({ error: 'Invalid location API response' }, { status: 502 })
  }
}
