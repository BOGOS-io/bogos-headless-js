import {Money} from '@shopify/hydrogen';
import type React from 'react';
import {useEffect} from 'react';

/**
 * Product discount on listing pages (collection, home, search).
 *
 * The SDK renders everything itself -- the discounted price and the badge over
 * the card image. It finds the pieces by CSS class, so the cards just have to
 * use the class names it already looks for:
 *
 *   - `.fg-secomapp-collection-img` on the card (already there for gift icons)
 *   - `.bogos-product-card-media` on the box holding the image -- the badge
 *     goes there
 *   - `.bogos-product-card-price` around the native price -- the SDK hides it
 *     and inserts its own
 *
 * The last two are BOGOS' own marker classes, matched ahead of the theme
 * selectors the SDK falls back to (`.card__media`, `.price`, ...), so renaming
 * this storefront's CSS cannot silently break the integration.
 *
 * Plus the marker div below, and a `bogos:discount-init` dispatch when the list
 * changes.
 */

type MoneyData = React.ComponentProps<typeof Money>['data'];

/**
 * Re-matches the cards on the page. Card matching only runs on
 * 'bogos:discount-init', so cards rendered after boot stay invisible until this
 * fires. Call from every page rendering a product list.
 */
export function useBogosProductListSync(listKey: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.dispatchEvent(new CustomEvent('bogos:discount-init'));
  }, [listKey]);
}

export function bogosListKey(
  products: ReadonlyArray<{id: string}> | undefined | null,
): string {
  return (products ?? []).map((product) => product.id).join(',');
}

/**
 * Marks a product card for BOGOS and renders its native price.
 *
 * Both attributes on the marker are required: the SDK matches on the handle and
 * keys the result by id.
 */
export function BogosProductDiscountPrice({
  productId,
  productHandle,
  price,
}: {
  productId: string;
  productHandle: string;
  price?: MoneyData | null;
}) {
  return (
    <>
      <span className="price bogos-product-card-price">
        {price && <Money data={price} />}
      </span>
    </>
  );
}
