import { NextResponse } from 'next/server'
import { fetchBinderbyte } from '@/lib/location/binderbyte'

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const debugToken = process.env.LOCATION_DEBUG_TOKEN
  const incomingToken = request.headers.get('x-debug-token')
  if (debugToken && incomingToken !== debugToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return fetchBinderbyte('provinsi')
}
