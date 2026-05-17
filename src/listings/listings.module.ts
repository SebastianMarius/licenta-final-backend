import { Module } from '@nestjs/common';
import { AdvertisementsModule } from 'src/advertisements/advertisements.module';
import { OlxScraper } from 'src/scrapers/olx.scraper';
import { StoriaScrapper } from 'src/scrapers/storia.scraper';
import { Publi24Scraper } from 'src/scrapers/publi24.scraper';
import { ImobiliareRoScraper } from 'src/scrapers/imobiliare.scraper';
import { ListingsAggregator } from './listings-aggregator.service';
import { ListingsController } from './listings.controller';
import { ListingsEnricher } from './listings-enricher.service';
import { ListingsRepository } from './listings-repository.service';
import { ListingsService } from './listings.service';

@Module({
  imports: [AdvertisementsModule],
  providers: [
    ListingsService,
    ListingsAggregator,
    ListingsRepository,
    ListingsEnricher,
    OlxScraper,
    StoriaScrapper,
    Publi24Scraper,
    ImobiliareRoScraper,
  ],
  controllers: [ListingsController],
})
export class ListingsModule {}
