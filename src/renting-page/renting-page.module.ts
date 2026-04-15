import { Module } from '@nestjs/common';
import { RentingPageService } from './renting-page.service';
import { RentingPageController } from './renting-page.controller';
import { OlxListingScrapper } from 'src/scrapers/olx.listing.scraper';
import { StoriaListingScrapper } from 'src/scrapers/storia.listing.scraper';
import { Publi24ListingScrapper } from 'src/scrapers/publi24.listing.scraper';
import { ImobiliareListingScrapper } from 'src/scrapers/imobiliare.listing.scraper';

@Module({
  controllers: [RentingPageController],
  providers: [RentingPageService, OlxListingScrapper, StoriaListingScrapper, Publi24ListingScrapper, ImobiliareListingScrapper],
})
export class RentingPageModule {}
