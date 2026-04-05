-- CreateTable
CREATE TABLE "ListingScrapeCache" (
    "id" TEXT NOT NULL,
    "searchCity" TEXT NOT NULL,
    "forma" TEXT NOT NULL DEFAULT '',
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ListingScrapeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingScrapeCache_searchCity_forma_key" ON "ListingScrapeCache"("searchCity", "forma");
