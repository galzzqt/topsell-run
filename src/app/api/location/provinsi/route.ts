import { NextResponse } from 'next/server'

const API_KEY = '912e766e3c6c9bde293528ae6bba27df40b903f936ccecaa8e9545016cc28925'
const BASE_URL = 'https://api.binderbyte.com/wilayah'

export async function GET() {
  try {
    const url = `${BASE_URL}/provinsi?api_key=${API_KEY}`
    console.log('[Location API] Fetching provinsi from:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })
    
    const text = await response.text()
    console.log('[Location API] Response status:', response.status)
    console.log('[Location API] Response body:', text)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `API returned ${response.status}: ${text}` },
        { status: response.status }
      )
    }
    
    try {
      const data = JSON.parse(text)
      console.log('[Location API] Parsed data:', data)
      return NextResponse.json(data)
    } catch (parseError) {
      console.error('[Location API] Failed to parse JSON:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse API response' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Location API] Error fetching provinsi:', error)
    return NextResponse.json(
      { error: `Failed to fetch provinsi: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
