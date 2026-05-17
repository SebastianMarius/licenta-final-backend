import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdvertisementsController } from './advertisements.controller';
import { AdvertisementsService } from './advertisements.service';

@Module({
  controllers: [AdvertisementsController],
  providers: [AdvertisementsService, AuthGuard],
  exports: [AdvertisementsService],
})
export class AdvertisementsModule {}
