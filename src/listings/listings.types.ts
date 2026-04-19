export type OlxScrapedItem = {
  index?: number;
  title: string | null;
  price: string | null;
  location?: string;
  date?: string;
  url?: string;
  imageUrls: string[];
  squareMeters?: number | null;
};

export type Publi24ScrapedItem = {
  index?: number;
  title: string | null;
  url?: string | null;
  price?: string | null;
  location?: string | null;
  imageUrls: string[];
  squareMeters?: number | null;
  date?: string | null;
};

export type ImobiliareScrapedItem = {
  externalId: string | null;
  title: string | null;
  price: string | null;
  currency: string | null;
  city: string | null;
  locationId: string | null;
  squareMeters: number | null;
  listId: string | null;
  sellerType: string | null;
  url: string | null;
  imageUrls: string[];
};

export type StoriaScrapedItem = {
  id?: string | number;
  title?: string | null;
  location?: unknown;
  images?: unknown;
  imageUrls?: string[];
  isPrivateOwner?: boolean;
  price?: string | null;
  totalPrice?: { value?: number; currency?: string } | number | string | null;
  squareMeters?: number | null;
  shortDescription?: string | null;
  slug?: string | null;
  url?: string | null;
  date?: string | null;
  dateCreated?: string | null;
  createdAtFirst?: string | null;
};

export type ListingsPayload = {
  olx: OlxScrapedItem[];
  storia: StoriaScrapedItem[];
  publi24: Publi24ScrapedItem[];
  imobiliare: ImobiliareScrapedItem[];
};
