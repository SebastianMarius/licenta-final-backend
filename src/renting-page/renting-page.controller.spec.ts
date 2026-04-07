import { Test, TestingModule } from '@nestjs/testing';
import { RentingPageController } from './renting-page.controller';
import { RentingPageService } from './renting-page.service';

describe('RentingPageController', () => {
  let controller: RentingPageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RentingPageController],
      providers: [RentingPageService],
    }).compile();

    controller = module.get<RentingPageController>(RentingPageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
