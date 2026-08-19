'use client'

import { useEffect, useState } from 'react'
import type { PackageKey, PackagesSettings, SiteAssets } from '@/lib/admin/settings-schema'

/** Fetch pengaturan paket (label, kategori, dll) dari /api/settings/packages sekali saat mount. */
export function usePackagesSettings() {
  const [packages, setPackages] = useState<PackagesSettings | null>(null)

  useEffect(() => {
    fetch('/api/settings/packages')
      .then((r) => (r.ok ? r.json() : null))
      .then(setPackages)
      .catch(() => undefined)
  }, [])

  return packages
}

/** Fetch hero image & logo header/footer dari /api/settings/site-assets sekali saat mount. */
export function useSiteAssets() {
  const [siteAssets, setSiteAssets] = useState<SiteAssets | null>(null)

  useEffect(() => {
    fetch('/api/settings/site-assets')
      .then((r) => (r.ok ? r.json() : null))
      .then(setSiteAssets)
      .catch(() => undefined)
  }, [])

  return siteAssets
}

/** Nama paket untuk ditampilkan (dari admin, fallback ke nama default). */
export function resolvePackageLabel(packages: PackagesSettings | null, pkg: PackageKey) {
  const defaults: Record<PackageKey, string> = {
    community: 'Community Package',
    family: 'Bro & Sist Package',
    individual: 'Individu',
    pacer: 'Pacer',
    umkm: 'Tenant UMKM',
  }
  return packages?.[pkg]?.label || defaults[pkg]
}

/**
 * Label kategori yang ramah-tampil (dari admin), dicocokkan lewat `value` kategori tersimpan.
 *
 * Kalau admin mengganti `value` kategori itu sendiri (bukan cuma harga/label) setelah seseorang
 * terlanjur mendaftar, `value` lama jadi tidak ketemu di daftar kategori terkini. Untuk kasus itu,
 * `priceHint` (harga aktual yang dibayar/ditagih — sudah dihitung benar di pemanggil) dipakai untuk
 * mencocokkan ulang lewat harga, supaya label yang tampil tetap sinkron dengan kategori admin saat ini.
 * Baru kalau keduanya gagal, tampilkan nilai kategori mentah apa adanya.
 */
export function resolveCategoryLabel(
  packages: PackagesSettings | null,
  pkg: PackageKey,
  categoryValue: string | null | undefined,
  priceHint?: number
) {
  const categories = packages?.[pkg]?.periods.flatMap((period) => period.categories)
  const byValue = categoryValue ? categories?.find((c) => c.value === categoryValue) : undefined
  if (byValue) return byValue.label

  if (typeof priceHint === 'number') {
    const byPrice = categories?.find((c) => c.price === priceHint)
    if (byPrice) return byPrice.label
  }

  return categoryValue || null
}
