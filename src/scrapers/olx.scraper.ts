import { Injectable } from '@nestjs/common';
import vm from 'node:vm';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const MAX_PAGES = 20;
const CONCURRENCY = 4;
const SSR_MARKER = 'window.__PRERENDERED_STATE__=';

type PhotoBuckets = { byAdId: Record<string, string[]>; byListingPath: Record<string, string[]> };

/** SSR embed is a JS string literal holding JSON — parse here so browser CSP can't block vm/eval there. */
function extractOlxPhotoBuckets(html: string): PhotoBuckets {
    const byAdId: Record<string, string[]> = {};
    const byListingPath: Record<string, string[]> = {};
    try {
        const i = html.indexOf(SSR_MARKER);
        if (i < 0) return { byAdId, byListingPath };
        let end = html.indexOf('window.__TAURUS__=', i);
        if (end < 0) end = html.indexOf('window.__PAGE_TRANSLATIONS__=', i);
        if (end < 0) return { byAdId, byListingPath };
        let chunk = html.slice(i + SSR_MARKER.length, end).trim();
        if (chunk.endsWith(';')) chunk = chunk.slice(0, -1).trim();
        const jsonText = vm.runInNewContext(chunk) as string;
        const ads = JSON.parse(jsonText)?.listing?.listing?.ads;
        if (!Array.isArray(ads)) return { byAdId, byListingPath };

        const photoUrls = (raw: unknown[]): string[] => {
            const out: string[] = [];
            for (const p of raw) {
                if (typeof p === 'string' && p.startsWith('http')) out.push(p);
                else if (p && typeof p === 'object') {
                    const v = (p as { link?: string; url?: string; href?: string }).link
                        ?? (p as { url?: string }).url
                        ?? (p as { href?: string }).href;
                    if (typeof v === 'string' && v.startsWith('http')) out.push(v);
                }
            }
            return [...new Set(out)];
        };

        for (const ad of ads) {
            if (ad?.id == null || !Array.isArray(ad.photos)) continue;
            const urls = photoUrls(ad.photos);
            if (!urls.length) continue;
            byAdId[String(ad.id)] = urls;
            if (!ad.url) continue;
            try {
                const p = new URL(ad.url).pathname;
                byListingPath[p] = urls;
                byListingPath[p.replace(/\.html$/i, '')] = urls;
            } catch {
                /* ignore bad ad.url */
            }
        }
    } catch {
        /* fallback: DOM imgs */
    }
    return { byAdId, byListingPath };
}

function pickHtmlForSSR(initialNav: string, live: string): string {
    if (initialNav.includes(SSR_MARKER)) return initialNav;
    if (live.includes(SSR_MARKER)) return live;
    return initialNav || live;
}

