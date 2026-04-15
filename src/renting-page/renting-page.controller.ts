import { Controller, Get, Param } from '@nestjs/common';
import { RentingPageService } from './renting-page.service';

@Controller('renting-page')
export class RentingPageController {
  constructor(private readonly rentingPageService: RentingPageService) {}

  @Get(':prismaId')
  getListing(@Param('prismaId') prismaId: string) {
    return this.rentingPageService.getListing(prismaId);
  }
}
