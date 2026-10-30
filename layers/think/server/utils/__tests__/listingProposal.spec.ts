import { describe, expect, it } from 'vitest'
import { checkProposal, type CatalogueProduct, type ListingProposal } from '../listingProposal'

const product: CatalogueProduct = {
  ref: '455',
  title: 'BA 455',
  description: '',
  price: 35000,
  currency: 'NGN',
  categories: ['Abaya'],
  city: 'Ibadan',
  imageUrls: [],
}
const allowed = ['Abaya', 'Gowns']
const good: ListingProposal = {
  title: 'Dubai abaya, black with stone work, BA 455',
  category: 'Abaya',
  description: 'A black abaya.',
  uses: [],
  searchPhrases: [],
  askSeller: [],
  flags: [],
  confidence: 'high',
  reason: '',
}

describe('checkProposal', () => {
  it('accepts a good proposal', () => {
    expect(checkProposal(product, good, allowed)).toEqual([])
  })

  it('accepts the stock code written without the space', () => {
    expect(checkProposal(product, { ...good, title: 'Dubai abaya, BA455' }, allowed)).toEqual([])
  })

  it('rejects a dropped stock code, an unknown category, a price and a long title', () => {
    const problems = checkProposal(
      product,
      { ...good, title: `Black abaya ₦35,000 ${'x'.repeat(70)}`, category: 'Abayas' },
      allowed,
    )
    expect(problems).toEqual([
      'title over 70 chars',
      'unknown category "Abayas"',
      'dropped stock code BA 455',
      'price in title',
    ])
  })
})
