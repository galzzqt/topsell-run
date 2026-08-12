import { fetchLocationData, validateLocationId } from '@/lib/location/binderbyte'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kotaId = validateLocationId(searchParams.get('id_kabupaten'), 'id_kabupaten')

  if (kotaId.error) return kotaId.error

  return fetchLocationData(`districts/${kotaId.value}.json`)
}
