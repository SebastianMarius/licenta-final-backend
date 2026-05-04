import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Listing", "ListingScrapeCache"
    RESTART IDENTITY CASCADE;
  `);

    console.log('DB cleared');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());