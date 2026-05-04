import { Injectable } from "@nestjs/common";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

type StoriaImageSizes = {
    huge?: string;
    original?: string;
    large?: string;
    full?: string;
    medium?: string;
    small?: string;
    thumbnail?: string;
};

function pickStoriaImageUrl(entry: unknown): string | null {
    if (typeof entry === "string" && entry.startsWith("http")) return entry;
    if (!entry || typeof entry !== "object") return null;
    const o = entry as StoriaImageSizes;
    const u =
        o.huge ??
        o.original ??
        o.large ??
        o.full ??
        o.medium ??
        o.small ??
        o.thumbnail;
    return typeof u === "string" && u.startsWith("http") ? u : null;
}

/** Full carousel URLs live in `__NEXT_DATA__` → `props.pageProps.ad.images`. */
function extractStoriaListingImagesFromHtml(html: string): string[] {
    try {
        const startMarker = '<script id="__NEXT_DATA__"';
        const i = html.indexOf(startMarker);
        if (i < 0) return [];
        const gt = html.indexOf(">", i);
        const end = html.indexOf("</script>", gt);
        if (gt < 0 || end < 0) return [];
        const jsonText = html.slice(gt + 1, end).trim();
        const images = JSON.parse(jsonText)?.props?.pageProps?.ad?.images;
        if (!Array.isArray(images)) return [];
        const urls = images.map((img: unknown) => pickStoriaImageUrl(img)).filter(Boolean) as string[];
        return [...new Set(urls)];
    } catch {
        return [];
    }
}

/** After hydration, `#__NEXT_DATA__` in the DOM can list fewer photos than the SSR payload — prefer the longest list. */
function mergeStoriaImageSources(...lists: string[][]): string[] {
    const nonempty = lists.filter((x) => x.length > 0);
    if (nonempty.length === 0) return [];
    return nonempty.reduce((a, b) => (b.length > a.length ? b : a));
}

