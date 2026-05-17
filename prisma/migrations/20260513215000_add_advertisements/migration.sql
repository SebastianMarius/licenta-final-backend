-- CreateTable
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "city" TEXT NOT NULL,
    "citySlug" TEXT NOT NULL,
    "address" TEXT,
    "areaSqm" DECIMAL(8,2),
    "roomsNumber" INTEGER,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Advertisement_ownerId_idx" ON "Advertisement"("ownerId");

-- CreateIndex
CREATE INDEX "Advertisement_citySlug_idx" ON "Advertisement"("citySlug");

-- AddForeignKey
ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
