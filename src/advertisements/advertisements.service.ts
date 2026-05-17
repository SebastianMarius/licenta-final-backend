import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Advertisement } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';

export type AdvertisementListingRow = {
  title: string;
  description: string | null;
  price: number;
  currency: string;
  city: string;
  address: string | null;
  squareMeters: number | null;
  roomsNumber: number | null;
  imageUrls: string[];
  source: 'user';
  url: null;
  prismaId: string;
  date: string;
};

function normalizeCitySlug(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function parseRequiredText(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} is required`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  return trimmed;
}

function parseOptionalText(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseDecimal(
  value: unknown,
  fieldName: string,
  required: boolean,
): string | null | undefined {
  if (value === undefined) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return undefined;
  }

  if (value === null) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return null;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException(`${fieldName} must be a positive number`);
  }

  const normalized =
    typeof value === 'number' ? value : Number(value.trim().replace(',', '.'));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new BadRequestException(`${fieldName} must be a positive number`);
  }

  return normalized.toString();
}

function parseInteger(
  value: unknown,
  fieldName: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException(`${fieldName} must be a positive integer`);
  }

  const normalized = typeof value === 'number' ? value : Number(value.trim());

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new BadRequestException(`${fieldName} must be a positive integer`);
  }

  return normalized;
}

function parseImageUrls(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException('imageUrls must be an array of strings');
  }

  return value
    .map((item) => {
      if (typeof item !== 'string') {
        throw new BadRequestException('imageUrls must be an array of strings');
      }

      return item.trim();
    })
    .filter((item): item is string => item.length > 0);
}

@Injectable()
export class AdvertisementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: number, dto: CreateAdvertisementDto) {
    return this.prisma.advertisement.create({
      data: {
        ownerId,
        ...this.buildCreateData(dto),
      },
    });
  }

  async findAll(city?: string) {
    return this.prisma.advertisement.findMany({
      where: city ? { citySlug: normalizeCitySlug(city) } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMine(ownerId: number) {
    return this.prisma.advertisement.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const advertisement = await this.prisma.advertisement.findUnique({
      where: { id },
    });

    if (!advertisement) {
      throw new NotFoundException('Advertisement not found');
    }

    return advertisement;
  }

  async update(ownerId: number, id: string, dto: UpdateAdvertisementDto) {
    const advertisement = await this.getOwnedAdvertisementOrThrow(id, ownerId);

    return this.prisma.advertisement.update({
      where: { id: advertisement.id },
      data: this.buildUpdateData(dto),
    });
  }

  async remove(ownerId: number, id: string) {
    const advertisement = await this.getOwnedAdvertisementOrThrow(id, ownerId);

    return this.prisma.advertisement.delete({
      where: { id: advertisement.id },
    });
  }

  async findListingRows(
    city: string,
    minPrice: number,
    maxPrice: number,
  ): Promise<AdvertisementListingRow[]> {
    const advertisements = await this.prisma.advertisement.findMany({
      where: {
        citySlug: normalizeCitySlug(city),
        price: {
          gte: minPrice,
          lte: maxPrice,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return advertisements.map((advertisement) =>
      this.toListingRow(advertisement),
    );
  }

  private async getOwnedAdvertisementOrThrow(id: string, ownerId: number) {
    const advertisement = await this.prisma.advertisement.findUnique({
      where: { id },
    });

    if (!advertisement) {
      throw new NotFoundException('Advertisement not found');
    }

    if (advertisement.ownerId !== ownerId) {
      throw new ForbiddenException('You can only edit your own advertisements');
    }

    return advertisement;
  }

  private buildCreateData(dto: CreateAdvertisementDto) {
    const title = parseRequiredText(dto.title, 'title');
    const city = parseRequiredText(dto.city, 'city');
    const price = parseDecimal(dto.price, 'price', true);
    if (price == null) {
      throw new BadRequestException('price is required');
    }

    const imageUrls = parseImageUrls(dto.imageUrls);
    const areaSqm = parseDecimal(dto.areaSqm, 'areaSqm', false);
    const roomsNumber = parseInteger(dto.roomsNumber, 'roomsNumber');

    return {
      title,
      description: parseOptionalText(dto.description, 'description') ?? null,
      price,
      currency: parseOptionalText(dto.currency, 'currency') ?? 'RON',
      city,
      citySlug: normalizeCitySlug(city),
      address: parseOptionalText(dto.address, 'address') ?? null,
      areaSqm: areaSqm ?? null,
      roomsNumber: roomsNumber ?? null,
      imageUrls: imageUrls ?? [],
    };
  }

  private buildUpdateData(dto: UpdateAdvertisementDto) {
    const data: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      data.title = parseRequiredText(dto.title, 'title');
    }

    if (dto.description !== undefined) {
      data.description = parseOptionalText(dto.description, 'description');
    }

    if (dto.price !== undefined) {
      data.price = parseDecimal(dto.price, 'price', true);
    }

    if (dto.currency !== undefined) {
      data.currency = parseRequiredText(dto.currency, 'currency');
    }

    if (dto.city !== undefined) {
      const city = parseRequiredText(dto.city, 'city');
      data.city = city;
      data.citySlug = normalizeCitySlug(city);
    }

    if (dto.address !== undefined) {
      data.address = parseOptionalText(dto.address, 'address');
    }

    if (dto.areaSqm !== undefined) {
      data.areaSqm = parseDecimal(dto.areaSqm, 'areaSqm', false);
    }

    if (dto.roomsNumber !== undefined) {
      data.roomsNumber = parseInteger(dto.roomsNumber, 'roomsNumber');
    }

    if (dto.imageUrls !== undefined) {
      data.imageUrls = parseImageUrls(dto.imageUrls);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No changes provided');
    }

    return data;
  }

  private toListingRow(advertisement: Advertisement): AdvertisementListingRow {
    return {
      title: advertisement.title,
      description: advertisement.description,
      price: Number(advertisement.price),
      currency: advertisement.currency,
      city: advertisement.city,
      address: advertisement.address,
      squareMeters:
        advertisement.areaSqm != null ? Number(advertisement.areaSqm) : null,
      roomsNumber: advertisement.roomsNumber,
      imageUrls: advertisement.imageUrls,
      source: 'user',
      url: null,
      prismaId: advertisement.id,
      date: advertisement.createdAt.toISOString(),
    };
  }
}
