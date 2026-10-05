import {Money} from '@shopify/hydrogen';
import type React from 'react';
import {useEffect} from 'react';

/**
 * Product discount on listing pages (collection, home, search).
 *
 * The SDK renders everything itself -- the discounted price and the badge over
 * the card image. All this file does is give it the hooks it needs:
 *
 *   - the marker div below, so the SDK can resolve a card to a product
 *   - `.bogos-card-media` on the box holding the image (badge goes there)
 *   - `.bogos-card-price` around the native price (SDK hides it, inserts its own)
 *   - a `bogos:discount-init` dispatch whenever the list changes
 *
 * The two class names are registered with the SDK in root.tsx, via
 * Shopify.scaHandleConfigValue -- the same mechanism a theme uses.
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
      <div
        className="bogos-integration-page-builder-product-discount"
        data-product-id={productId}
        data-product-handle={productHandle}
      />
      <span className="bogos-card-price">{price && <Money data={price} />}</span>
    </>
  );
}
