import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ListingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findScrapeCache(searchCity: string, forma: string, minRoms: number) {
    return this.prisma.listingScrapeCache.findUnique({
      where: { searchCity_forma_minRoms: { searchCity, forma, minRoms } },
    });
  }

  upsertScrapeCache(
    searchCity: string,
    forma: string,
    minRoms: number,
    payload: Prisma.InputJsonValue,
  ) {
    return this.prisma.listingScrapeCache.upsert({
      where: { searchCity_forma_minRoms: { searchCity, forma, minRoms } },
      create: { searchCity, forma, minRoms, payload },
      update: { scrapedAt: new Date(), payload },
    });
  }

  createManyListings(data: Prisma.ListingCreateManyInput[]) {
    return this.prisma.listing.createMany({ data, skipDuplicates: true });
  }

  async getIdMapByExternalIds(externalIds: string[]): Promise<Map<string, string>> {
    if (!externalIds.length) return new Map();
    const rows = await this.prisma.listing.findMany({
      where: { externalId: { in: externalIds } },
      select: { id: true, externalId: true },
    });
    return new Map(rows.map((r) => [r.externalId, r.id]));
  }
}
