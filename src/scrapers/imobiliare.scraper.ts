import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type { ImobiliareScrapedItem } from 'src/listings/listings.types';

const IMOBILIARE_CITY_MAP: Record<string, string> = {
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

function getAttributeValue(tag: string, name: string): string | null {
    const match = tag.match(new RegExp(`${name}="([^"]*)"`));
    return match ? decodeHtmlEntities(match[1]) : null;
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function parseSurfaceToSquareMeters(surfaceRaw: string | null): number | null {
    if (!surfaceRaw || surfaceRaw === 'not applicable') return null;
    const sqm = parseFloat(surfaceRaw);
    if (Number.isNaN(sqm) || sqm <= 0) return null;
    return sqm;
}

function parseCards(html: string): ImobiliareScrapedItem[] {
    const items: ImobiliareScrapedItem[] = [];

    const tagPattern = /<div[^>]+data-bi="product-basic"[^>]+>/g;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(html)) !== null) {
        const tag = match[0];
        const tagPos = match.index;

        const externalId = getAttributeValue(tag, 'data-id');
        const title = getAttributeValue(tag, 'data-name');
        const price = getAttributeValue(tag, 'data-price');
        const currency = getAttributeValue(tag, 'data-bi-listing-currency');
        const city = getAttributeValue(tag, 'data-city');
        const locationId = getAttributeValue(tag, 'data-location-id');
        const squareMeters = parseSurfaceToSquareMeters(getAttributeValue(tag, 'data-surface'));
        const listId = getAttributeValue(tag, 'data-list-id');
        const sellerType = getAttributeValue(tag, 'data-sellertype');

        let url: string | null = null;
        if (listId) {
            const hrefM = html.match(new RegExp(`href="(/oferta/[^"]*-${listId})"`));
            if (hrefM) url = `https://www.imobiliare.ro${hrefM[1]}`;
        }

        const imageUrls: string[] = [];
        const section = html.slice(tagPos, tagPos + 12000);
        const imgPattern = /src="(https:\/\/i\.roamcdn\.net\/[^"]+)"/g;
        let imgM: RegExpExecArray | null;
        while ((imgM = imgPattern.exec(section)) !== null) {
            imageUrls.push(imgM[1]);
        }

        items.push({
            externalId,
            title,
            price,
            currency,
            city,
            locationId,
            squareMeters,
            listId,
            sellerType,
            url,
            imageUrls,
        });
    }

    return items;
}

function getLastPage(html: string, currentPage: number): number {
    let max = currentPage;
    const pageRegex = /[?&]page=(\d+)/g;
    let regExpExecArray: RegExpExecArray | null;
    while ((regExpExecArray = pageRegex.exec(html)) !== null) {
        const pageNumber = parseInt(regExpExecArray[1], 10);
        if (pageNumber > max) max = pageNumber;
    }
    return max;
}

@Injectable()
export class ImobiliareRoScraper {
    async scrape(city: string, forma?: string, minRoms?: number): Promise<ImobiliareScrapedItem[]> {
        const cityKey = city.toLowerCase();
        const citySlug = IMOBILIARE_CITY_MAP[cityKey] ?? cityKey;
        const useRoomsInPath = minRoms != null && minRoms > 1;

        let base: string;
        if (forma !== 'proprietar') {
            base = useRoomsInPath
                ? `${IMOBILIARE_BASE}/${citySlug}/${minRoms}-camere`
                : `${IMOBILIARE_BASE}/${citySlug}`;
        } else if (useRoomsInPath) {
            base = `${IMOBILIARE_BASE}/${citySlug}/${minRoms}-camere?feature=zero-commission`;
        } else {
            const citySegment = citySlug.replace('/', '-');
            base = `https://www.imobiliare.ro/tip/inchirieri-apartamente-comision-0-${citySegment}`;
        }

        const allItems: ImobiliareScrapedItem[] = [];
        console.log(base)

        for (let pageToScrape = 1; pageToScrape <= MAX_PAGES; pageToScrape++) {
            const pageSep = base.includes('?') ? '&' : '?';
            const url = pageToScrape === 1 ? base : `${base}${pageSep}page=${pageToScrape}`;

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
                console.warn(`Imobiliare.ro: no cards on page ${pageToScrape} — stopping`);
                break;
            }

            allItems.push(...items);

            const lastPage = getLastPage(html, pageToScrape);
            if (pageToScrape >= lastPage) break;
        }

        const filterNote = forma === 'proprietar' ? ' (zero-commission / proprietar filter)' : '';
        console.log(`Imobiliare.ro scraper: collected ${allItems.length} items for "${city}"${filterNote}`);
        return allItems;
    }
}
