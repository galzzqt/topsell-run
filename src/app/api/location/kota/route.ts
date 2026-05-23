import { fetchBinderbyte, validateLocationId } from '@/lib/location/binderbyte'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provinsiId = validateLocationId(searchParams.get('id_provinsi'), 'id_provinsi')

  if (provinsiId.error) return provinsiId.error

  return fetchBinderbyte('kabupaten', { id_provinsi: provinsiId.value })
}
