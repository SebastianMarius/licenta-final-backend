import { Test, TestingModule } from '@nestjs/testing';
import { AdvertisementsService } from '../advertisements/advertisements.service';
import { ListingsAggregator } from './listings-aggregator.service';
import { ListingsEnricher } from './listings-enricher.service';
import { ListingsRepository } from './listings-repository.service';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  let service: ListingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: AdvertisementsService,
          useValue: { findListingRows: jest.fn() },
        },
        { provide: ListingsAggregator, useValue: {} },
        { provide: ListingsRepository, useValue: {} },
        { provide: ListingsEnricher, useValue: {} },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
