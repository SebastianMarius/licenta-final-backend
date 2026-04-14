import { Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * Maps the canonical city key (e.g. "cluj-napoca") to the imobiliare.ro
 * URL path segment (e.g. "judetul-cluj/cluj-napoca").
 * Bucuresti is special: the site uses simply "bucuresti" without a county prefix.
 */
const IMOBILIARE_CITY_MAP: Record<string, string> = {
    // County capitals
    'alba-iulia':            'judetul-alba/alba-iulia',
    'arad':                  'judetul-arad/arad',
    'pitesti':               'judetul-arges/pitesti',
    'bacau':                 'judetul-bacau/bacau',
    'oradea':                'judetul-bihor/oradea',
    'bistrita':              'judetul-bistrita-nasaud/bistrita',
    'botosani':              'judetul-botosani/botosani',
    'brasov':                'judetul-brasov/brasov',
    'braila':                'judetul-braila/braila',
    'bucuresti':             'bucuresti',
    'buzau':                 'judetul-buzau/buzau',
    'resita':                'judetul-caras-severin/resita',
    'calarasi':              'judetul-calarasi/calarasi',
    'cluj-napoca':           'judetul-cluj/cluj-napoca',
    'constanta':             'judetul-constanta/constanta',
    'sfantu-gheorghe':       'judetul-covasna/sfantu-gheorghe',
    'targoviste':            'judetul-dambovita/targoviste',
    'craiova':               'judetul-dolj/craiova',
    'galati':                'judetul-galati/galati',
    'giurgiu':               'judetul-giurgiu/giurgiu',
    'targu-jiu':             'judetul-gorj/targu-jiu',
    'miercurea-ciuc':        'judetul-harghita/miercurea-ciuc',
    'deva':                  'judetul-hunedoara/deva',
    'slobozia':              'judetul-ialomita/slobozia',
    'iasi':                  'judetul-iasi/iasi',
    'baia-mare':             'judetul-maramures/baia-mare',
    'drobeta-turnu-severin': 'judetul-mehedinti/drobeta-turnu-severin',
    'targu-mures':           'judetul-mures/targu-mures',
    'piatra-neamt':          'judetul-neamt/piatra-neamt',
    'slatina':               'judetul-olt/slatina',
    'ploiesti':              'judetul-prahova/ploiesti',
    'satu-mare':             'judetul-satu-mare/satu-mare',
    'zalau':                 'judetul-salaj/zalau',
    'sibiu':                 'judetul-sibiu/sibiu',
    'suceava':               'judetul-suceava/suceava',
    'alexandria':            'judetul-teleorman/alexandria',
    'timisoara':             'judetul-timis/timisoara',
    'tulcea':                'judetul-tulcea/tulcea',
    'vaslui':                'judetul-vaslui/vaslui',
    'ramnicu-valcea':        'judetul-valcea/ramnicu-valcea',
    'focsani':               'judetul-vrancea/focsani',
    // Other major cities
    'turda':                 'judetul-cluj/turda',
    'dej':                   'judetul-cluj/dej',
    'campia-turzii':         'judetul-cluj/campia-turzii',
    'medias':                'judetul-sibiu/medias',
    'hunedoara':             'judetul-hunedoara/hunedoara',
    'petrosani':             'judetul-hunedoara/petrosani',
    'lugoj':                 'judetul-timis/lugoj',
    'roman':                 'judetul-neamt/roman',
    'dorohoi':               'judetul-botosani/dorohoi',
    'mangalia':              'judetul-constanta/mangalia',
    'navodari':              'judetul-constanta/navodari',
    'campulung':             'judetul-arges/campulung',
    'curtea-de-arges':       'judetul-arges/curtea-de-arges',
    'campina':               'judetul-prahova/campina',
    'sinaia':                'judetul-prahova/sinaia',
    'ramnicu-sarat':         'judetul-buzau/ramnicu-sarat',
    'tecuci':                'judetul-galati/tecuci',
    'adjud':                 'judetul-vrancea/adjud',
    'onesti':                'judetul-bacau/onesti',
    'moinesti':              'judetul-bacau/moinesti',
    'fagaras':               'judetul-brasov/fagaras',
    'codlea':                'judetul-brasov/codlea',
    'sacele':                'judetul-brasov/sacele',
    'odorheiu-secuiesc':     'judetul-harghita/odorheiu-secuiesc',
    'reghin':                'judetul-mures/reghin',
    'sighisoara':            'judetul-mures/sighisoara',
    'toplita':               'judetul-harghita/toplita',
    'turnu-magurele':        'judetul-teleorman/turnu-magurele',
    'rosiori-de-vede':       'judetul-teleorman/rosiori-de-vede',
    'caracal':               'judetul-olt/caracal',
    'dr-tr-severin':         'judetul-mehedinti/drobeta-turnu-severin',
    'targu-neamt':           'judetul-neamt/targu-neamt',
    'pascani':               'judetul-iasi/pascani',
    'husi':                  'judetul-vaslui/husi',
    'barlad':                'judetul-vaslui/barlad',
};

const IMOBILIARE_BASE = 'https://www.imobiliare.ro/inchirieri-apartamente';

const MAX_PAGES = 10;

const REQUEST_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
};

