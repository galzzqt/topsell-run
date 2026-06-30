function waitForFbq(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      resolve()
      return
    }

    const maxAttempts = 50
    let attempts = 0

    const checkInterval = setInterval(() => {
      attempts++
      if (typeof window !== 'undefined' && (window as any).fbq) {
        clearInterval(checkInterval)
        resolve()
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        resolve() // Resolve anyway to not block
      }
    }, 100)
  })
}

export async function trackMetaPixelEvent(eventName: string, data?: Record<string, any>) {
  await waitForFbq()
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, data)
  }
}

export async function trackMetaPixelPurchase(amount: number, currency: string = 'IDR', options?: Record<string, any>) {
  await trackMetaPixelEvent('Purchase', {
    value: amount,
    currency,
    ...options
  })
}
