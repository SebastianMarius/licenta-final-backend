// ---------------------------------------------------------------------------
// Shared date helpers
// ---------------------------------------------------------------------------

const RO_MONTHS: Record<string, number> = {
  ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5,
  iulie: 6, august: 7, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
};

/**
 * Parse OLX date strings:
 *   "03 aprilie 2026"
 *   "Reactualizat la 03 aprilie 2026"
 *   "Azi la 09:23"
 *   "Ieri la 10:00"
 */
export function parseOlxDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const stripped = raw.replace(/^reactualizat\s+(?:la\s+)?/i, '').trim();
  const s = stripped.toLowerCase();

  const timeM = s.match(/(\d{1,2}):(\d{2})/);
  const h = timeM ? Number(timeM[1]) : 0;
  const min = timeM ? Number(timeM[2]) : 0;

  if (s.startsWith('azi')) {
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return d;
  }
  if (s.startsWith('ieri')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(h, min, 0, 0);
    return d;
  }

  const m = stripped.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
  if (!m) return null;
  const month = RO_MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(m[3]), month, Number(m[1]));
}

/**
 * Parse Publi24 date strings:
 *   "azi 08:32" / "Azi la 09:23"  → today at that time
 *   "ieri 10:00" / "Ieri la 10:00" → yesterday at that time
 *   "3 aprilie"                    → 3rd of that month, current year
 *   "23 martie 2026"               → absolute date (optional time suffix)
 */
export function parsePubli24Date(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const timeM = s.match(/(\d{1,2}):(\d{2})/);
  const h = timeM ? Number(timeM[1]) : 0;
  const min = timeM ? Number(timeM[2]) : 0;

  if (s.startsWith('azi')) {
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return d;
  }
  if (s.startsWith('ieri')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(h, min, 0, 0);
    return d;
  }
  // "23 martie 2026" — with explicit year
  const withYear = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (withYear) {
    const month = RO_MONTHS[withYear[2]];
    if (month !== undefined) return new Date(Number(withYear[3]), month, Number(withYear[1]), h, min);
  }
  // "3 aprilie" — day + month only, assume current year
  const noYear = s.match(/^(\d{1,2})\s+(\w+)$/);
  if (noYear) {
    const month = RO_MONTHS[noYear[2]];
    if (month !== undefined) return new Date(new Date().getFullYear(), month, Number(noYear[1]));
  }
  return null;
}

/**
 * Parse Storia ISO-like dates: "2026-04-05 16:56:42" or "2026-02-08T18:06:46Z".
 */
export function parseStoriaDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.trim().replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

// --- OLX ---

export type OlxScrapedItem = {
  index?: number;
  title: string | null;
  price: string | null;
  location?: string;
  date?: string;
  link?: string;
  image?: string | null;
  squareMeters?: number | null;
};

export function parseOlxPrice(price: string | null | undefined): {
  value: number | null;
  currency: string;
} {
  if (!price) return { value: null, currency: 'RON' };
  const currency = /EUR|€/i.test(price) ? 'EUR' : 'RON';
  const num = parseFloat(
    price.replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(',', '.'),
  );
  return { value: Number.isNaN(num) ? null : num, currency };
}

export function mapOlxToListing(item: OlxScrapedItem, city: string) {
  const { value: price, currency } = parseOlxPrice(item.price);
  return {
    externalId: item.link ?? `olx-${city}-${(item.title ?? '').slice(0, 50)}`,
    source: 'olx',
    title: (item.title ?? 'Unknown').replace(/\n+/g, ' ').trim().slice(0, 500),
    description: null as string | null,
    url: item.link ?? null,
    price: price != null ? String(price) : undefined,
    currency,
    city: item.location ?? city,
    address: item.location ?? null,
    areaSqm: item.squareMeters != null ? String(item.squareMeters) : undefined,
    imageUrls: item.image ? [item.image] : [],
    rawPayload: item as object,
    createdAt: parseOlxDate(item.date) ?? null,
    updatedAt: null,
  };
}

// --- Publi24 ---

export type Publi24ScrapedItem = {
  index?: number;
  title: string | null;
  link?: string | null;
  price?: string | null;
  location?: string | null;
  image?: string | null;
  squareMeters?: number | null;
  date?: string | null;
};

export function parsePubli24Price(price: string | null | undefined): {
  value: number | null;
  currency: string;
} {
  if (!price) return { value: null, currency: 'RON' };
  const currency = /EUR/i.test(price) ? 'EUR' : 'RON';
  const num = parseFloat(
    price.replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(',', '.'),
  );
  return { value: Number.isNaN(num) ? null : num, currency };
}

