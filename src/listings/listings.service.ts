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
  parseOlxPrice,
  parsePubli24Price,
  parseImobiliarePrice,
  type OlxScrapedItem,
  type StoriaScrapedItem,
  type Publi24ScrapedItem,
  type ImobiliareScrapedItem,
} from './listings-mapper';
import { PrismaService } from '../prisma/prisma.service';

// 30 mins
const cacheTime = 30 * 60 * 1000;

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

  private numBound(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  private itemPrice(
    item: OlxScrapedItem | StoriaScrapedItem | Publi24ScrapedItem | ImobiliareScrapedItem,
    source: keyof ListingsPayload,
  ): number | null {
    if (source === 'olx')
      return parseOlxPrice((item as OlxScrapedItem).price).value;
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

  /** base64url(JSON) — use for /renting/:id; decode with JSON.parse(Buffer.from(id,'base64url')) */
  private listingId(source: string, externalId: string) {
    return Buffer.from(JSON.stringify({ source, externalId }), 'utf8').toString('base64url');
  }

  private withIds(payload: ListingsPayload, city: string) {
    return {
      olx: payload.olx.map((item) => {
        const { externalId } = mapOlxToListing(item, city);
        return { ...item, source: 'olx' as const, externalId, id: this.listingId('olx', externalId) };
      }),
      storia: payload.storia.map((item) => {
        const { externalId } = mapStoriaToListing(item, city);
        return { ...item, source: 'storia' as const, externalId, id: this.listingId('storia', externalId) };
      }),
      publi24: payload.publi24.map((item) => {
        const { externalId } = mapPubli24ToListing(item, city);
        return { ...item, source: 'publi24' as const, externalId, id: this.listingId('publi24', externalId) };
      }),
      imobiliare: payload.imobiliare.map((item) => {
        const { externalId } = mapImobiliareToListing(item, city);
        return { ...item, source: 'imobiliare' as const, externalId, id: this.listingId('imobiliare', externalId) };
      }),
    };
  }

  private filterByPrice(listings: ListingsPayload, minPrice: number, maxPrice: number): ListingsPayload {
    const inRange = (priceOfListing: number | null) =>
      priceOfListing == null || (priceOfListing >= minPrice && priceOfListing <= maxPrice);
    return {
      olx: listings.olx.filter((listing) => inRange(this.itemPrice(listing, 'olx'))),
      storia: listings.storia.filter((listing) => inRange(this.itemPrice(listing, 'storia'))),
      publi24: listings.publi24.filter((listing) => inRange(this.itemPrice(listing, 'publi24'))),
      imobiliare: listings.imobiliare.filter((listing) => inRange(this.itemPrice(listing, 'imobiliare'))),
    };
  }

  async getAllListings(
    city: string,
    forma?: string,
    minPrice?: number | string,
    maxPrice?: number | string,
  ) {
    const searchCity = city.trim().toLowerCase();
    const formaKey = forma ?? '';

    let minP = this.numBound(minPrice, 0);
    let maxP = this.numBound(maxPrice, 9_999_999);
    if (minP > maxP) [minP, maxP] = [maxP, minP];

    const cached = await this.prisma.listingScrapeCache.findUnique({
      where: { searchCity_forma: { searchCity, forma: formaKey } },
    });
    if (cached && Date.now() - cached.scrapedAt.getTime() < cacheTime) {
      const filtered = this.filterByPrice(cached.payload as ListingsPayload, minP, maxP);
      return this.withIds(filtered, city);
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

    const filtered = this.filterByPrice(payload, minP, maxP);
    return this.withIds(filtered, city);
  }
}
