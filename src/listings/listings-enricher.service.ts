import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  mapOlxToListing,
  mapStoriaToListing,
  mapPubli24ToListing,
  mapImobiliareToListing,
  parseOlxDate,
  parsePubli24Date,
  parseStoriaDate,
} from './listings-mapper';
import type { AdvertisementListingRow } from 'src/advertisements/advertisements.service';
import type { ListingsPayload } from './listings.types';

type EnrichedListingRow = {
  [key: string]: unknown;
  title?: string;
  price?: string | number | null;
  squareMeters?: number | null;
  source: 'olx' | 'storia' | 'publi24' | 'imobiliare' | 'user';
  url: string | null;
  prismaId: string | null;
  date?: string;
};

function listingDateMs(row: object): number | null {
  if (!('date' in row)) return null;
  const date = (row as { date?: unknown }).date;
  if (typeof date !== 'string' || !date) return null;
  const ms = new Date(date).getTime();
  return Number.isNaN(ms) ? null : ms;
}

@Injectable()
export class ListingsEnricher {
  /** Flat rows for `listing.createMany` — same mapping as pre-refactor. */
  toCreateManyInput(
    payload: ListingsPayload,
    city: string,
  ): Prisma.ListingCreateManyInput[] {
    return [
      ...payload.olx.map((i) => mapOlxToListing(i, city)),
      ...payload.storia.map((i) => mapStoriaToListing(i, city)),
      ...payload.publi24.map((i) => mapPubli24ToListing(i, city)),
      ...payload.imobiliare.map((i) => mapImobiliareToListing(i, city)),
    ];
  }

  /** All `externalId` values for the payload (order matches previous `prismaIdMap`). */
  externalIdsForPayload(payload: ListingsPayload, city: string): string[] {
    return [
      ...payload.olx.map((i) => mapOlxToListing(i, city).externalId),
      ...payload.storia.map((i) => mapStoriaToListing(i, city).externalId),
      ...payload.publi24.map((i) => mapPubli24ToListing(i, city).externalId),
      ...payload.imobiliare.map(
        (i) => mapImobiliareToListing(i, city).externalId,
      ),
    ];
  }

  enrichPayload(
    payload: ListingsPayload,
    city: string,
    prisma: Map<string, string>,
    sortingMethod: string = 'newest',
    rentSouce: string | undefined,
    extraRows: AdvertisementListingRow[] = [],
  ): EnrichedListingRow[] {
    const rows: EnrichedListingRow[] = [
      ...this.enrich(payload.olx, city, 'olx', mapOlxToListing, prisma),
      ...this.enrich(
        payload.storia,
        city,
        'storia',
        mapStoriaToListing,
        prisma,
      ),
      ...this.enrich(
        payload.publi24,
        city,
        'publi24',
        mapPubli24ToListing,
        prisma,
      ),
      ...this.enrich(
        payload.imobiliare,
        city,
        'imobiliare',
        mapImobiliareToListing,
        prisma,
      ),
      ...extraRows,
    ];

    const uniqueRows = Array.from(
      new Map(
        rows.map((item) => [
          `${item.title}-${item.price}-${item.squareMeters}`,
          item,
        ]),
      ).values(),
    );

    const filteredRows = rentSouce
      ? uniqueRows.filter((item) => item.source === rentSouce)
      : uniqueRows;

    const rowsWithDateParsed = filteredRows.map((row) => {
      if (!('date' in row) || typeof row.date !== 'string' || !row.date)
        return row;

      let parsed: Date | null = null;
      if (row.source === 'olx') parsed = parseOlxDate(row.date);
      else if (row.source === 'publi24') parsed = parsePubli24Date(row.date);
      else if (row.source === 'storia') parsed = parseStoriaDate(row.date);
      else return row;

      if (!parsed || Number.isNaN(parsed.getTime())) return row;
      return { ...row, date: parsed.toISOString() };
    });

    const sortByDate = () => {
      // console.log(rowsWithDateParsed)
      return [...rowsWithDateParsed].sort((a, b) => {
        const aTime = listingDateMs(a);
        const bTime = listingDateMs(b);

        // both missing → keep original order
        if (aTime === null && bTime === null) return 0;

        // missing date goes last
        if (aTime === null) return 1;
        if (bTime === null) return -1;

        // normal sort (newest first)
        return bTime - aTime;
      });
    };

    const sortByPrice = (option = 'price_asc') => {
      return [...rowsWithDateParsed].sort((a, b) => {
        const aPrice = Number(a.price);
        const bPrice = Number(b.price);

        const aInvalid = Number.isNaN(aPrice);
        const bInvalid = Number.isNaN(bPrice);
        // invalid goes last
        if (aInvalid) return 1;
        if (bInvalid) return -1;

        return option === 'price_asc' ? aPrice - bPrice : bPrice - aPrice;
      });
    };

    // squareMeters
    const sortByArea = () => {
      return [...rowsWithDateParsed].sort((a, b) => {
        const aSquareMeters = a.squareMeters ?? null;
        const bSquareMeters = b.squareMeters ?? null;

        if (aSquareMeters === null && bSquareMeters === null) return 0;
        if (aSquareMeters === null) return 1;
        if (bSquareMeters === null) return -1;

        return bSquareMeters - aSquareMeters;
      });
    };

    let sortedItems: EnrichedListingRow[];
    switch (sortingMethod) {
      case 'newest': {
        sortedItems = sortByDate();
        break;
      }
      case 'price_asc': {
        sortedItems = sortByPrice('price_asc');
        break;
      }
      case 'price_desc': {
        sortedItems = sortByPrice('price_desc');
        break;
      }
      case 'area': {
        sortedItems = sortByArea();
        break;
      }
      default: {
        sortedItems = sortByDate();
        break;
      }
    }

    return sortedItems;
  }

  private enrich<T>(
    items: T[],
    city: string,
    source: 'olx' | 'storia' | 'publi24' | 'imobiliare',
    map: (item: T, city: string) => { externalId: string; url: string | null },
    prisma: Map<string, string>,
  ): EnrichedListingRow[] {
    return items.map((item) => {
      const m = map(item, city);
      return {
        ...(item as Record<string, unknown>),
        source,
        url: m.url,
        prismaId: prisma.get(m.externalId) ?? null,
      };
    });
  }
}
