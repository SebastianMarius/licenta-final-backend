import { Injectable } from "@nestjs/common";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

export interface Publi24Listing {
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
export class Publi24ListingScrapper {
    async scrape(listingUrl: string): Promise<Publi24Listing> {
        const empty: Publi24Listing = {
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

            try { await page.waitForSelector("h1", { timeout: 12000 }); } catch { /* continue anyway */ }
            // Specs are injected by JS after DOM load — wait for the first attribute item
            try { await page.waitForSelector(".attribute-item", { timeout: 8000 }); } catch { /* continue anyway */ }

            const listing = await page.evaluate((): Publi24Listing => {
                const textOf = (el: Element | null) =>
                    (el as HTMLElement | null)?.innerText?.trim() || null;

                const parseComp = (raw: string): string | null => {
                    const v = raw.toLowerCase();
                    if (v.includes("semidecomandat")) return "semidecomandat";
                    if (v.includes("nedecomandat"))   return "nedecomandat";
                    if (v.includes("decomandat"))     return "decomandat";
                    return null;
                };

                // Title
                const title = textOf(document.querySelector("h1"));

                // Price: first element whose full text matches "NNN EUR/RON"
                const priceEl = Array.from(document.querySelectorAll("strong, span, b, p, div, h2"))
                    .find((el) => /^\s*[\d\s,.]+\s*(EUR|RON|LEI)\s*$/i.test((el as HTMLElement).innerText ?? ""));
                const price = textOf(priceEl ?? null);

                // Location: parse from the page title tag "… • City, County"
                let location: string | null = null;
                const titleMatch = document.title.match(/•\s*(.+?)\s*$/);
                if (titleMatch) {
                    // "Cluj-Napoca, Cluj" → reorder to "City, County" as-is
                    location = titleMatch[1].trim() || null;
                }
                // Fallback: links near the h1 (county + city links below the title)
                if (!location) {
                    const h1 = document.querySelector("h1");
                    const container = h1?.parentElement;
                    if (container) {
                        const parts = Array.from(container.querySelectorAll("a"))
                            .map((a) => a.innerText.trim())
                            .filter((t) => t.length > 1 && t.length < 30 && !/publi|anun|imob|inchir|apart/i.test(t));
                        if (parts.length) location = parts.slice(0, 2).join(", ");
                    }
                }

                // Images: only the listing carousel (numbered thumbnails), not site-wide CDN assets
                const rank = (u: string): number => {
                    const x = u.toLowerCase();
                    if (x.includes("/extralarge/")) return 5;
                    if (x.includes("/large/")) return 4;
                    if (x.includes("/top/")) return 3;
                    if (x.includes("/medium/")) return 2;
                    if (x.includes("/small/")) return 1;
                    return 0;
                };
                const better = (a: string, b: string) => (rank(b) > rank(a) ? b : a);
                const fileHash = (u: string): string | null => {
                    const m = u.match(/\/([a-f0-9]{32})\.(webp|jpg|jpeg|png)/i);
                    return m ? m[1].toLowerCase() : null;
                };
                const isGallerySize = (u: string) =>
                    /\/vertical-ro-[^/]+\/(extralarge|large|top|medium|small)\//i.test(u);

                const hero = document.querySelector<HTMLImageElement>("img.detailViewImg");
                const galleryScope: Element =
                    hero?.closest("div[class*='col-md-8'], div[class*='col-lg-8'], article, main") ??
                    document.querySelector("main") ??
                    document.body;

                const byIndex = new Map<number, string>();
                for (const img of galleryScope.querySelectorAll<HTMLImageElement>("img")) {
                    const label = `${img.alt || ""} ${img.getAttribute("title") || ""}`;
                    const num = label.match(/(?:imagine|image)\s*(\d+)/i);
                    if (!num) continue;
                    const src = img.src || img.getAttribute("data-src") || "";
                    if (!src.includes("s3.publi24.ro") || src.includes("/avatars/") || !isGallerySize(src)) continue;
                    const i = parseInt(num[1], 10);
                    const prev = byIndex.get(i);
                    byIndex.set(i, prev ? better(prev, src) : src);
                }

                const bestByHash = new Map<string, string>();
                for (const img of galleryScope.querySelectorAll<HTMLImageElement>("img")) {
                    const src = img.src || img.getAttribute("data-src") || "";
                    if (!src.includes("s3.publi24.ro") || !isGallerySize(src)) continue;
                    const h = fileHash(src);
                    if (!h) continue;
                    const prev = bestByHash.get(h);
                    bestByHash.set(h, prev ? better(prev, src) : src);
                }

                let images: string[] = [];
                const heroSrc = hero?.src || "";
                const indices = [...byIndex.keys()].sort((a, b) => a - b);
                if (indices.length > 0) {
                    images = indices.map((idx) => {
                        let u = byIndex.get(idx)!;
                        const h = fileHash(u);
                        if (h && bestByHash.has(h)) u = bestByHash.get(h)!;
                        return u;
                    });
                } else if (heroSrc && isGallerySize(heroSrc)) {
                    const h = fileHash(heroSrc);
                    images = [h && bestByHash.has(h) ? bestByHash.get(h)! : heroSrc];
                }

                // Seller: the h2 that sits just above the "Contactează vânzătorul" form
                let seller: string | null = null;
                const contactH5 = Array.from(document.querySelectorAll("h5"))
                    .find((h) => /contact/i.test((h as HTMLElement).innerText));
                if (contactH5) {
                    // Walk siblings backward until we find an h2
                    let el: Element | null = contactH5.previousElementSibling;
                    while (el) {
                        if (el.tagName === "H2") { seller = (el as HTMLElement).innerText?.trim() || null; break; }
                        el = el.previousElementSibling;
                    }
                }
                // Fallback: link that precedes "Vezi toate anunțurile"
                if (!seller) {
                    const seeAllLink = Array.from(document.querySelectorAll("a"))
                        .find((a) => /toate anu/i.test(a.innerText));
                    if (seeAllLink) {
                        let prev = seeAllLink.previousElementSibling;
                        while (prev) {
                            const t = (prev as HTMLElement).innerText?.trim();
                            if (t && t.length > 2 && t.length < 60) { seller = t; break; }
                            prev = prev.previousElementSibling;
                        }
                    }
                }

                // Description: text after the "Descriere" h5
                // Stop before "ID anunț", script blocks, or any other non-description sibling
                let description: string | null = null;
                const descH5 = Array.from(document.querySelectorAll("h5"))
                    .find((h) => (h as HTMLElement).innerText.trim().toLowerCase() === "descriere");
                if (descH5) {
                    const parts: string[] = [];
                    let sib = descH5.nextElementSibling;
                    while (sib) {
                        const tag = sib.tagName;
                        if (["H2", "H3", "H4", "H5", "H6", "SCRIPT"].includes(tag)) break;
                        const t = (sib as HTMLElement).innerText?.trim();
                        if (t && /^ID anun|^Raporteaz|^Arat|^Viz|^See|^var /i.test(t)) break;
                        if (t) parts.push(t);
                        sib = sib.nextElementSibling;
                    }
                    if (parts.length) description = parts.join("\n");
                }

                // ── Specs ────────────────────────────────────────────────────
                // PRIMARY: page <title> tag is always server-rendered and contains
                // "... cam. Compartmentation, N mp Etaj X din Y • City, County"
                // This is bot-proof — no JS execution required.
                let squareMeters: number | null = null;
                let constructionYear: number | null = null;
                let comp: string | null         = null;
                let floor: string | null        = null;

                
                const pageTitle = document.title;

                const compMatch = pageTitle.match(/cam\.\s*(\w+)/i);
                if (compMatch) comp = parseComp(compMatch[1]);

                const mpMatch = pageTitle.match(/(\d+(?:[.,]\d+)?)\s*mp/i);
                if (mpMatch) {
                    const v = parseFloat(mpMatch[1].replace(",", "."));
                    if (!isNaN(v) && v > 0) squareMeters = v;
                }

                const etajMatch = pageTitle.match(/Etaj\s+(\d+)\s+din\s+(\d+)/i);
                if (etajMatch) floor = `${etajMatch[1]}/${etajMatch[2]}`;

                // SECONDARY: .attribute-item DOM elements (available when JS runs fully)
                for (const item of document.querySelectorAll(".attribute-item")) {
                    const label = (item.querySelector(".attribute-label") as HTMLElement)?.innerText.trim().toLowerCase() ?? "";
                    const value = (item.querySelector(".attribute-value") as HTMLElement)?.innerText.trim() ?? "";
                    if (!label || !value) continue;

                    if (squareMeters === null && label.includes("suprafat")) {
                        const m = value.match(/(\d+(?:[.,]\d+)?)/);
                        if (m) { const v = parseFloat(m[1].replace(",", ".")); if (!isNaN(v) && v > 0) squareMeters = v; }
                    }
                    if (constructionYear === null && label.includes("an constructi")) {
                        const m = value.match(/(19|20)\d{2}/);
                        if (m) constructionYear = parseInt(m[0], 10);
                    }
                    if (comp === null && label.includes("compartiment")) comp = parseComp(value);
                    if (floor === null && label === "etaj") {
                        const m = value.match(/(\d+)/);
                        if (m) floor = m[1];
                    }
                }

                // FALLBACK: description text (Romanian uses "mp" for m²)
                const desc = description ?? "";
                if (squareMeters === null) { const m = desc.match(/(\d+(?:[.,]\d+)?)\s*m[²2p]/i); if (m) squareMeters = parseFloat(m[1].replace(",", ".")); }
                if (constructionYear === null) { const m = desc.match(/(19|20)\d{2}/); if (m) constructionYear = parseInt(m[0], 10); }
                if (comp === null) comp = parseComp(desc);

                return {
                    title, price, location, description, images, seller,
                    details: { squareMeters, constructionYear, compartmentation: comp, floor },
                };
            });

            console.log("[Publi24ListingScrapper] Scraped:", JSON.stringify({
                url: listingUrl, title: listing.title, price: listing.price,
                location: listing.location, seller: listing.seller,
                images: listing.images.length, details: listing.details,
            }));

            return listing;
        } catch (error) {
            console.error("[Publi24ListingScrapper] Error:", listingUrl, error);
            return empty;
        } finally {
            await browser.close();
        }
    }
}
