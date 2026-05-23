import { fetchBinderbyte, validateLocationId } from '@/lib/location/binderbyte'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kotaId = validateLocationId(searchParams.get('id_kabupaten'), 'id_kabupaten')

  if (kotaId.error) return kotaId.error

  return fetchBinderbyte('kecamatan', { id_kabupaten: kotaId.value })
}
