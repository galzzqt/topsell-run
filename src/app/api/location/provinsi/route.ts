import { fetchLocationData } from '@/lib/location/binderbyte'

export const dynamic = 'force-dynamic'

export async function GET() {
  return fetchLocationData('provinces.json')
}
