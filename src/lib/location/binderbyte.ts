import { NextResponse } from 'next/server'

// Wilayah.id API Wilayah Indonesia (free static JSON hosting based on Kemendagri codes)
// Source: https://wilayah.id
const BASE_URL = 'https://wilayah.id/api'

export function validateLocationId(value: string | null, name: string) {
  if (!value) {
    return { error: NextResponse.json({ error: `${name} parameter is required` }, { status: 400 }) }
  }

  // Allow digits and dots (Kemendagri format, e.g. "52.03")
  if (!/^[0-9.]+$/.test(value)) {
    return { error: NextResponse.json({ error: `${name} parameter is invalid` }, { status: 400 }) }
  }

  return { value }
}

/**
 * Fetch location data from Wilayah.id's static API.
 *
 * Endpoints:
 * - provinces:  GET /api/provinces.json              → { data: [{ code, name }] }
 * - regencies:  GET /api/regencies/{provinceId}.json → { data: [{ code, name }] }
 * - districts:  GET /api/districts/{regencyId}.json  → { data: [{ code, name }] }
 *
 * Returns normalized array of [{ id, name }] for backward compatibility.
 */
export async function fetchLocationData(path: string) {
  const url = `${BASE_URL}/${path}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 }, // Cache for 24 hours
    })

    if (!response.ok) {
      console.error('[Location API] Upstream error:', response.status, 'for', path)
      return NextResponse.json([])
    }

    const text = await response.text()
    if (!text || text.trim().length === 0) {
      console.error('[Location API] Empty response body from upstream')
      return NextResponse.json([])
    }

    try {
      const parsed = JSON.parse(text)
      
      // Wilayah.id wraps array in a "data" property: { data: [...] }
      const items = Array.isArray(parsed) ? parsed : (parsed.data || [])

      // Map { code, name } to standard { id, name } format expected by other modules
      const normalized = items.map((item: { code?: string; id?: string; name?: string }) => ({
        id: item.code ?? item.id ?? '',
        name: item.name ?? '',
      }))

      return NextResponse.json(normalized)
    } catch (e) {
      console.error('[Location API] Invalid JSON from upstream:', text.slice(0, 200), e)
      return NextResponse.json([])
    }
  } catch (error) {
    console.error('[Location API] Fetch error:', error)
    return NextResponse.json([])
  }
}
