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
import type { ListingsPayload } from './listings.types';

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
  toCreateManyInput(payload: ListingsPayload, city: string): Prisma.ListingCreateManyInput[] {
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
      ...payload.imobiliare.map((i) => mapImobiliareToListing(i, city).externalId),
    ];
  }

  enrichPayload(payload: ListingsPayload, city: string, prisma: Map<string, string>) {
    const rows = [
      ...this.enrich(payload.olx, city, 'olx', mapOlxToListing, prisma),
      ...this.enrich(payload.storia, city, 'storia', mapStoriaToListing, prisma),
      ...this.enrich(payload.publi24, city, 'publi24', mapPubli24ToListing, prisma),
      ...this.enrich(payload.imobiliare, city, 'imobiliare', mapImobiliareToListing, prisma),
    ];

    const rowsWithDateParsed =  rows.map((row) => {
      if (!('date' in row) || typeof row.date !== 'string' || !row.date) return row;

      let parsed: Date | null = null;
      if (row.source === 'olx') parsed = parseOlxDate(row.date);
      else if (row.source === 'publi24') parsed = parsePubli24Date(row.date);
      else if (row.source === 'storia') parsed = parseStoriaDate(row.date);
      else return row;

      if (!parsed || Number.isNaN(parsed.getTime())) return row;
      return { ...row, date: parsed.toISOString() };
    });

    return rowsWithDateParsed.sort((a, b) => {
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
  }

  private enrich<T>(
    items: T[],
    city: string,
    source: 'olx' | 'storia' | 'publi24' | 'imobiliare',
    map: (item: T, city: string) => { externalId: string; url: string | null },
    prisma: Map<string, string>,
  ) {
    return items.map((item) => {
      const m = map(item, city);
      return {
        ...item,
        source,
        url: m.url,
        prismaId: prisma.get(m.externalId) ?? null,
      };
    });
  }
}
