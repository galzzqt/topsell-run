// Binderbyte Location API Service (via Next.js API Routes)
// This uses server-side API routes to avoid CORS issues

interface LocationOption {
  value: string
  label: string
}

interface RawProvinsiResponse {
  id: string
  name: string
}

interface RawKotaResponse extends RawProvinsiResponse {
  id_provinsi: string
}

interface RawKecamatanResponse extends RawProvinsiResponse {
  id_kabupaten: string
}

function normalizeLocationOptions<T extends { id?: string; name?: string; value?: string; label?: string }>(
  items: T[] | undefined
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

/**
 * Fetch all provinces from Binderbyte API
 */
export async function fetchProvinsi(): Promise<LocationOption[]> {
  try {
    console.log('[Location Client] Fetching provinsi from /api/location/provinsi')
    const response = await fetch('/api/location/provinsi', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    
    console.log('[Location Client] Response status:', response.status)
    
    if (!response.ok) {
      console.error('[Location Client] API returned error status:', response.status)
      return []
    }
    
    const data = await response.json()
    console.log('[Location Client] Parsed provinsi data, count:', data.value?.length || 0)
    
    if (!data.value || data.value.length === 0) {
      console.warn('[Location Client] No data returned from API')
      return []
    }
    
    return normalizeLocationOptions<RawProvinsiResponse>(data.value)
  } catch (error) {
    console.error('[Location Client] Error fetching provinsi:', error)
    return []
  }
}

/**
 * Fetch cities/regencies by province ID
 */
export async function fetchKota(provinsiId: string): Promise<LocationOption[]> {
  try {
    console.log('[Location Client] Fetching kota for provinsi:', provinsiId)
    const response = await fetch(
      `/api/location/kota?id_provinsi=${encodeURIComponent(provinsiId)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    )
    
    console.log('[Location Client] Response status:', response.status)
    
    if (!response.ok) {
      console.error('[Location Client] API returned error status:', response.status)
      return []
    }
    
    const data = await response.json()
    console.log('[Location Client] Parsed kota data, count:', data.value?.length || 0)
    return normalizeLocationOptions<RawKotaResponse>(data.value)
  } catch (error) {
    console.error('[Location Client] Error fetching kota:', error)
    return []
  }
}

/**
 * Fetch districts by city/regency ID
 */
export async function fetchKecamatan(kotaId: string): Promise<LocationOption[]> {
  try {
    console.log('[Location Client] Fetching kecamatan for kota:', kotaId)
    const response = await fetch(
      `/api/location/kecamatan?id_kabupaten=${encodeURIComponent(kotaId)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    )
    
    console.log('[Location Client] Response status:', response.status)
    
    if (!response.ok) {
      console.error('[Location Client] API returned error status:', response.status)
      return []
    }
    
    const data = await response.json()
    console.log('[Location Client] Parsed kecamatan data, count:', data.value?.length || 0)
    return normalizeLocationOptions<RawKecamatanResponse>(data.value)
  } catch (error) {
    console.error('[Location Client] Error fetching kecamatan:', error)
    return []
  }
}
