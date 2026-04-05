import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { OlxScraper } from 'src/scrapers/olx.scraper';
import { StoriaScrapper } from 'src/scrapers/storia.scraper';
import { Publi24Scraper } from 'src/scrapers/publi24.scraper';
import { FacebookScraper } from 'src/scrapers/facebook.scraper';
import { ImobiliareRoScraper } from 'src/scrapers/imobiliare.scraper';

@Module({
  providers: [ListingsService, OlxScraper, StoriaScrapper, Publi24Scraper, FacebookScraper, ImobiliareRoScraper],
  controllers: [ListingsController],
})
export class ListingsModule {}
