import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  mapOlxToListing,
  mapStoriaToListing,
  mapPubli24ToListing,
  mapImobiliareToListing,
} from './listings-mapper';
import type { ListingsPayload } from './listings.types';

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
    return [
      ...this.enrich(payload.olx, city, 'olx', mapOlxToListing, prisma),
      ...this.enrich(payload.storia, city, 'storia', mapStoriaToListing, prisma),
      ...this.enrich(payload.publi24, city, 'publi24', mapPubli24ToListing, prisma),
      ...this.enrich(payload.imobiliare, city, 'imobiliare', mapImobiliareToListing, prisma),
    ];
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
