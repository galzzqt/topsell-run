import { NextResponse } from 'next/server'

const API_KEY = '912e766e3c6c9bde293528ae6bba27df40b903f936ccecaa8e9545016cc28925'
const BASE_URL = 'https://api.binderbyte.com/wilayah'

export async function GET() {
  try {
    console.log('[Debug] Testing Binderbyte API connection...')
    
    const url = `${BASE_URL}/provinsi?api_key=${API_KEY}`
    console.log('[Debug] URL:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    })
    
    console.log('[Debug] HTTP Status:', response.status)
    console.log('[Debug] Headers:', Object.fromEntries(response.headers.entries()))
    
    const text = await response.text()
    console.log('[Debug] Response Body (first 1000 chars):', text.substring(0, 1000))
    
    let data
    try {
      data = JSON.parse(text)
      console.log('[Debug] Parsed JSON successfully')
    } catch (e) {
      console.log('[Debug] Failed to parse JSON:', e)
      data = { raw: text.substring(0, 500) }
    }
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      raw: text.substring(0, 500),
    })
  } catch (error) {
    console.error('[Debug] Error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
