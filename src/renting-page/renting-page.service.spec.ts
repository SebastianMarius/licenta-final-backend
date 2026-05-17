import { Test, TestingModule } from '@nestjs/testing';
import { ImobiliareListingScrapper } from '../scrapers/imobiliare.listing.scraper';
import { OlxListingScrapper } from '../scrapers/olx.listing.scraper';
import { Publi24ListingScrapper } from '../scrapers/publi24.listing.scraper';
import { StoriaListingScrapper } from '../scrapers/storia.listing.scraper';
import { PrismaService } from '../prisma/prisma.service';
import { RentingPageService } from './renting-page.service';

describe('RentingPageService', () => {
  let service: RentingPageService;

  const prisma = {
    listing: { findUnique: jest.fn() },
    advertisement: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentingPageService,
        { provide: PrismaService, useValue: prisma },
        { provide: OlxListingScrapper, useValue: { scrape: jest.fn() } },
        { provide: StoriaListingScrapper, useValue: { scrape: jest.fn() } },
        { provide: Publi24ListingScrapper, useValue: { scrape: jest.fn() } },
        { provide: ImobiliareListingScrapper, useValue: { scrape: jest.fn() } },
      ],
    }).compile();

    service = module.get<RentingPageService>(RentingPageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a user advertisement when the prisma id is not a scraped listing', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);
    prisma.advertisement.findUnique.mockResolvedValue({
      id: 'ad-1',
      title: 'Apartament',
      imageUrls: [],
    });

    await expect(service.getListing('ad-1')).resolves.toEqual({
      id: 'ad-1',
      title: 'Apartament',
      imageUrls: [],
      source: 'user',
      url: null,
    });
  });
});
