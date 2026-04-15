import { Injectable } from "@nestjs/common";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

export interface ImobiliareListing {
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
export class ImobiliareListingScrapper {
    async scrape(listingUrl: string): Promise<ImobiliareListing> {
        const empty: ImobiliareListing = {
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

            const listing = await page.evaluate((): ImobiliareListing => {
                const parseComp = (raw: string): string | null => {
                    const v = raw.toLowerCase();
                    if (v.includes("semidecomandat")) return "semidecomandat";
                    if (v.includes("nedecomandat"))   return "nedecomandat";
                    if (v.includes("decomandat"))     return "decomandat";
                    return null;
                };

                // ── JSON-LD @graph (PRIMARY — always server-rendered) ─────────────
                // imobiliare.ro embeds a rich @graph with typed nodes for each entity.
                let title: string | null        = null;
                let price: string | null        = null;
                let location: string | null     = null;
                let description: string | null  = null;
                let images: string[]            = [];
                let seller: string | null       = null;
                let squareMeters: number | null = null;
                let constructionYear: number | null = null;
                let comp: string | null         = null;
                let floorCurrent: string | null = null;
                let floorTotal: string | null   = null;

                try {
                    const raw = document.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}";
                    const ld  = JSON.parse(raw);
                    const graph: Record<string, unknown>[] = Array.isArray(ld["@graph"]) ? ld["@graph"] : [];

                    const byType = (type: string) => graph.find((n) => n["@type"] === type) ?? {};

                    // Product → description + images (image[@id] IS the URL)
                    const product = byType("Product") as Record<string, unknown>;
                    description = (product.description as string) ?? null;
                    const imgRefs = Array.isArray(product.image) ? product.image as Record<string, string>[] : [];
                    images = [...new Set(imgRefs.map((r) => r["@id"]).filter(Boolean))];

                    // Offer → price string
                    const offer = byType("Offer") as Record<string, unknown>;
                    const spec  = (offer.priceSpecification ?? {}) as Record<string, unknown>;
                    if (spec.price != null) price = `${spec.price} ${spec.priceCurrency ?? ""}`.trim();

                    // RealEstateAgent → seller
                    const agent = byType("RealEstateAgent") as Record<string, unknown>;
                    seller = (agent.name as string) ?? null;

                    // Accommodation → squareMeters + current floor
                    const acc = byType("Accommodation") as Record<string, unknown>;
                    if (acc.floorSize != null) squareMeters = Number(acc.floorSize) || null;
                    if (acc.floorLevel != null) floorCurrent = String(acc.floorLevel);

                    // PostalAddress for this listing → location
                    const addr = graph.find(
                        (n) => n["@type"] === "PostalAddress" &&
                               typeof n["@id"] === "string" && n["@id"].includes("listing-"),
                    ) as Record<string, string> | undefined;
                    if (addr) {
                        const parts = [addr.addressLocality, addr.addressRegion].filter(Boolean);
                        if (parts.length) location = parts.join(", ");
                    }
                } catch { /* fall through to DOM */ }

                // ── h1 → title ────────────────────────────────────────────────
                title = (document.querySelector("h1") as HTMLElement | null)?.innerText?.trim() || null;

                // ── Page title → compartmentation ────────────────────────────
                // e.g. "Apartament semidecomandat cu 3 camere în zona …"
                comp = parseComp(document.title);

                // ── DOM spec block (.swiper-item) → year + total floors ───────
                // Structure: <div class="swiper-item …">
                //   <span class="…text-grey-700…">Label:</span>
                //   <span class="…font-semibold">Value</span>
                // </div>
                for (const item of document.querySelectorAll(".swiper-item")) {
                    const label = (item.querySelector(".text-grey-700") as HTMLElement | null)
                        ?.innerText?.trim().toLowerCase() ?? "";
                    const value = (item.querySelector(".font-semibold") as HTMLElement | null)
                        ?.innerText?.trim() ?? "";
                    if (!label || !value) continue;

                    if (label === "etaj:") {
                        // value is e.g. "1 / 4"
                        const m = value.match(/(\d+)\s*\/\s*(\d+)/);
                        if (m) { floorCurrent = m[1]; floorTotal = m[2]; }
                        else { const n = value.match(/(\d+)/); if (n) floorCurrent = n[1]; }
                    }
                    if (constructionYear === null && label.includes("constr")) {
                        const m = value.match(/(19|20)\d{2}/);
                        if (m) constructionYear = parseInt(m[0], 10);
                    }
                    // squareMeters fallback (should come from JSON-LD, but just in case)
                    if (squareMeters === null && label.includes("sup")) {
                        const m = value.match(/(\d+(?:[.,]\d+)?)/);
                        if (m) { const v = parseFloat(m[1].replace(",", ".")); if (!isNaN(v) && v > 0) squareMeters = v; }
                    }
                }

                // ── Regex fallbacks from description ─────────────────────────
                const desc = description ?? "";
                if (squareMeters === null) { const m = desc.match(/(\d+(?:[.,]\d+)?)\s*mp/i); if (m) squareMeters = parseFloat(m[1].replace(",", ".")); }
                if (constructionYear === null) { const m = desc.match(/(19|20)\d{2}/); if (m) constructionYear = parseInt(m[0], 10); }
                if (comp === null) comp = parseComp(desc);

                const floor = floorCurrent && floorTotal ? `${floorCurrent}/${floorTotal}`
                    : floorCurrent ?? null;

                return {
                    title, price, location, description, images, seller,
                    details: { squareMeters, constructionYear, compartmentation: comp, floor },
                };
            });

            console.log("[ImobiliareListingScrapper] Scraped:", JSON.stringify({
                url: listingUrl, title: listing.title, price: listing.price,
                location: listing.location, seller: listing.seller,
                images: listing.images.length, details: listing.details,
            }));

            return listing;
        } catch (error) {
            console.error("[ImobiliareListingScrapper] Error:", listingUrl, error);
            return empty;
        } finally {
            await browser.close();
        }
    }
}
