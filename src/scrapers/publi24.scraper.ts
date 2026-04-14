import { Injectable } from "@nestjs/common";

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const PUBLI24_CITY_MAP: Record<string, string> = {
    // County capitals
    "alba-iulia":           "alba",
    "arad":                 "arad",
    "pitesti":              "arges",
    "bacau":                "bacau",
    "oradea":               "bihor",
    "bistrita":             "bistrita-nasaud",
    "botosani":             "botosani",
    "brasov":               "brasov",
    "braila":               "braila",
    "bucuresti":            "bucuresti",
    "buzau":                "buzau",
    "resita":               "caras-severin",
    "calarasi":             "calarasi",
    "cluj-napoca":          "cluj",
    "constanta":            "constanta",
    "sfantu-gheorghe":      "covasna",
    "targoviste":           "dambovita",
    "craiova":              "dolj",
    "galati":               "galati",
    "giurgiu":              "giurgiu",
    "targu-jiu":            "gorj",
    "miercurea-ciuc":       "harghita",
    "deva":                 "hunedoara",
    "slobozia":             "ialomita",
    "iasi":                 "iasi",
    "baia-mare":            "maramures",
    "drobeta-turnu-severin":"mehedinti",
    "targu-mures":          "mures",
    "piatra-neamt":         "neamt",
    "slatina":              "olt",
    "ploiesti":             "prahova",
    "satu-mare":            "satu-mare",
    "zalau":                "salaj",
    "sibiu":                "sibiu",
    "suceava":              "suceava",
    "alexandria":           "teleorman",
    "timisoara":            "timis",
    "tulcea":               "tulcea",
    "vaslui":               "vaslui",
    "ramnicu-valcea":       "valcea",
    "focsani":              "vrancea",
    // Other major cities
    "turda":                "cluj",
    "dej":                  "cluj",
    "campia-turzii":        "cluj",
    "medias":               "sibiu",
    "hunedoara":            "hunedoara",
    "petrosani":            "hunedoara",
    "lugoj":                "timis",
    "roman":                "neamt",
    "dorohoi":              "botosani",
    "mangalia":             "constanta",
    "navodari":             "constanta",
    "campulung":            "arges",
    "curtea-de-arges":      "arges",
    "campina":              "prahova",
    "sinaia":               "prahova",
    "ramnicu-sarat":        "buzau",
    "tecuci":               "galati",
    "adjud":                "vrancea",
    "onesti":               "bacau",
    "moinesti":             "bacau",
    "fagaras":              "brasov",
    "codlea":               "brasov",
    "sacele":               "brasov",
    "odorheiu-secuiesc":    "harghita",
    "reghin":               "mures",
    "sighisoara":           "mures",
    "toplita":              "harghita",
    "turnu-magurele":       "teleorman",
    "rosiori-de-vede":      "teleorman",
    "caracal":              "olt",
    "dr-tr-severin":        "mehedinti",
    "targu-neamt":          "neamt",
    "pascani":              "iasi",
    "husi":                 "vaslui",
    "barlad":               "vaslui",
};

const PUBLI24_BASE = "https://www.publi24.ro/anunturi/imobiliare/de-inchiriat/apartamente";

const MAX_PAGES = 10;

@Injectable()
export class Publi24Scraper {
    async scrape(city: string, forma?: string) {
        const countySlug = PUBLI24_CITY_MAP[city.toLowerCase()] ?? city.toLowerCase();
        const baseUrl = `${PUBLI24_BASE}/${countySlug}/`;

        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-zygote",
                "--window-size=1920,1080",
            ],
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            );
            await page.setExtraHTTPHeaders({
                "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
            });
            await page.setViewport({ width: 1920, height: 1080 });

            const allItems: unknown[] = [];
            let globalIndex = 0;

            for (let pageToScrape = 1; pageToScrape <= MAX_PAGES; pageToScrape++) {
                const params = new URLSearchParams();
                if (pageToScrape > 1) params.set("pag", String(pageToScrape));
                if (forma === "proprietar") params.set("commercial", "false");
                const query = params.toString();
                const url = query ? `${baseUrl}?${query}` : baseUrl;

                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

                try {
                    await page.waitForSelector(".article-content", { timeout: 5000 });
                } catch {
                    break;
                }

                const { items, totalPages } = await page.evaluate((pageNum: number) => {
                    const cards = document.querySelectorAll("[class*='article-item']");

                    const items = Array.from(cards).map((card) => {
                        const titleEl = card.querySelector("h2.article-title a") as HTMLAnchorElement | null;
                        const title = titleEl?.innerText?.trim() ?? null;
                        const url = titleEl?.href ?? null;

                        const priceEl = card.querySelector(".article-price") as HTMLElement | null;
                        const price = priceEl?.innerText?.trim() ?? null;

                        const locationEl = card.querySelector(".article-location span") as HTMLElement | null;
                        const location = locationEl?.innerText?.trim() ?? null;

                        const areaEl = card.querySelector(".article-short-info .article-lbl-txt") as HTMLElement | null;
                        const areaText = areaEl?.innerText?.trim() ?? null;

                        const imgEl = card.querySelector(".art-img img") as HTMLImageElement | null;
                        const image = imgEl?.src ?? null;

                        const dateEl = card.querySelector(".article-date span") as HTMLElement | null;
                        const date = dateEl?.innerText?.trim() ?? null;

                        let squareMeters: number | null = null;
                        if (areaText) {
                            const match = areaText.match(/(\d+(?:[.,]\d+)?)/);
                            if (match) {
                                const parsed = parseFloat(match[1].replace(",", "."));
                                if (!isNaN(parsed)) squareMeters = parsed;
                            }
                        }

                        return { title, url, price, location, image, squareMeters, date };
                    });

                    let totalPages = pageNum;
                    document.querySelectorAll(".pagination li a").forEach((el) => {
                        const href = (el as HTMLAnchorElement).href;
                        const match = href.match(/[?&]pag=(\d+)/);
                        if (match) {
                            const page = parseInt(match[1]);
                            if (page > totalPages) totalPages = page;
                        }
                    });

                    return { items, totalPages };
                }, pageToScrape);

                if (items.length === 0) break;

                for (const item of items) {
                    allItems.push({ index: globalIndex++, ...(item as object) });
                }

                if (pageToScrape >= totalPages) break;
            }

            console.log(`Publi24 scraper: collected ${allItems.length} items`);
            return allItems;
        } finally {
            await browser.close();
        }
    }
}