export type ImobiliareRawItem = {
    externalId: string | null;
    title: string | null;
    price: string | null;
    currency: string | null;
    city: string | null;
    locationId: string | null;
    surface: string | null;
    listId: string | null;
    sellerType: string | null;
    url: string | null;
    imageUrls: string[];
};

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

/** Extract the value of a single HTML attribute from a tag string. */
function attr(tag: string, name: string): string | null {
    const m = tag.match(new RegExp(`${name}="([^"]*)"`));
    return m ? decodeHtmlEntities(m[1]) : null;
}

/** Minimal HTML entity decoder for the subset used by imobiliare.ro. */
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

/**
 * Parse all listing cards from an imobiliare.ro results page.
 *
 * The site server-renders every card, including all data we need, inside
 * `data-*` attributes on the `div[data-bi="product-basic"]` element.
 * We never need to execute JavaScript — plain HTTP is enough.
 */
function parseCards(html: string): ImobiliareRawItem[] {
    const items: ImobiliareRawItem[] = [];

    // Each product card's opening tag carries all structured data.
    // The tag is one long line; regex is safe here because the attribute names
    // are stable and there is no nested `data-bi="product-basic"` inside.
    const tagPattern = /<div[^>]+data-bi="product-basic"[^>]+>/g;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(html)) !== null) {
        const tag = match[0];
        const tagPos = match.index;

        const externalId = attr(tag, 'data-id');
        const title = attr(tag, 'data-name');
        const price = attr(tag, 'data-price');
        const currency = attr(tag, 'data-bi-listing-currency');
        const city = attr(tag, 'data-city');
        const locationId = attr(tag, 'data-location-id');
        const surface = attr(tag, 'data-surface');
        const listId = attr(tag, 'data-list-id');
        const sellerType = attr(tag, 'data-sellertype');

        // Listing URL: href="/oferta/...-{listId}"
        let url: string | null = null;
        if (listId) {
            const hrefM = html.match(new RegExp(`href="(/oferta/[^"]*-${listId})"`));
            if (hrefM) url = `https://www.imobiliare.ro${hrefM[1]}`;
        }

        // Images: roamcdn CDN urls within ~6 kB after the opening tag
        const imageUrls: string[] = [];
        const section = html.slice(tagPos, tagPos + 12000);
        const imgPattern = /src="(https:\/\/i\.roamcdn\.net\/[^"]+)"/g;
        let imgM: RegExpExecArray | null;
        while ((imgM = imgPattern.exec(section)) !== null) {
            imageUrls.push(imgM[1]);
        }

        items.push({ externalId, title, price, currency, city, locationId, surface, listId, sellerType, url, imageUrls });
    }

    return items;
}

/** Determine the highest page number from pagination links in the HTML. */
function getLastPage(html: string, currentPage: number): number {
    let max = currentPage;
    const re = /[?&]page=(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
    }
    return max;
}

// ---------------------------------------------------------------------------
// Scraper
// ---------------------------------------------------------------------------

@Injectable()
export class ImobiliareRoScraper {
    async scrape(city: string, forma?: string): Promise<ImobiliareRawItem[]> {
        const cityKey = city.toLowerCase();
        const citySlug = IMOBILIARE_CITY_MAP[cityKey] ?? cityKey;
        const baseUrl = `${IMOBILIARE_BASE}/${citySlug}`;

        // imobiliare.ro has a dedicated SEO path for zero-commission / direct-owner listings:
        //   /tip/inchirieri-apartamente-comision-0-{county-slug}-{city-slug}
        // The city slug is just the normal slug with "/" replaced by "-".
        const base =
            forma === 'proprietar'
                ? `https://www.imobiliare.ro/tip/inchirieri-apartamente-comision-0-${citySlug.replace('/', '-')}`
                : baseUrl;

        const allItems: ImobiliareRawItem[] = [];
        console.log(base)

        for (let p = 1; p <= MAX_PAGES; p++) {
            const url = p === 1 ? base : `${base}?page=${p}`;

            let html: string;
            try {
                const resp = await axios.get<string>(url, {
                    headers: REQUEST_HEADERS,
                    timeout: 30000,
                    maxRedirects: 5,
                });
                html = resp.data;
            } catch (err: any) {
                console.error(`Imobiliare.ro: failed to fetch "${url}" — ${err?.message}`);
                break;
            }

            const items = parseCards(html);
            if (items.length === 0) {
                console.warn(`Imobiliare.ro: no cards on page ${p} — stopping`);
                break;
            }

            allItems.push(...items);

            const lastPage = getLastPage(html, p);
            if (p >= lastPage) break;
        }

        const filterNote = forma === 'proprietar' ? ' (zero-commission / proprietar filter)' : '';
        console.log(`Imobiliare.ro scraper: collected ${allItems.length} items for "${city}"${filterNote}`);
        return allItems;
    }
}
