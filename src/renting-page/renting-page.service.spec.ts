import { Test, TestingModule } from '@nestjs/testing';
import { RentingPageService } from './renting-page.service';

describe('RentingPageService', () => {
  let service: RentingPageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RentingPageService],
    }).compile();

    service = module.get<RentingPageService>(RentingPageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
