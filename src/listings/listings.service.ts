import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OlxScraper } from 'src/scrapers/olx.scraper';
import { StoriaScrapper } from 'src/scrapers/storia.scraper';
import { Publi24Scraper } from 'src/scrapers/publi24.scraper';
import { ImobiliareRoScraper } from 'src/scrapers/imobiliare.scraper';
import {
  mapOlxToListing,
  mapStoriaToListing,
  mapPubli24ToListing,
  mapImobiliareToListing,
  type OlxScrapedItem,
  type StoriaScrapedItem,
  type Publi24ScrapedItem,
  type ImobiliareScrapedItem,
} from './listings-mapper';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_MS = 30 * 60 * 1000;

type ListingsPayload = {
  olx: OlxScrapedItem[];
  storia: StoriaScrapedItem[];
  publi24: Publi24ScrapedItem[];
  imobiliare: ImobiliareScrapedItem[];
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly olxScraper: OlxScraper,
    private readonly storiaScrapper: StoriaScrapper,
    private readonly publi24Scraper: Publi24Scraper,
    private readonly imobiliareRoScraper: ImobiliareRoScraper,
  ) {}

  async getAllListings(city: string, forma?: string) {
    const searchCity = city.trim().toLowerCase();
    const formaKey = forma ?? '';

    const cached = await this.prisma.listingScrapeCache.findUnique({
      where: { searchCity_forma: { searchCity, forma: formaKey } },
    });
    if (cached && Date.now() - cached.scrapedAt.getTime() < CACHE_MS) {
      return cached.payload as ListingsPayload;
    }

    const [olx, storia, publi24, imobiliare] = await Promise.all([
      this.olxScraper.scrape(city, forma),
      this.storiaScrapper.scrape(city, forma),
      this.publi24Scraper.scrape(city, forma),
      this.imobiliareRoScraper.scrape(city, forma),
    ]);

    const payload: ListingsPayload = {
      olx: olx as OlxScrapedItem[],
      storia: storia as StoriaScrapedItem[],
      publi24: publi24 as Publi24ScrapedItem[],
      imobiliare: imobiliare as ImobiliareScrapedItem[],
    };

    const olxForDb = payload.olx.map((item) => mapOlxToListing(item, city));
    const storiaForDb = payload.storia.map((item) =>
      mapStoriaToListing(item, city),
    );
    const publi24ForDb = payload.publi24.map((item) =>
      mapPubli24ToListing(item, city),
    );
    const imobiliareForDb = payload.imobiliare.map((item) =>
      mapImobiliareToListing(item, city),
    );

    await this.prisma.listing.createMany({
      data: [...olxForDb, ...storiaForDb, ...publi24ForDb, ...imobiliareForDb],
      skipDuplicates: true,
    });

    const jsonPayload = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;

    await this.prisma.listingScrapeCache.upsert({
      where: { searchCity_forma: { searchCity, forma: formaKey } },
      create: { searchCity, forma: formaKey, payload: jsonPayload },
      update: { scrapedAt: new Date(), payload: jsonPayload },
    });

    return payload;
  }
}