export interface StoriaListing {
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
export class StoriaListingScrapper {
    async scrape(listingUrl: string): Promise<StoriaListing> {
        const empty: StoriaListing = {
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
            const navResponse = await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
            let navigationHtml = "";
            if (navResponse) {
                try {
                    navigationHtml = await navResponse.text();
                } catch {
                    navigationHtml = "";
                }
            }
            await new Promise((r) => setTimeout(r, 1200));

            const blocked = await page.evaluate(() => {
                const t = document.body?.innerText?.toLowerCase() ?? "";
                return t.includes("captcha") || t.includes("verify you are human") ||
                    document.title.toLowerCase().includes("access denied");
            });
            if (blocked) return empty;

            try { await page.waitForSelector("h1", { timeout: 12000 }); } catch { /* continue anyway */ }

            const listing = await page.evaluate((): StoriaListing => {
                type Char = { key: string; value: string; localizedValue: string };

                const findChar = (chars: Char[], key: string) =>
                    chars.find((c) => c.key === key)?.localizedValue ?? null;

                const findCharRaw = (chars: Char[], key: string) =>
                    chars.find((c) => c.key === key)?.value ?? null;

                const parseComp = (text: string): string | null => {
                    const v = text.toLowerCase();
                    if (v.includes("semidecomandat")) return "semidecomandat";
                    if (v.includes("nedecomandat"))   return "nedecomandat";
                    if (v.includes("decomandat") || /\bdec\b/.test(v)) return "decomandat";
                    return null;
                };

                let title: string | null        = null;
                let price: string | null        = null;
                let location: string | null     = null;
                let description: string | null  = null;
                let images: string[]            = [];
                let seller: string | null       = null;
                let squareMeters: number | null = null;
                let constructionYear: number | null = null;
                let comp: string | null         = null;
                let floor: string | null        = null;

                // Primary: __NEXT_DATA__ (Storia is a Next.js app)
                try {
                    const raw = document.getElementById("__NEXT_DATA__")?.textContent;
                    const ad  = raw ? JSON.parse(raw)?.props?.pageProps?.ad : null;

                    if (ad) {
                        title  = ad.title ?? null;
                        seller = ad.owner?.name ?? ad.agency?.name ?? null;

                        if (ad.description) {
                            const div = document.createElement("div");
                            div.innerHTML = ad.description;
                            description = div.innerText?.trim() || null;
                        }

                        {
                            const pick = (entry: unknown): string | null => {
                                if (typeof entry === "string" && entry.startsWith("http")) return entry;
                                if (!entry || typeof entry !== "object") return null;
                                const o = entry as Record<string, string | undefined>;
                                const u =
                                    o.huge ??
                                    o.original ??
                                    o.large ??
                                    o.full ??
                                    o.medium ??
                                    o.small ??
                                    o.thumbnail;
                                return typeof u === "string" && u.startsWith("http") ? u : null;
                            };
                            images = [
                                ...new Set(
                                    ((ad.images ?? []) as unknown[])
                                        .map((img) => pick(img))
                                        .filter(Boolean) as string[],
                                ),
                            ];
                        }

                        const locs: Array<{ fullName: string; parentIds: string[] }> =
                            ad.location?.reverseGeocoding?.locations ?? [];
                        if (locs.length) {
                            location = locs.reduce((a, b) => b.parentIds.length >= a.parentIds.length ? b : a).fullName ?? null;
                        }

                        const chars: Char[] = ad.characteristics ?? [];

                        price = findChar(chars, "price") ?? findChar(chars, "rent");

                        const mRaw = findCharRaw(chars, "m");
                        if (mRaw) {
                            const v = parseFloat(mRaw.replace(",", "."));
                            if (!isNaN(v) && v > 0) squareMeters = v;
                        }

                        const yearMatch = findCharRaw(chars, "build_year")?.match(/(19|20)\d{2}/);
                        if (yearMatch) constructionYear = parseInt(yearMatch[0], 10);

                        const floorNo    = findChar(chars, "floor_no");
                        const totalFloors = findChar(chars, "building_floors_num");
                        if (floorNo || totalFloors) {
                            floor = [floorNo, totalFloors].filter(Boolean).join("/") || null;
                        }

                        comp = parseComp(title ?? "") ?? parseComp(description ?? "");
                    }
                } catch { /* fall through to DOM fallbacks */ }

                // DOM fallbacks
                if (!title) title = (document.querySelector("h1") as HTMLElement)?.innerText?.trim() || null;

                if (!description) {
                    const h2 = Array.from(document.querySelectorAll("h2"))
                        .find((h) => (h as HTMLElement).innerText.trim().toLowerCase() === "descriere");
                    if (h2) {
                        const parts: string[] = [];
                        let sib = h2.nextElementSibling;
                        while (sib && sib.tagName !== "H2") {
                            const t = (sib as HTMLElement).innerText?.trim();
                            if (t) parts.push(t);
                            sib = sib.nextElementSibling;
                        }
                        if (parts.length) description = parts.join("\n");
                    }
                }

                if (comp === null) comp = parseComp(description ?? "");

                return {
                    title, price, location, description, images, seller,
                    details: { squareMeters, constructionYear, compartmentation: comp, floor },
                };
            });

            const fromNavigation = extractStoriaListingImagesFromHtml(navigationHtml);
            const fromDocument = extractStoriaListingImagesFromHtml(await page.content());
            const merged = mergeStoriaImageSources(fromNavigation, fromDocument, listing.images);
            if (merged.length) listing.images = merged;

            console.log("[StoriaListingScrapper] Scraped:", JSON.stringify({
                url: listingUrl, title: listing.title, price: listing.price,
                location: listing.location, seller: listing.seller,
                images: listing.images.length, details: listing.details,
            }));

            return listing;
        } catch (error) {
            console.error("[StoriaListingScrapper] Error:", listingUrl, error);
            return empty;
        } finally {
            await browser.close();
        }
    }
}
