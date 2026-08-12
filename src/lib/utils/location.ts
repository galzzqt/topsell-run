// Location API Service (via Next.js API Routes)
// Backend: emsifa/api-wilayah-indonesia (static GitHub Pages, free, no API key)
// Response format: [{ id: string, name: string }, ...]

interface LocationOption {
  value: string
  label: string
}

function normalizeLocationOptions(
  items: Array<{ id?: string; name?: string; value?: string; label?: string }> | undefined
): LocationOption[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => ({
      value: item.value ?? item.id ?? '',
      label: item.label ?? item.name ?? '',
    }))
    .filter((item) => item.value && item.label)
}

async function fetchLocationJson(url: string): Promise<LocationOption[]> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      console.error('[Location Client] API returned error status:', response.status)
      return []
    }

    const text = await response.text()
    if (!text || text.trim().length === 0) {
      console.warn('[Location Client] Empty response body')
      return []
    }

    const data = JSON.parse(text)

    // Emsifa API returns a direct array: [{ id, name }, ...]
    // Binderbyte API returned: { value: [{ id, name }, ...] }
    // Handle both formats for backward compatibility
    const items = Array.isArray(data) ? data : data.value
    return normalizeLocationOptions(items)
  } catch (error) {
    console.error('[Location Client] Error fetching location:', error)
    return []
  }
}

/**
 * Fetch all provinces
 */
export async function fetchProvinsi(): Promise<LocationOption[]> {
  return fetchLocationJson('/api/location/provinsi')
}

/**
 * Fetch cities/regencies by province ID
 */
export async function fetchKota(provinsiId: string): Promise<LocationOption[]> {
  return fetchLocationJson(`/api/location/kota?id_provinsi=${encodeURIComponent(provinsiId)}`)
}

/**
 * Fetch districts by city/regency ID
 */
export async function fetchKecamatan(kotaId: string): Promise<LocationOption[]> {
  return fetchLocationJson(`/api/location/kecamatan?id_kabupaten=${encodeURIComponent(kotaId)}`)
}
