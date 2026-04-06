const parseRoMonth: Record<string, number> = {
  ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5,
  iulie: 6, august: 7, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
};

export function parseOlxDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const stripped = raw.replace(/^reactualizat\s+(?:la\s+)?/i, '').trim();
  const cleanedDate = stripped.toLowerCase();

  const timeMatch = cleanedDate.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const min = timeMatch ? Number(timeMatch[2]) : 0;

  if (cleanedDate.startsWith('azi')) {
    const date = new Date();
    date.setHours(hour, min, 0, 0);
    return date;
  }
  if (cleanedDate.startsWith('ieri')) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(hour, min, 0, 0);
    return date;
  }

  const match = stripped.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
  if (!match) return null;
  const month = parseRoMonth[match[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(match[3]), month, Number(match[1]));
}

export function parsePubli24Date(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const stripped = raw.trim().toLowerCase();
  const timeMatch = stripped.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const min = timeMatch ? Number(timeMatch[2]) : 0;

  if (stripped.startsWith('azi')) {
    const date = new Date();
    date.setHours(hour, min, 0, 0);
    return date;
  }
  if (stripped.startsWith('ieri')) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(hour, min, 0, 0);
    return date;
  }

  const withYear = stripped.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (withYear) {
    const month = parseRoMonth[withYear[2]];
    if (month !== undefined) return new Date(Number(withYear[3]), month, Number(withYear[1]), hour, min);
  }

  const noYear = stripped.match(/^(\d{1,2})\s+(\w+)$/);
  if (noYear) {
    const month = parseRoMonth[noYear[2]];
    if (month !== undefined) return new Date(new Date().getFullYear(), month, Number(noYear[1]));
  }
  return null;
}


export function parseStoriaDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw.trim().replace(' ', 'T'));
  return isNaN(date.getTime()) ? null : date;
}

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

export type ImobiliareScrapedItem = {
  externalId: string | null;
  title: string | null;
  price: string | null;
  currency: string | null;
  city: string | null;
  locationId: string | null;
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
  const currency = item.currency ?? 'EUR';

  const city = item.city ?? cityParam;

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
  dateCreated?: string | null;
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
