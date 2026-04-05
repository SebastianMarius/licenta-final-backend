import { Injectable } from '@nestjs/common';
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
    const [olx, storia, publi24, imobiliare] = await Promise.all([
      this.olxScraper.scrape(city, forma),
      this.storiaScrapper.scrape(city, forma),
      this.publi24Scraper.scrape(city, forma),
      this.imobiliareRoScraper.scrape(city, forma),
    ]);

    const olxForDb = (olx as OlxScrapedItem[]).map((item) =>
      mapOlxToListing(item, city),
    );
    const storiaForDb = (storia as StoriaScrapedItem[]).map((item) =>
      mapStoriaToListing(item, city),
    );
    const publi24ForDb = (publi24 as Publi24ScrapedItem[]).map((item) =>
      mapPubli24ToListing(item, city),
    );
    const imobiliareForDb = (imobiliare as ImobiliareScrapedItem[]).map((item) =>
      mapImobiliareToListing(item, city),
    );

    await this.prisma.listing.createMany({
      data: [...olxForDb, ...storiaForDb, ...publi24ForDb, ...imobiliareForDb],
      skipDuplicates: true,
    });

    return { olx, storia, publi24, imobiliare };
  }
}
