import { Body, Controller, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';

export type RecommendBody = {
  providedListing?: unknown;
  listings?: unknown;
};

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) { }

  @Post('recommend')
  async recommend(@Body() body: RecommendBody) {
    return this.assistantService.getRecommendedListings(
      body?.providedListing,
      body?.listings,
    );
  }
}