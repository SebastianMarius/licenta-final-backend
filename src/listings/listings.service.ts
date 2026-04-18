import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListingsAggregator } from './listings-aggregator.service';
import { ListingsEnricher } from './listings-enricher.service';
import { filterListingsByPrice, numBound } from './listings-filter';
import { ListingsRepository } from './listings-repository.service';
import { LISTINGS_CACHE_MS } from './listings.constants';
import type { ListingsPayload } from './listings.types';

@Injectable()
export class ListingsService {
  constructor(
    private readonly aggregator: ListingsAggregator,
    private readonly repository: ListingsRepository,
    private readonly enricher: ListingsEnricher,
  ) {}

  async getAllListings(
    city: string,
    forma?: string,
    minPrice?: number | string,
    maxPrice?: number | string,
    minRoms?: number | string,
  ) {
    const searchCity = city.trim().toLowerCase();
    const formaKey = forma ?? '';
    const roomsKey = Math.max(0, Math.floor(numBound(minRoms, 0)));

    let minP = numBound(minPrice, 0);
    let maxP = numBound(maxPrice, 9_999_999);
    if (minP > maxP) [minP, maxP] = [maxP, minP];

    const cached = await this.repository.findScrapeCache(searchCity, formaKey, roomsKey);
    if (cached && Date.now() - cached.scrapedAt.getTime() < LISTINGS_CACHE_MS) {
      const filtered = filterListingsByPrice(cached.payload as ListingsPayload, minP, maxP);
      const prismaMap = await this.repository.getIdMapByExternalIds(
        this.enricher.externalIdsForPayload(filtered, city),
      );
      return this.enricher.enrichPayload(filtered, city, prismaMap);
    }

    const payload = await this.aggregator.fetchAll(city, forma, roomsKey);

    await this.repository.createManyListings(this.enricher.toCreateManyInput(payload, city));

    const jsonPayload = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
    await this.repository.upsertScrapeCache(searchCity, formaKey, roomsKey, jsonPayload);

    const filtered = filterListingsByPrice(payload, minP, maxP);
    const prismaMap = await this.repository.getIdMapByExternalIds(
      this.enricher.externalIdsForPayload(filtered, city),
    );
    return this.enricher.enrichPayload(filtered, city, prismaMap);
  }
}
