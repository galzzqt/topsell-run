import { fetchBinderbyte } from '@/lib/location/binderbyte'

export async function GET() {
  return fetchBinderbyte('provinsi')
}
