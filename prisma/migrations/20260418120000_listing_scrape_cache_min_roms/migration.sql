-- AlterTable
ALTER TABLE "ListingScrapeCache" ADD COLUMN "minRoms" INTEGER NOT NULL DEFAULT 0;

-- DropIndex
DROP INDEX "ListingScrapeCache_searchCity_forma_key";

-- CreateIndex
CREATE UNIQUE INDEX "ListingScrapeCache_searchCity_forma_minRoms_key" ON "ListingScrapeCache"("searchCity", "forma", "minRoms");
