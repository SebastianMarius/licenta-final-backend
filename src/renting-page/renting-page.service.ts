import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OlxListingScrapper } from 'src/scrapers/olx.listing.scraper';
import { StoriaListingScrapper } from 'src/scrapers/storia.listing.scraper';
import { Publi24ListingScrapper } from 'src/scrapers/publi24.listing.scraper';
import { ImobiliareListingScrapper } from 'src/scrapers/imobiliare.listing.scraper';

@Injectable()
export class RentingPageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly olxListingScraper: OlxListingScrapper,
    private readonly storiaListingScraper: StoriaListingScrapper,
    private readonly publi24ListingScraper: Publi24ListingScrapper,
    private readonly imobiliareListingScraper: ImobiliareListingScrapper,
  ) {}

  async getListing(prismaId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: prismaId },
    });
    if (!listing) {
      const advertisement = await this.prisma.advertisement.findUnique({
        where: { id: prismaId },
      });

      if (!advertisement) {
        throw new NotFoundException();
      }

      return {
        ...advertisement,
        source: 'user',
        url: null,
      };
    }

    const listingUrl = listing.url;
    let imageUrls = listing.imageUrls;

    switch (listing.source) {
      case 'olx':
        if (listingUrl) {
          const data = await this.olxListingScraper.scrape(listingUrl);
          if (data.images.length) imageUrls = data.images;
        }
        break;
      case 'storia':
        if (listingUrl) {
          const data = await this.storiaListingScraper.scrape(listingUrl);
          if (data.images.length) imageUrls = data.images;
        }
        break;
      case 'publi24':
        if (listingUrl) {
          const data = await this.publi24ListingScraper.scrape(listingUrl);
          if (data.images.length) imageUrls = data.images;
        }
        break;
      case 'imobiliare':
        if (listingUrl) {
          const data = await this.imobiliareListingScraper.scrape(listingUrl);
          if (data.images.length) imageUrls = data.images;
        }
        break;
    }

    return { ...listing, imageUrls };
  }
}
