import { NextResponse } from 'next/server'

const API_KEY = '912e766e3c6c9bde293528ae6bba27df40b903f936ccecaa8e9545016cc28925'
const BASE_URL = 'https://api.binderbyte.com/wilayah'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const kotaId = searchParams.get('id_kabupaten')

    if (!kotaId) {
      return NextResponse.json(
        { error: 'id_kabupaten parameter is required' },
        { status: 400 }
      )
    }

    const url = `${BASE_URL}/kecamatan?api_key=${API_KEY}&id_kabupaten=${kotaId}`
    console.log('[Location API] Fetching kecamatan from:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    const text = await response.text()
    console.log('[Location API] Response status:', response.status)
    console.log('[Location API] Response body:', text.substring(0, 500))

    if (!response.ok) {
      return NextResponse.json(
        { error: `API returned ${response.status}: ${text}` },
        { status: response.status }
      )
    }

    try {
      const data = JSON.parse(text)
      console.log('[Location API] Parsed kecamatan data, count:', data.value?.length || 0)
      return NextResponse.json(data)
    } catch (parseError) {
      console.error('[Location API] Failed to parse JSON:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse API response' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Location API] Error fetching kecamatan:', error)
    return NextResponse.json(
      { error: `Failed to fetch kecamatan: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
