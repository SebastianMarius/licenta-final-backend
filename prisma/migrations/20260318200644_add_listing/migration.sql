-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "price" DECIMAL(12,2),
    "currency" TEXT DEFAULT 'RON',
    "city" TEXT,
    "address" TEXT,
    "areaSqm" DECIMAL(8,2),
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_externalId_key" ON "Listing"("externalId");

-- CreateIndex
CREATE INDEX "Listing_source_city_idx" ON "Listing"("source", "city");
