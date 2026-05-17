import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdvertisementsService } from './advertisements.service';

describe('AdvertisementsService', () => {
  let service: AdvertisementsService;

  const prisma = {
    advertisement: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvertisementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdvertisementsService>(AdvertisementsService);
  });

  it('creates an advertisement for the logged in user', async () => {
    prisma.advertisement.create.mockResolvedValue({ id: 'ad-1' });

    await service.create(42, {
      title: ' Apartament 2 camere ',
      city: ' Cluj Napoca ',
      price: '550',
      description: ' mobilat ',
      areaSqm: '63.5',
      roomsNumber: '2',
      imageUrls: [' https://img/1.jpg ', ''],
    });

    expect(prisma.advertisement.create).toHaveBeenCalledWith({
      data: {
        ownerId: 42,
        title: 'Apartament 2 camere',
        description: 'mobilat',
        price: '550',
        currency: 'RON',
        city: 'Cluj Napoca',
        citySlug: 'cluj-napoca',
        address: null,
        areaSqm: '63.5',
        roomsNumber: 2,
        imageUrls: ['https://img/1.jpg'],
      },
    });
  });

  it('prevents editing another user advertisement', async () => {
    prisma.advertisement.findUnique.mockResolvedValue({
      id: 'ad-1',
      ownerId: 99,
    });

    await expect(
      service.update(42, 'ad-1', { title: 'Updated title' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps advertisements into listing rows', async () => {
    prisma.advertisement.findMany.mockResolvedValue([
      {
        id: 'ad-1',
        title: 'Studio central',
        description: 'Renovat',
        price: { toString: () => '430' },
        currency: 'EUR',
        city: 'Cluj-Napoca',
        citySlug: 'cluj-napoca',
        address: 'Centru',
        areaSqm: { toString: () => '38.5' },
        roomsNumber: 1,
        imageUrls: ['https://img/1.jpg'],
        createdAt: new Date('2026-05-13T18:00:00.000Z'),
        updatedAt: new Date('2026-05-13T18:00:00.000Z'),
        ownerId: 1,
      },
    ]);

    const result = await service.findListingRows('cluj napoca', 100, 600);

    expect(prisma.advertisement.findMany).toHaveBeenCalledWith({
      where: {
        citySlug: 'cluj-napoca',
        price: {
          gte: 100,
          lte: 600,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(result).toEqual([
      {
        title: 'Studio central',
        description: 'Renovat',
        price: 430,
        currency: 'EUR',
        city: 'Cluj-Napoca',
        address: 'Centru',
        squareMeters: 38.5,
        roomsNumber: 1,
        imageUrls: ['https://img/1.jpg'],
        source: 'user',
        url: null,
        prismaId: 'ad-1',
        date: '2026-05-13T18:00:00.000Z',
      },
    ]);
  });
});
