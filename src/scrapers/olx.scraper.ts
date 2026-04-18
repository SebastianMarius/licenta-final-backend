import { Injectable } from '@nestjs/common';

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

//debugging
const MAX_PAGES = 10;

@Injectable()
export class OlxScraper {
    async scrape(city: string | null, forma?: string, minRoms? : number) {

        const rentType = forma === 'proprietar' ? 'q-direct-proprietar/' : '';
        const roomsSegment = minRoms != null ? `${minRoms}-camere/` : '';
        const baseUrl = `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-inchiriat/${roomsSegment}${city}/${rentType}`;

        console.log(baseUrl);
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--window-size=1920,1080',
            ],
        });

        try {
            const page = await browser.newPage();
            const allListings: Array<{
                index: number;
                title: string | null;
                price: string | null;
                location: string | undefined;
                date: string | undefined;
                url: string | undefined;
                image: string | null | undefined;
                squareMeters: number | null;
            }> = [];
            let globalIndex = 0;

            for (let pageToScrape = 1; pageToScrape <= MAX_PAGES; pageToScrape++) {
                const url = pageToScrape === 1 ? baseUrl : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${pageToScrape}`;
                await page.goto(url, { waitUntil: 'load', timeout: 30000 });

                try {
                    await page.waitForSelector('[data-cy="l-card"]', { timeout: 15000 });
                } catch {
                    const diagTitle = await page.title().catch(() => '?');
                    const diagUrl   = page.url();
                    const diagBody  = await page.evaluate(() => document.body?.innerText?.slice(0, 200) ?? '').catch(() => '');
                    console.warn(`OLX: no cards on page ${pageToScrape} — title="${diagTitle}" url=${diagUrl} body="${diagBody}"`);
                    break;
                }

                const listings = await page.evaluate(() => {
                    const cards = document.querySelectorAll('[data-cy="l-card"]');
                    return Array.from(cards).map((card) => {
                        const title = (card.querySelector('[data-cy="ad-card-title"]') as HTMLElement)?.innerText ?? null;
                        const price = (card.querySelector('[data-testid="ad-price"]') as HTMLElement)?.innerText ?? null;
                        const url = (card.querySelector('a') as HTMLAnchorElement)?.href;
                        const locationDate = (card.querySelector('[data-testid="location-date"]') as HTMLElement)?.innerText ?? '';
                        const [location, date] = locationDate.split(' - ').map((s) => s?.trim());
                        const image = card.querySelector('img')?.src;

                        let squareMeters: number | null = null;
                        const cardText = (card as HTMLElement).innerText ?? '';
                        const sqmMatch = cardText.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
                        if (sqmMatch) {
                            const parsed = parseFloat(sqmMatch[1].replace(',', '.'));
                            if (!isNaN(parsed)) squareMeters = parsed;
                        }

                        return { title, price, url, location, date, image, squareMeters };
                    });
                });

                if (listings.length === 0) break;

                for (const item of listings) {
                    allListings.push({ index: globalIndex++, ...item });
                }
            }
            console.log(`Olx: collected ${allListings.length} items`);
            return allListings;
        } finally {
            await browser.close();
        }
    }
}
