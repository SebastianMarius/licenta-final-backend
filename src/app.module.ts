import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ListingsModule } from './listings/listings.module';
import { PrismaModule } from './prisma/prisma.module';
import { RentPageModule } from './rent-page/rent-page.module';
import { RentingPageModule } from './renting-page/renting-page.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ListingsModule, RentPageModule, RentingPageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