@Injectable()
export class OlxScraper {
    async scrape(city: string | null, forma?: string, minRoms?: number) {
        const rentType = forma === 'proprietar' ? 'q-proprietar/' : '';
        const roomsSegment = minRoms != null && minRoms > 1 ? `${minRoms}-camere/` : '';
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
            const scrapePage = async (pageNum: number) => {
                const tab = await browser.newPage();
                await tab.setRequestInterception(true);
                tab.on('request', (req: any) => {
                    ['stylesheet', 'font', 'media'].includes(req.resourceType()) ? req.abort() : req.continue();
                });

                const url =
                    pageNum === 1
                        ? baseUrl
                        : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${pageNum}`;

                let initialHtml = '';
                try {
                    const docPromise = tab
                        .waitForResponse(
                            (r) => r.request().isNavigationRequest() && r.request().resourceType() === 'document',
                            { timeout: 25000 },
                        )
                        .catch(() => null);

                    await tab.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    const doc = await docPromise;
                    if (doc?.ok) {
                        try {
                            initialHtml = await doc.text();
                        } catch {
                            /* ignore */
                        }
                    }

                    await tab.waitForSelector('[data-cy="l-card"]', { timeout: 10000 });
                    await tab.evaluate(async () => {
                        await new Promise<void>((resolve) => {
                            let y = 0;
                            const id = window.setInterval(() => {
                                window.scrollBy(0, 400);
                                y += 400;
                                if (y >= document.body.scrollHeight) {
                                    window.clearInterval(id);
                                    resolve();
                                }
                            }, 80);
                        });
                    });
                    await new Promise((r) => setTimeout(r, 800));
                } catch {
                    console.warn(`OLX: no cards — page=${pageNum} url=${tab.url()}`);
                    await tab.close();
                    return [];
                }

                const buckets = extractOlxPhotoBuckets(pickHtmlForSSR(initialHtml, await tab.content()));

                const listings = await tab.evaluate((b: PhotoBuckets) => {
                    const push = (list: string[], u?: string | null) => {
                        const x = u?.trim();
                        if (!x?.length || x.startsWith('data:') || list.includes(x)) return;
                        list.push(x);
                    };

                    const domImages = (el: Element) => {
                        const list: string[] = [];
                        el.querySelectorAll('img').forEach((img) => {
                            push(list, img.src);
                            push(list, img.dataset.src ?? img.getAttribute('data-src'));
                            push(list, img.getAttribute('data-iesrc'));
                            img.getAttribute('srcset')
                                ?.split(',')
                                .forEach((part) => push(list, part.trim().split(/\s+/)[0]));
                        });
                        el.querySelectorAll('picture source[srcset]').forEach((s) =>
                            s
                                .getAttribute('srcset')
                                ?.split(',')
                                .forEach((part) => push(list, part.trim().split(/\s+/)[0])),
                        );
                        const rank = (u: string) => (/apollo\.olxcdn/i.test(u) ? 2 : /olxcdn\.com/i.test(u) ? 1 : 0);
                        return [...new Set(list)].sort((a, b) => rank(b) - rank(a));
                    };

                    const cardPhotos = (card: Element): string[] => {
                        const byId = b.byAdId[(card.id || '').trim()];
                        if (byId?.length) return byId;

                        const a =
                            card.querySelector<HTMLAnchorElement>('a[href*="/oferta/"]') ??
                            card.querySelector('a');
                        const href = a?.href ?? '';
                        try {
                            if (href.includes('oferta')) {
                                const pathname = new URL(href, location.href).pathname;
                                const fromPath =
                                    b.byListingPath[pathname]
                                    ?? b.byListingPath[pathname.replace(/\.html$/i, '')];
                                if (fromPath?.length) return fromPath;
                            }
                        } catch {
                            /* ignore */
                        }
                        return domImages(card);
                    };

                    const q = (el: Element, sel: string) => (el.querySelector(sel) as HTMLElement)?.innerText;

                    return Array.from(document.querySelectorAll('[data-cy="l-card"]')).map((card) => {
                        const ld = q(card, '[data-testid="location-date"]') ?? '';
                        const [location, date] = ld.split(' - ').map((s) => s?.trim());
                        const sq = (card as HTMLElement).innerText?.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
                        const sqm = sq ? parseFloat(sq[1].replace(',', '.')) : NaN;

                        const link =
                            card.querySelector<HTMLAnchorElement>('a[href*="/oferta/"]') ??
                            card.querySelector('a');

                        return {
                            title: q(card, '[data-cy="ad-card-title"]') ?? null,
                            price: q(card, '[data-testid="ad-price"]') ?? null,
                            url: link?.href,
                            location,
                            date,
                            imageUrls: cardPhotos(card),
                            squareMeters: Number.isNaN(sqm) ? null : sqm,
                        };
                    });
                }, buckets);

                await tab.close();
                return listings;
            };

            let firstPage = await scrapePage(1);
            if (firstPage.length === 0) {
                await new Promise((r) => setTimeout(r, 2800));
                firstPage = await scrapePage(1);
            }
            if (firstPage.length === 0) return [];

            const all = [...firstPage];
            const rest = Array.from({ length: MAX_PAGES - 1 }, (_, i) => i + 2);

            for (let i = 0; i < rest.length; i += CONCURRENCY) {
                const batch = rest.slice(i, i + CONCURRENCY);
                const rows = (await Promise.all(batch.map(scrapePage))).flat();
                if (rows.length === 0) break;
                all.push(...rows);
            }

            console.log(`OLX: collected ${all.length} items`);
            return all.map((item, index) => ({ index, ...item }));
        } finally {
            await browser.close();
        }
    }
}
