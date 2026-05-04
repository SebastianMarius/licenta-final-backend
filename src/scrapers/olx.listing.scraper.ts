import { Injectable } from "@nestjs/common";
import vm from "node:vm";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

const SSR_MARKER = "window.__PRERENDERED_STATE__=";

/** Listing detail pages embed all gallery URLs in `ad.ad.photos` (JSON-LD usually has only one). */
function extractOlxListingPhotosFromHtml(html: string): string[] {
    try {
        const i = html.indexOf(SSR_MARKER);
        if (i < 0) return [];
        let end = html.indexOf("window.__TAURUS__=", i);
        if (end < 0) end = html.indexOf("window.__PAGE_TRANSLATIONS__=", i);
        if (end < 0) return [];
        let chunk = html.slice(i + SSR_MARKER.length, end).trim();
        if (chunk.endsWith(";")) chunk = chunk.slice(0, -1).trim();
        const jsonText = vm.runInNewContext(chunk) as string;
        const raw = JSON.parse(jsonText)?.ad?.ad?.photos;
        if (!Array.isArray(raw)) return [];
        const out: string[] = [];
        for (const p of raw) {
            if (typeof p === "string" && p.startsWith("http")) out.push(p);
            else if (p && typeof p === "object") {
                const v =
                    (p as { link?: string }).link ??
                    (p as { url?: string }).url ??
                    (p as { href?: string }).href;
                if (typeof v === "string" && v.startsWith("http")) out.push(v);
            }
        }
        return [...new Set(out)];
    } catch {
        return [];
    }
}

export interface OlxListing {
    title: string | null;
    price: string | null;
    location: string | null;
    description: string | null;
    images: string[];
    seller: string | null;
    details: {
        squareMeters: number | null;
        constructionYear: number | null;
        compartmentation: string | null;
        floor: string | null;
    };
}

