import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export type RecommendedListingItem = {
    listing: unknown;
    similarityScore: number;
    reasons: string[];
};

export type RecommendedListingsResponse = {
    recommendations: RecommendedListingItem[];
};

const LISTINGS_PAYLOAD_KEYS = ['olx', 'storia', 'publi24', 'imobiliare'] as const;

function toListingArray(listings: unknown): unknown[] {
    if (Array.isArray(listings)) {
        return listings;
    }
    if (listings && typeof listings === 'object') {
        const o = listings as Record<string, unknown>;
        const merged = LISTINGS_PAYLOAD_KEYS.flatMap((k) =>
            Array.isArray(o[k]) ? o[k] : [],
        );
        if (merged.length > 0) {
            return merged as unknown[];
        }
    }
    return [];
}

function listingDedupeKey(listing: unknown): string | null {
    if (!listing || typeof listing !== 'object') {
        return null;
    }
    const o = listing as Record<string, unknown>;
    const url = o.url ?? o.link;
    if (typeof url === 'string' && url.length > 0) {
        return `url:${url}`;
    }
    const ext = o.externalId ?? o.id ?? o.listId;
    if (ext != null && String(ext).length > 0) {
        return `id:${String(ext)}`;
    }
    return null;
}

function isSameListing(a: unknown, b: unknown): boolean {
    const ka = listingDedupeKey(a);
    const kb = listingDedupeKey(b);
    return ka != null && kb != null && ka === kb;
}

type ModelRecommendationRow = {
    index: number;
    similarityScore: number;
    reasons: string[];
};

function parseModelJson(text: string): { recommendations: ModelRecommendationRow[] } {
    const trimmed = text.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
    const jsonStr = fence ? fence[1].trim() : trimmed;
    const parsed = JSON.parse(jsonStr) as { recommendations?: ModelRecommendationRow[] };
    return {
        recommendations: Array.isArray(parsed.recommendations)
            ? parsed.recommendations
            : [],
    };
}

@Injectable()
export class AssistantService {
    private model: GenerativeModel;

    constructor(private readonly config: ConfigService) {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is missing');
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        this.model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
        });
    }

    async getRecommendedListings(
        providedListing: unknown,
        listings: unknown,
    ): Promise<RecommendedListingsResponse> {
        const all = toListingArray(listings);
        const candidates = all.filter((item) => !isSameListing(providedListing, item));
        const capped = candidates.slice(0, 80);

        if (capped.length === 0) {
            return { recommendations: [] };
        }

        const indexed = capped.map((listing, index) => ({ index, listing }));

        const prompt = `You compare rental apartment listings for similarity.

        REFERENCE LISTING (what the user is viewing):
        ${JSON.stringify(providedListing)}
        
        CANDIDATE LISTINGS (each object has "index" and "listing"):
        ${JSON.stringify(indexed)}
        
        Context:
        - Candidates have already been pre-filtered to a similar price band, so do
          NOT base your scoring on price differences alone.
        - Focus on: neighborhood / address / area of the city, apartment size in m²,
          number of rooms (look at "roomsNumber" and at hints in title/description
          like "studio", "garsoniera", "2 camere", etc.), and any qualitative cues
          in the description (renovated, furnished, parking, central, etc.).
        
        Task:
        - Pick candidates that genuinely resemble the reference on those dimensions.
        - Omit weak or unrelated matches.
        
        Respond with JSON only (no markdown), exactly this shape:
        {"recommendations":[{"index":number,"similarityScore":number,"reasons":["short bullet reason"]}]}
        
        Rules:
        - "index" must match a candidate's index from the array above.
        - "similarityScore" is an integer from 0 to 100.
        - Each "reasons" entry is a short Romanian phrase (max ~8 words) explaining
          the match, e.g. "Aceeași zonă, suprafață similară" or "Tot 2 camere, mobilat".
        - Include at most 12 entries, sorted by similarityScore descending.
        - Only include similarityScore >= 45. If there are zero such matches,
          return {"recommendations":[]}.
        `;

        const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
            },
        });

        const text = result.response.text();
        let parsed: { recommendations: ModelRecommendationRow[] };
        try {
            parsed = parseModelJson(text);
        } catch {
            return { recommendations: [] };
        }

        const rows = parsed.recommendations
            .filter(
                (r) =>
                    typeof r.index === 'number' &&
                    r.index >= 0 &&
                    r.index < capped.length &&
                    typeof r.similarityScore === 'number',
            )
            .map((r) => ({
                ...r,
                reasons: Array.isArray(r.reasons)
                    ? r.reasons.filter((x) => typeof x === 'string')
                    : [],
            }))
            .filter((r) => r.similarityScore >= 45)
            .sort((a, b) => b.similarityScore - a.similarityScore);

        const recommendations: RecommendedListingItem[] = rows.map((r) => ({
            listing: capped[r.index],
            similarityScore: Math.min(100, Math.max(0, Math.round(r.similarityScore))),
            reasons: r.reasons,
        }));

        return { recommendations };
    }
}
