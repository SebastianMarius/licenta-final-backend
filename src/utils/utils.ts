import { extractStoriaImageUrls } from 'src/listings/listings-mapper';

function formatStoriaAddress(location: unknown): string {
    const loc = location as {
        address?: {
            street?: { name?: string | null } | null;
            city?: { name?: string | null } | null;
            province?: { name?: string | null } | null;
        } | null;
    } | null;
    const address = loc?.address;
    if (!address) return '';

    const parts = [address.street?.name, address.city?.name, address.province?.name]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean);
    return parts.join(', ');
}

export function normaliseStoria(storiaList) {
    return storiaList.map((listing) => {
        const { images, ...listingWithoutImages } = listing;
        const imageUrls = extractStoriaImageUrls(images);

        const sqmRaw = listing.areaInSquareMeters;
        const squareMeters =
            typeof sqmRaw === 'number' && Number.isFinite(sqmRaw) ? sqmRaw : null;

        const totalPrice = listing.totalPrice;
        const rawPrice =
            typeof totalPrice === 'object' && totalPrice != null && 'value' in totalPrice
                ? totalPrice.value
                : typeof totalPrice === 'number'
                  ? totalPrice
                  : null;
        const price =
            rawPrice != null && Number.isFinite(Number(rawPrice))
                ? String(rawPrice)
                : null;

        return {
            ...listingWithoutImages,
            price,
            location: formatStoriaAddress(listing.location),
            date: listing.dateCreated,
            squareMeters,
            imageUrls,
        };
    });
}
