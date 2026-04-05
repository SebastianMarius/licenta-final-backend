# Rental Backend

A NestJS backend that aggregates apartment rental listings from multiple Romanian real-estate platforms into a unified PostgreSQL database.

## What it does

On every `GET /listings/:city` request the backend:

1. Runs all four scrapers **in parallel** against the requested city
2. Maps every raw result to a unified `Listing` model
3. Upserts into PostgreSQL (duplicates are skipped via `externalId`)
4. Returns the raw results from each source

## Scraped sources

| Source | Strategy | Notes |
|---|---|---|
| **OLX** | Puppeteer + Stealth plugin | Bypasses bot detection |
| **Publi24** | Puppeteer + Stealth plugin | Bypasses bot detection |
| **Storia** | Puppeteer + JSON extraction | Reads embedded JSON payload |
| **Imobiliare.ro** | Axios (plain HTTP) | Bypasses DataDome via server-rendered HTML |

## API

### `GET /listings/:city`

Scrapes all sources for the given city and saves results to the database.

**Path parameter**

| Param | Description | Example |
|---|---|---|
| `city` | City slug used in source URLs | `cluj-napoca`, `bucuresti`, `timisoara` |

**Query parameter**

| Param | Values | Description |
|---|---|---|
| `forma` | `proprietar` | Filter to owner-only / zero-commission listings |

**Examples**

```
GET /listings/cluj-napoca
GET /listings/cluj-napoca?forma=proprietar
GET /listings/bucuresti
```

## Data model

```prisma
model Listing {
  id          String    @id @default(cuid())
  externalId  String    @unique
  source      String             // "olx" | "publi24" | "storia" | "imobiliare"
  title       String
  description String?
  url         String?
  price       Decimal?
  currency    String?            // "RON" | "EUR"
  city        String?
  address     String?
  areaSqm     Decimal?
  imageUrls   String[]
  rawPayload  Json?              // original scraped object
  createdAt   DateTime?          // original listing date from source
  updatedAt   DateTime?          // last update date from source
}
```

## Tech stack

- **NestJS** — framework
- **Prisma** — ORM + migrations
- **PostgreSQL** — database
- **Puppeteer Extra** + Stealth Plugin — headless browser scraping
- **Axios** — HTTP scraping (Imobiliare.ro)
- **Docker / Docker Compose** — containerised development

## Getting started

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### Local development (with Docker)

```bash
# Start Postgres + the NestJS app with hot-reload
docker-compose up
```

The API will be available at `http://localhost:9000`.  
PostgreSQL is exposed on port `5433` on the host.

### Local development (without Docker)

```bash
# Install dependencies
npm install

# Start Postgres separately, then run:
npm run start:dev
```

### Environment variables

Copy `.env` and adjust as needed:

```env
DATABASE_URL=postgresql://rental:rental_dev@localhost:5433/rental_db
PUPPETEER_EXECUTABLE_PATH=        # leave empty to use bundled Chromium
```

### Database migrations

```bash
# Apply all pending migrations
npx prisma migrate dev

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Regenerate the Prisma client after schema changes
npx prisma generate
```

## Project structure

```
src/
├── listings/
│   ├── listings.controller.ts   # REST endpoints
│   ├── listings.service.ts      # Orchestrates scrapers + DB writes
│   ├── listings.module.ts
│   └── listings-mapper.ts       # Raw → Listing model + date parsers
├── scrapers/
│   ├── olx.scraper.ts
│   ├── publi24.scraper.ts
│   ├── storia.scraper.ts
│   └── imobiliare.scraper.ts
└── prisma/
    ├── prisma.service.ts
    └── prisma.module.ts
prisma/
├── schema.prisma
└── migrations/
```
