import {
  parseImobiliarePrice,
  parseOlxPrice,
  parsePubli24Price,
} from './listings-mapper';
import type {
  ImobiliareScrapedItem,
  ListingsPayload,
  OlxScrapedItem,
  Publi24ScrapedItem,
  StoriaScrapedItem,
} from './listings.types';

export function numBound(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function itemPrice(
  item: OlxScrapedItem | StoriaScrapedItem | Publi24ScrapedItem | ImobiliareScrapedItem,
  source: keyof ListingsPayload,
): number | null {
  if (source === 'olx') return parseOlxPrice((item as OlxScrapedItem).price).value;
  if (source === 'publi24') return parsePubli24Price((item as Publi24ScrapedItem).price).value;
  if (source === 'imobiliare')
    return parseImobiliarePrice((item as ImobiliareScrapedItem).price).value;
  const totalPrice = (item as StoriaScrapedItem).totalPrice as
    | { value?: number }
    | number
    | null
    | undefined;
  if (typeof totalPrice === 'object' && totalPrice != null) return totalPrice.value ?? null;
  if (typeof totalPrice === 'number') return totalPrice;
  return null;
}

export function filterListingsByPrice(
  listings: ListingsPayload,
  minPrice: number,
  maxPrice: number,
): ListingsPayload {
  const inRange = (priceOfListing: number | null) =>
    priceOfListing == null || (priceOfListing >= minPrice && priceOfListing <= maxPrice);
  return {
    olx: listings.olx.filter((listing) => inRange(itemPrice(listing, 'olx'))),
    storia: listings.storia.filter((listing) => inRange(itemPrice(listing, 'storia'))),
    publi24: listings.publi24.filter((listing) => inRange(itemPrice(listing, 'publi24'))),
    imobiliare: listings.imobiliare.filter((listing) =>
      inRange(itemPrice(listing, 'imobiliare')),
    ),
  };
}
