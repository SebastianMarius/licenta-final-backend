import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
    constructor(private readonly listingService: ListingsService) {

    }

    @Get()
    getListingsInfo() {
        return {
            message: 'Provide a city in the path',
            example: 'GET /listings/bucharest',
            note: 'Each item has id, source, externalId',
        };
    }

    @Get(':city')
    async getListings(
        @Param('city') city: string,
        @Query('forma') forma?: string,
        @Query('minPrice') minPrice?: string,
        @Query('maxPrice') maxPrice?: string,
        @Query('minRoms') minRoms? : number, 
    ) {
        return this.listingService.getAllListings(city, forma, minPrice, maxPrice, minRoms);
    }
}
