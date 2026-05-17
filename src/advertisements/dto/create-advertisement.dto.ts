export class CreateAdvertisementDto {
  title?: string;
  description?: string | null;
  price?: number | string;
  currency?: string;
  city?: string;
  address?: string | null;
  areaSqm?: number | string | null;
  roomsNumber?: number | string | null;
  imageUrls?: string[];
}
