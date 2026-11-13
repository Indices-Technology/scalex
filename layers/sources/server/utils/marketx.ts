/** MarketX's public catalogue, read-only. Used to know which product pages belong to a store. */
const MARKETX = 'https://marketx.africa'

export async function storeProductSlugs(storeSlug: string): Promise<string[]> {
  const slugs: string[] = []
  for (let offset = 0; ; offset += 100) {
    const res = await fetch(`${MARKETX}/api/commerce/products?storeSlug=${encodeURIComponent(storeSlug)}&limit=100&offset=${offset}`)
    if (!res.ok) throw new Error(`MarketX products ${res.status}`)
    const body = await res.json()
    const page: { slug: string }[] = body.data?.products ?? body.products ?? []
    slugs.push(...page.map((p) => p.slug))
    if (page.length < 100) return slugs
  }
}
