import { Module } from '@nestjs/common';
import { RentingPageService } from './renting-page.service';
import { RentingPageController } from './renting-page.controller';

@Module({
  controllers: [RentingPageController],
  providers: [RentingPageService],
})
export class RentingPageModule {}
