import { Injectable } from '@nestjs/common';
import { OlxScraper } from 'src/scrapers/olx.scraper';
import { StoriaScrapper } from 'src/scrapers/storia.scraper';
import { Publi24Scraper } from 'src/scrapers/publi24.scraper';
import { ImobiliareRoScraper } from 'src/scrapers/imobiliare.scraper';
import type {
  ImobiliareScrapedItem,
  ListingsPayload,
  OlxScrapedItem,
  Publi24ScrapedItem,
  StoriaScrapedItem,
} from './listings.types';

@Injectable()
export class ListingsAggregator {
  constructor(
    private readonly olxScraper: OlxScraper,
    private readonly storiaScrapper: StoriaScrapper,
    private readonly publi24Scraper: Publi24Scraper,
    private readonly imobiliareRoScraper: ImobiliareRoScraper,
  ) {}

  /** Runs all scrapers in parallel; returns raw typed payload (same casts as before). */
  async fetchAll(city: string, forma?: string): Promise<ListingsPayload> {
    const [olx, storia, publi24, imobiliare] = await Promise.all([
      this.olxScraper.scrape(city, forma),
      this.storiaScrapper.scrape(city, forma),
      this.publi24Scraper.scrape(city, forma),
      this.imobiliareRoScraper.scrape(city, forma),
    ]);

    return {
      olx: olx as OlxScrapedItem[],
      storia: storia as StoriaScrapedItem[],
      publi24: publi24 as Publi24ScrapedItem[],
      imobiliare: imobiliare as ImobiliareScrapedItem[],
    };
  }
}
