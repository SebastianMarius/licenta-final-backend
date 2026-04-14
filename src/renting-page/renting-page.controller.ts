import { Controller, Get, Param } from '@nestjs/common';
import { RentingPageService } from './renting-page.service';

@Controller('renting-page')
export class RentingPageController {
  constructor(private readonly rentingPageService: RentingPageService) {}

  @Get(':id')
  async (@Param("id") id:string) {
    this.rentingPageService.getProperty(id);
  }
}
