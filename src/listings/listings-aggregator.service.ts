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
  ) { }

  /**
   * Runs all scrapers in parallel. Uses allSettled so one failing scraper does not drop the rest.
   * If every Puppeteer source returns empty while we often have data on refresh (cold start),
   * runs one full retry after a short delay.
   */
  async fetchAll(city: string, forma?: string, minRoms?: number): Promise<ListingsPayload> {
    let payload = await this.fetchAllOnce(city, forma, minRoms);
    const puppeteerTotal =
      payload.olx.length + payload.storia.length + payload.publi24.length;

    const countAll = (p: ListingsPayload) =>
      p.olx.length + p.storia.length + p.publi24.length + p.imobiliare.length;

    /** Cold Puppeteer often returns nothing or a handful while Imobiliare (HTTP) is fine. */
    const likelyColdPartial =
      puppeteerTotal > 0 &&
      puppeteerTotal < 8 &&
      payload.imobiliare.length >= 15;

    if (puppeteerTotal === 0 || likelyColdPartial) {
      await new Promise((r) => setTimeout(r, 3500));
      const retry = await this.fetchAllOnce(city, forma, minRoms);
      if (countAll(retry) > countAll(payload)) payload = retry;
    }

    return payload;
  }

  private async fetchAllOnce(
    city: string,
    forma?: string,
    minRoms?: number,
  ): Promise<ListingsPayload> {
    const settled = await Promise.allSettled([
      this.olxScraper.scrape(city, forma, minRoms),
      this.storiaScrapper.scrape(city, forma, minRoms),
      this.publi24Scraper.scrape(city, forma, minRoms),
      this.imobiliareRoScraper.scrape(city, forma, minRoms),
    ]);

    const names = ['olx', 'storia', 'publi24', 'imobiliare'] as const;
    const empty: ListingsPayload = { olx: [], storia: [], publi24: [], imobiliare: [] };

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === 'rejected') {
        console.error(`ListingsAggregator: ${names[i]} failed —`, r.reason);
      }
    }

    const olx =
      settled[0].status === 'fulfilled' ? settled[0].value : empty.olx;
    const storia =
      settled[1].status === 'fulfilled' ? settled[1].value : empty.storia;
    const publi24 =
      settled[2].status === 'fulfilled' ? settled[2].value : empty.publi24;
    const imobiliare =
      settled[3].status === 'fulfilled' ? settled[3].value : empty.imobiliare;

    return {
      olx: olx as OlxScrapedItem[],
      storia: storia as StoriaScrapedItem[],
      publi24: publi24 as Publi24ScrapedItem[],
      imobiliare: imobiliare as ImobiliareScrapedItem[],
    };
  }
}