export function mapPubli24ToListing(item: Publi24ScrapedItem, city: string) {
  const { value: price, currency } = parsePubli24Price(item.price);
  return {
    externalId: item.link ?? `publi24-${city}-${(item.title ?? '').slice(0, 50)}`,
    source: 'publi24',
    title: (item.title ?? 'Unknown').replace(/\n+/g, ' ').trim().slice(0, 500),
    description: null as string | null,
    url: item.link ?? null,
    price: price != null ? String(price) : undefined,
    currency,
    city: item.location ?? city,
    address: item.location ?? null,
    areaSqm: item.squareMeters != null ? String(item.squareMeters) : undefined,
    imageUrls: item.image ? [item.image] : [],
    rawPayload: item as object,
    createdAt: parsePubli24Date(item.date) ?? null,
    updatedAt: null,
  };
}

// --- Imobiliare.ro ---

export type ImobiliareScrapedItem = {
  externalId: string | null;
  title: string | null;
  price: string | null;
  currency: string | null;
  city: string | null;
  /** e.g. "Judetul Cluj Cluj-Napoca Zorilor" */
  locationId: string | null;
  /** Raw string from data-surface, e.g. "68" or "not applicable" */
  surface: string | null;
  listId: string | null;
  sellerType: string | null;
  url: string | null;
  imageUrls: string[];
};

export function parseImobiliarePrice(price: string | null | undefined): {
  value: number | null;
  currency: string;
} {
  if (!price) return { value: null, currency: 'EUR' };
  const num = parseFloat(price.replace(/\s/g, '').replace(',', '.'));
  return { value: Number.isNaN(num) ? null : num, currency: 'EUR' };
}

export function mapImobiliareToListing(item: ImobiliareScrapedItem, cityParam: string) {
  const { value: price } = parseImobiliarePrice(item.price);
  // Currency comes directly from the card (usually EUR on imobiliare.ro)
  const currency = item.currency ?? 'EUR';

  // Prefer the structured city from the data attribute; fall back to the
  // query city so the field is never empty.
  const city = item.city ?? cityParam;

  // Parse sqm – the site stores "not applicable" when unknown
  let areaSqm: string | undefined;
  if (item.surface && item.surface !== 'not applicable') {
    const sqm = parseFloat(item.surface);
    if (!Number.isNaN(sqm) && sqm > 0) areaSqm = String(sqm);
  }

  return {
    externalId: item.externalId ?? `imobiliare-${cityParam}-${(item.title ?? '').slice(0, 50)}`,
    source: 'imobiliare',
    title: (item.title ?? 'Unknown').replace(/\n+/g, ' ').trim().slice(0, 500),
    description: null as string | null,
    url: item.url ?? null,
    price: price != null ? String(price) : undefined,
    currency,
    city,
    address: item.locationId ?? city,
    areaSqm,
    imageUrls: item.imageUrls ?? [],
    rawPayload: item as object,
    createdAt: null,
    updatedAt: null,
  };
}

// --- Storia ---

export type StoriaScrapedItem = {
  id?: string | number;
  title?: string | null;
  location?: unknown;
  images?: unknown;
  isPrivateOwner?: boolean;
  totalPrice?: { value?: number; currency?: string } | number | string | null;
  areaInSquareMeters?: number | null;
  shortDescription?: string | null;
  slug?: string | null;
  /** ISO-8601 string: when the listing was last updated/re-listed on Storia */
  dateCreated?: string | null;
  /** ISO-8601 string: when the listing was first published on Storia */
  createdAtFirst?: string | null;
};

export function mapStoriaToListing(item: StoriaScrapedItem, cityParam: string) {
  const loc = item.location as any;
  const city: string =
    loc?.reverseGeocoding?.locations?.find(
      (x: any) => x.locationLevel === 'county_capital',
    )?.name ??
    loc?.address?.city?.name ??
    cityParam;

  const totalPrice = item.totalPrice as any;
  const price: number | null =
    typeof totalPrice === 'object' && totalPrice != null
      ? (totalPrice.value ?? null)
      : typeof totalPrice === 'number'
        ? totalPrice
        : null;
  const currency: string =
    typeof totalPrice === 'object' && totalPrice != null
      ? (totalPrice.currency ?? 'RON')
      : 'RON';

  const images = Array.isArray(item.images)
    ? (item.images as any[])
        .map((img) => img.large ?? img.medium ?? img.url)
        .filter((u): u is string => typeof u === 'string')
    : [];

  const slug = item.slug?.trim();
  return {
    externalId: item.id != null ? String(item.id) : `storia-${cityParam}`,
    source: 'storia',
    title: (item.title ?? 'Unknown').replace(/\n+/g, ' ').trim().slice(0, 500),
    description: item.shortDescription?.trim() ?? null,
    url: slug ? `https://www.storia.ro/ro/oferta/${slug.replace(/^\//, '')}` : null,
    price: price != null ? String(price) : undefined,
    currency,
    city,
    address: city,
    areaSqm: item.areaInSquareMeters != null ? String(item.areaInSquareMeters) : undefined,
    imageUrls: images,
    rawPayload: item as object,
    createdAt: parseStoriaDate(item.createdAtFirst ?? item.dateCreated) ?? null,
    updatedAt: parseStoriaDate(item.dateCreated) ?? null,
  };
}
