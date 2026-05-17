import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdvertisementsService } from './advertisements.service';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';

type AuthenticatedRequest = Request & {
  user: {
    sub: number;
    email: string;
  };
};

@Controller('advertisements')
export class AdvertisementsController {
  constructor(private readonly advertisementsService: AdvertisementsService) {}

  @Get()
  findAll(@Query('city') city?: string) {
    return this.advertisementsService.findAll(city);
  }

  @UseGuards(AuthGuard)
  @Get('mine')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.advertisementsService.findMine(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.advertisementsService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateAdvertisementDto,
  ) {
    return this.advertisementsService.create(req.user.sub, body);
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateAdvertisementDto,
  ) {
    return this.advertisementsService.update(req.user.sub, id, body);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertisementsService.remove(req.user.sub, id);
  }
}