@Injectable()
export class OlxListingScrapper {
    async scrape(listingUrl: string): Promise<OlxListing> {
        const empty: OlxListing = {
            title: null, price: null, location: null, description: null,
            images: [], seller: null,
            details: { squareMeters: null, constructionYear: null, compartmentation: null, floor: null },
        };

        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-zygote"],
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            await page.setExtraHTTPHeaders({ "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7" });
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
            await new Promise((r) => setTimeout(r, 1200));

            const blocked = await page.evaluate(() => {
                const t = document.body?.innerText?.toLowerCase() ?? "";
                return t.includes("captcha") || t.includes("verify you are human") ||
                    document.title.toLowerCase().includes("access denied");
            });
            if (blocked) return empty;

            try { await page.waitForSelector('script[type="application/ld+json"]', { timeout: 12000 }); } catch { /* continue anyway */ }

            const listing = await page.evaluate((): OlxListing => {
                const textOf = (el: Element | null) =>
                    (el as HTMLElement | null)?.innerText?.trim() || null;

                const parseComp = (raw: string): string | null => {
                    const v = raw.toLowerCase();
                    if (v.includes("semidecomandat")) return "semidecomandat";
                    if (v.includes("nedecomandat"))   return "nedecomandat";
                    if (v.includes("decomandat"))     return "decomandat";
                    return raw.trim() || null;
                };

                let title: string | null        = null;
                let price: string | null        = null;
                let location: string | null     = null;
                let description: string | null  = null;
                let images: string[]            = [];

                // Primary: JSON-LD (schema.org/Product) — OLX does not use __NEXT_DATA__
                try {
                    const ld = JSON.parse(
                        document.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}",
                    );
                    title       = ld.name ?? null;
                    description = ld.description ?? null;
                    images = Array.isArray(ld.image)
                        ? [...new Set((ld.image as string[]).filter(Boolean))]
                        : ld.image ? [ld.image as string] : [];
                    const offer = ld.offers;
                    if (offer?.price != null) price = `${offer.price} ${offer.priceCurrency ?? ""}`.trim();
                    const city   = offer?.areaServed?.name;
                    const county = offer?.areaServed?.addressRegion;
                    if (city || county) location = [city, county].filter(Boolean).join(", ");
                } catch { /* fall through to DOM */ }

                // Seller: anchor pointing to /oferte/user/
                const sellerLink = document.querySelector<HTMLAnchorElement>('a[href*="/oferte/user/"]');
                const seller = sellerLink
                    ? (sellerLink.innerText.trim().split(/\n|Pe OLX/)[0].trim() || null)
                    : null;

                // Fallbacks
                if (!title) {
                    const h4 = Array.from(document.querySelectorAll("h4"))
                        .find((el) => el.innerText.trim() !== "Notificari" && el.innerText.trim().length > 5);
                    title = textOf(h4 ?? null);
                }

                if (!price) {
                    const h3 = Array.from(document.querySelectorAll("h3"))
                        .find((el) => /\d/.test(el.innerText) && /€|lei|eur|ron/i.test(el.innerText));
                    price = textOf(h3 ?? null);
                }

                if (!location) {
                    const texts = Array.from(document.querySelectorAll("p,span,li,div"))
                        .map((el) => (el as HTMLElement).innerText?.trim())
                        .filter(Boolean);
                    const idx = texts.findIndex((t) => /^localitate$/i.test(t));
                    if (idx >= 0) location = texts.slice(idx + 1, idx + 3).filter(Boolean).join(", ") || null;
                }

                // Details from structured <p> elements ("Label: Value")
                let squareMeters: number | null = null;
                let constructionYear: number | null = null;
                let comp: string | null         = null;
                let floor: string | null        = null;

                for (const p of document.querySelectorAll("p")) {
                    const raw   = (p as HTMLElement).innerText?.trim() ?? "";
                    const colon = raw.indexOf(":");
                    if (colon < 0) continue;
                    const label = raw.slice(0, colon).toLowerCase().trim();
                    const value = raw.slice(colon + 1).trim();

                    if (squareMeters === null && (label.includes("suprafat") || label === "arie")) {
                        const m = value.match(/(\d+(?:[.,]\d+)?)/);
                        if (m) { const v = parseFloat(m[1].replace(",", ".")); if (!isNaN(v) && v > 0) squareMeters = v; }
                    }
                    if (constructionYear === null && label.includes("an construct")) {
                        const m = value.match(/(19|20)\d{2}/);
                        if (m) constructionYear = parseInt(m[0], 10);
                    }
                    if (comp === null && (label.includes("compartiment") || label.includes("tip"))) {
                        comp = parseComp(value);
                    }
                    if (floor === null && label === "etaj") floor = value || null;
                }

                // Regex fallbacks from description text
                const desc = description ?? "";
                if (squareMeters === null) { const m = desc.match(/(\d+(?:[.,]\d+)?)\s?m[²2]/i); if (m) squareMeters = parseFloat(m[1].replace(",", ".")); }
                if (constructionYear === null) { const m = desc.match(/(19|20)\d{2}/); if (m) constructionYear = parseInt(m[0], 10); }
                if (comp === null) comp = parseComp(desc);

                return {
                    title, price, location, description, images, seller,
                    details: { squareMeters, constructionYear, compartmentation: comp, floor },
                };
            });

            const ssrPhotos = extractOlxListingPhotosFromHtml(await page.content());
            if (ssrPhotos.length) listing.images = ssrPhotos;

            console.log("[OlxListingScrapper] Scraped:", JSON.stringify({
                url: listingUrl, title: listing.title, price: listing.price,
                location: listing.location, seller: listing.seller,
                images: listing.images.length, details: listing.details,
            }));

            return listing;
        } catch (error) {
            console.error("[OlxListingScrapper] Error:", listingUrl, error);
            return empty;
        } finally {
            await browser.close();
        }
    }
}
