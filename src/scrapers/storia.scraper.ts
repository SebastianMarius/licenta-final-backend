import { Injectable } from "@nestjs/common";

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { normaliseStoria } from "src/utils/utils";
puppeteer.use(StealthPlugin());

const STORIA_CITY_MAP: Record<string, string> = {
    // County capitals
    "alba-iulia":           "alba/alba--iulia",
    "arad":                 "arad/arad",
    "pitesti":              "arges/pitesti",
    "bacau":                "bacau/bacau",
    "oradea":               "bihor/oradea",
    "bistrita":             "bistrita--nasaud/bistrita",
    "botosani":             "botosani/botosani",
    "brasov":               "brasov/brasov",
    "braila":               "braila/braila",
    "bucuresti":            "bucuresti/bucuresti",
    "buzau":                "buzau/buzau",
    "resita":               "caras--severin/resita",
    "calarasi":             "calarasi/calarasi",
    "cluj-napoca":          "cluj/cluj--napoca",
    "constanta":            "constanta/constanta",
    "sfantu-gheorghe":      "covasna/sfantu--gheorghe",
    "targoviste":           "dambovita/targoviste",
    "craiova":              "dolj/craiova",
    "galati":               "galati/galati",
    "giurgiu":              "giurgiu/giurgiu",
    "targu-jiu":            "gorj/targu--jiu",
    "miercurea-ciuc":       "harghita/miercurea--ciuc",
    "deva":                 "hunedoara/deva",
    "slobozia":             "ialomita/slobozia",
    "iasi":                 "iasi/iasi",
    "baia-mare":            "maramures/baia--mare",
    "drobeta-turnu-severin":"mehedinti/drobeta--turnu--severin",
    "targu-mures":          "mures/targu--mures",
    "piatra-neamt":         "neamt/piatra--neamt",
    "slatina":              "olt/slatina",
    "ploiesti":             "prahova/ploiesti",
    "satu-mare":            "satu--mare/satu--mare",
    "zalau":                "salaj/zalau",
    "sibiu":                "sibiu/sibiu",
    "suceava":              "suceava/suceava",
    "alexandria":           "teleorman/alexandria",
    "timisoara":            "timis/timisoara",
    "tulcea":               "tulcea/tulcea",
    "vaslui":               "vaslui/vaslui",
    "ramnicu-valcea":       "valcea/ramnicu--valcea",
    "focsani":              "vrancea/focsani",
    // Other major cities
    "turda":                "cluj/turda",
    "dej":                  "cluj/dej",
    "campia-turzii":        "cluj/campia--turzii",
    "medias":               "sibiu/medias",
    "hunedoara":            "hunedoara/hunedoara",
    "petrosani":            "hunedoara/petrosani",
    "lugoj":                "timis/lugoj",
    "roman":                "neamt/roman",
    "dorohoi":              "botosani/dorohoi",
    "mangalia":             "constanta/mangalia",
    "navodari":             "constanta/navodari",
    "campulung":            "arges/campulung",
    "curtea-de-arges":      "arges/curtea--de--arges",
    "campina":              "prahova/campina",
    "sinaia":               "prahova/sinaia",
    "ramnicu-sarat":        "buzau/ramnicu--sarat",

    "tecuci":               "galati/tecuci",
    "adjud":                "vrancea/adjud",
    "onesti":               "bacau/onesti",
    "moinesti":             "bacau/moinesti",
    "fagaras":              "brasov/fagaras",
    "codlea":               "brasov/codlea",
    "sacele":               "brasov/sacele",
    "odorheiu-secuiesc":    "harghita/odorheiu--secuiesc",
    "reghin":               "mures/reghin",
    "sighisoara":           "mures/sighisoara",
    "toplita":              "harghita/toplita",
    "turnu-magurele":       "teleorman/turnu--magurele",
    "rosiori-de-vede":      "teleorman/rosiori--de--vede",
    "caracal":              "olt/caracal",
    "balti":                "olt/balti",
    "dr-tr-severin":        "mehedinti/drobeta--turnu--severin",
    "targu-neamt":          "neamt/targu--neamt",
    "pascani":              "iasi/pascani",
    "husi":                 "vaslui/husi",
    "barlad":               "vaslui/barlad",
};

const STORIA_BASE = "https://www.storia.ro/ro/rezultate/inchiriere/apartament";

const MAX_PAGES = 10;

const roomNumbersLocal =["ONE","TWO","THREE","FOUR"];

@Injectable()
export class StoriaScrapper {

    async scrape(city: string, forma?: string, minRoms?: number) {
        const citySlug = STORIA_CITY_MAP[city.toLowerCase()] ?? `${city}/${city}`;
        const baseUrl = `${STORIA_BASE}/${citySlug}`;
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
                const url = `${baseUrl}?by=DEFAULT&direction=DESC&page=${pageToScrape}`;
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

                const { items, totalPages } = await page.evaluate((pageNum: number) => {
                    const scriptEl = document.getElementById("__NEXT_DATA__");
                    if (!scriptEl?.textContent) return { items: [], totalPages: 0 };

                    const nextData = JSON.parse(scriptEl.textContent);
                    const searchAds = nextData?.props?.pageProps?.data?.searchAds ?? {};
                    const rawItems: unknown[] = searchAds?.items ?? [];
                    const pagination = searchAds?.pagination ?? {};
                    const totalPages: number = pagination?.totalPages ?? pageNum;

                    return { items: rawItems, totalPages };
                }, pageToScrape);

                if (items.length === 0) break;

                 const stamped = items.map((item: any, index: number) => {
                    const slugRaw = item?.slug;
                    const slug =
                        typeof slugRaw === "string" ? slugRaw.trim().replace(/^\//, "") : "";
                    const url = slug
                        ? `https://www.storia.ro/ro/oferta/${slug}`
                        : null;
                    return {
                        ...item,
                        id: `${globalIndex + index}-${item.slug ?? item.id}`,
                        url,
                    };
                });

                const filtered =
                    forma === "proprietar"
                        ? stamped.filter((item: any) => item.isPrivateOwner)
                        : stamped;

                const filteredBasedOnRooms =
                    minRoms != null && minRoms > 1
                        ? filtered.filter(
                              (item: any) =>
                                  item.roomsNumber === roomNumbersLocal[minRoms - 1],
                          )
                        : filtered;
                allItems.push(...filteredBasedOnRooms);
                globalIndex += items.length;

                if (pageToScrape >= totalPages) break;
            }

            console.log(`Storia scraper: collected ${allItems.length} items`);
            // return allItems;
            return normaliseStoria(allItems);
        } finally {
            await browser.close();
        }
    }
}
