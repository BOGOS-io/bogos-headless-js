import {Money} from '@shopify/hydrogen';
import type React from 'react';
import {useEffect, useState} from 'react';

/**
 * BOGOS product discount pricing for listing pages (collection, home, search).
 *
 * The SDK's own renderProductList resolves cards by HANDLE, and handle-fetch is
 * disabled when isHeadless -- so it renders nothing here. We compute instead
 * from FGSECOMAPP.discounts + BOGOS.block_products, which IS populated.
 *
 * Ported from discount.js, SDK build 20260722-1784688973. Keep in sync.
 */

const DISCOUNT_APPLY_TYPE = {
  percentage: 'percentage',
  fixed_amount: 'fixed_amount',
  fixed_price: 'fixed_price',
} as const;

const DEFAULT_COLORS = {
  discount_label_color: '#FFBB4E',
  discount_label_text_color: '#000000',
  discount_price_color: '#2332D5',
  number_wrap_color: '#808080',
};

const DEFAULT_LABEL = '{{discount_amount}} OFF';

type MoneyData = React.ComponentProps<typeof Money>['data'];

type BogosDiscountResult = {
  salePrice: number;
  originalPrice: number;
  badgeLabel: string | null;
  showSalePrice: boolean;
  config: SurfaceConfig;
};

/** Same shape productDiscount.getSurfaceCfg returns. */
type SurfaceConfig = {
  status: boolean;
  display_discount_price: {status: boolean; font_size: number; style: string};
  display_original_price: {
    font_size: number;
    style: string;
    line_through: boolean;
  };
  discount_label: {status: boolean; label: string};
};

/**
 * Ported from getSurfaceCfg(PRODUCT_LIST). The list has its own config under
 * price_display.product_list -- the top-level keys are the product-page tier.
 * Master switch defaults ON, product_list defaults OFF (absent means off).
 */
function getProductListConfig(): SurfaceConfig {
  const OFF: SurfaceConfig = {
    status: false,
    display_discount_price: {status: false, font_size: 14, style: 'bold'},
    display_original_price: {font_size: 12, style: 'normal', line_through: true},
    discount_label: {status: false, label: DEFAULT_LABEL},
  };

  const pdGeneral =
    window.FGSECOMAPP?.fgAppearance?.product_discount?.general?.price_display ??
    {};

  if (pdGeneral?.status === false) return OFF;

  const listCfg = pdGeneral?.product_list;
  if (!listCfg || Object.keys(listCfg).length === 0) return OFF;

  return {
    status: listCfg?.status ?? false,
    display_discount_price: {
      status: listCfg?.display_discount_price?.status ?? true,
      font_size: listCfg?.display_discount_price?.font_size ?? 14,
      style: listCfg?.display_discount_price?.style ?? 'bold',
    },
    display_original_price: {
      font_size: listCfg?.display_original_price?.font_size ?? 12,
      style: listCfg?.display_original_price?.style ?? 'normal',
      line_through: listCfg?.display_original_price?.line_through ?? true,
    },
    discount_label: {
      status: listCfg?.discount_label?.status ?? true,
      label: listCfg?.discount_label?.label ?? DEFAULT_LABEL,
    },
  };
}

/** gid://shopify/Product/123 -> 123 */
function toLegacyId(id: string | number | undefined | null): number {
  if (id === undefined || id === null) return 0;
  const last = String(id).split('/').pop() ?? '';
  const parsed = Number(last.split('?')[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Ported from convertDiscountMarket: converts a value to the active currency. */
function convertDiscountValue(entry: any, utils: any): number {
  const activeCurrency =
    window.FGSECOMAPP?.variables?.Shopify?.currency?.active;
  const matched = entry?.other_currencies?.find(
    (item: any) => item.currency === activeCurrency,
  );

  const converted = utils?.convertMultiCurrency
    ? utils.convertMultiCurrency(entry.value)
    : entry.value;

  const {fixed_amount, fixed_price} = DISCOUNT_APPLY_TYPE;
  if ([fixed_amount, fixed_price].includes(entry.type)) {
    return matched?.value ?? converted;
  }
  return converted;
}

/** Ported from calculateDiscountPrice ('total' mode). */
function calculateDiscountPrice(
  entry: any,
  basePrice: number,
  utils: any,
): number {
  const converted = convertDiscountValue(entry, utils);
  const decimal = window.FGSECOMAPP?.variables?.Shopify?.fg_decimal ?? 2;

  let result: number;
  switch (entry.type) {
    case DISCOUNT_APPLY_TYPE.percentage:
      result = (basePrice * (100 - entry.value)) / 100;
      break;
    case DISCOUNT_APPLY_TYPE.fixed_amount:
      result = Math.max(0, basePrice - converted);
      break;
    case DISCOUNT_APPLY_TYPE.fixed_price:
      result = Math.min(converted, basePrice);
      break;
    default:
      result = basePrice;
  }
  return parseFloat(result.toFixed(decimal));
}

/** Ported from getCountdownEndTime: a recurring offer outside its window is off. */
function isOfferActive(offer: any): boolean {
  if (!offer?.recurring_status) return true;
  const recurringHandler = window.FGSECOMAPP?.helper?.recurring_handler;
  const end = recurringHandler?.getActiveWindowEnd?.(
    offer.recurring,
    undefined,
    offer.start_time,
  );
  return Boolean(end);
}

/** Ported from selectBestOffer: largest savings wins. */
function selectBestOffer(offers: any[], basePrice: number, utils: any) {
  let best: {
    offer: any;
    entry: any;
    savings: number;
    discountedPrice: number;
    cappedAmount: number | null;
  } | null = null;

  for (const offer of offers) {
    const entry = offer?.discount?.[0];
    if (!entry) continue;

    let discountedPrice = calculateDiscountPrice(entry, basePrice, utils);
    let cappedAmount: number | null = null;

    // percentage with max_amount: never discount beyond the cap
    if (entry.type === DISCOUNT_APPLY_TYPE.percentage && entry.max_amount) {
      const maxAmount = convertDiscountValue(
        {
          type: DISCOUNT_APPLY_TYPE.fixed_amount,
          value: entry.max_amount,
          other_currencies: entry.max_amount_other_currencies ?? [],
        },
        utils,
      );
      if (basePrice - discountedPrice > maxAmount) {
        discountedPrice = basePrice - maxAmount;
        cappedAmount = maxAmount;
      }
    }

    // round the cents to the configured ending (e.g. 0.99)
    if (entry.override_cents != null && discountedPrice < basePrice) {
      discountedPrice = Math.floor(discountedPrice) + entry.override_cents / 100;
    }

    const savings = basePrice - discountedPrice;
    if (savings > 0 && (!best || savings > best.savings)) {
      best = {offer, entry, savings, discountedPrice, cappedAmount};
    }
  }

  return best;
}

/** Builds the variant rows the SDK's findProductsMatchConditions expects. */
function buildVariantRows(info: any) {
  return (info?.variants ?? []).map((variant: any) => ({
    variant_id: variant.id,
    product_id: info.id,
    product_title: info.title,
    price: variant.price,
    variant_title: variant.title,
    handle: info.handle,
    vendor: info.vendor,
    product_type: info.type,
    collections: info.collections,
  }));
}

function computeDiscount(productId: string): BogosDiscountResult | null {
  const fg = window.FGSECOMAPP;
  const utils = fg?.helper?.utils;
  if (!fg || !utils?.findProductsMatchConditions) return null;

  // product-list price display turned off in the app settings
  const config = getProductListConfig();
  if (!config.status) return null;

  const legacyId = toLegacyId(productId);
  if (!legacyId) return null;

  // searchProductsBlock('product_discount') loads full product info here
  const info =
    window.BOGOS?.block_products?.[legacyId] ?? fg.productsByID?.[legacyId];
  if (!info?.variants?.length) return null;

  const productOffers = (fg.discounts ?? []).filter(
    (offer: any) => offer?.type === 'product' && isOfferActive(offer),
  );
  if (!productOffers.length) return null;

  const variantRows = buildVariantRows(info);
  const matchConditions = utils.findProductsMatchConditions;
  const eligible = productOffers.filter(
    (offer: any) =>
      (matchConditions(variantRows, {
        product_narrow: offer?.condition?.products,
      })?.length ?? 0) > 0,
  );
  if (!eligible.length) return null;

  // 1 on headless (GraphQL decimals), 100 on a theme (cart.js cents).
  // Default to the SDK's own 100 so a wrong value is visible, not 100x off.
  const ratePrice = fg.variables?.RATE_PRICE ?? 100;
  const originalPrice =
    (info.current_variant?.price ?? info.variants[0]?.price ?? 0) / ratePrice;
  if (!originalPrice) return null;

  const best = selectBestOffer(eligible, originalPrice, utils);
  if (!best) return null;

  const badgeLabel = buildBadgeLabel(best, originalPrice, config, utils);
  const showSalePrice = config.display_discount_price.status;

  // merchant hid the price and there is no badge either
  if (!showSalePrice && !badgeLabel) return null;

  return {
    salePrice: best.discountedPrice,
    originalPrice,
    badgeLabel,
    showSalePrice,
    config,
  };
}

function buildBadgeLabel(
  best: {entry: any; savings: number; cappedAmount: number | null},
  originalPrice: number,
  config: SurfaceConfig,
  utils: any,
): string | null {
  const labelConfig = config.discount_label;
  if (!labelConfig.status) return null;

  let amount = '';
  if (best.entry.type === DISCOUNT_APPLY_TYPE.percentage) {
    amount = best.cappedAmount
      ? `${Math.round((best.cappedAmount / originalPrice) * 100)}%`
      : `${best.entry.value}%`;
  } else if (best.savings > 0) {
    amount = formatPrice(best.savings, utils);
  }
  if (!amount) return null;

  return (labelConfig.label ?? DEFAULT_LABEL).replace(
    '{{discount_amount}}',
    amount,
  );
}

function formatPrice(amount: number, utils: any): string {
  try {
    return utils?.renderPrice ? utils.renderPrice(amount) : String(amount);
  } catch {
    return String(amount);
  }
}

/** Null while the SDK loads or when no offer matches -- caller shows base price. */
export function useBogosProductDiscount(
  productId: string,
): BogosDiscountResult | null {
  const [discount, setDiscount] = useState<BogosDiscountResult | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const recompute = () => {
      try {
        setDiscount(computeDiscount(productId));
      } catch (error) {
        console.warn('BOGOS track: product discount on card failed', error);
        setDiscount(null);
      }
    };

    // fires at the end of every render pass, so block_products is ready
    document.addEventListener('bogos:product-discount-render', recompute);
    // SDK finished booting after this card mounted
    document.addEventListener('fg-app:end', recompute);

    // ...or before it mounted
    recompute();

    return () => {
      document.removeEventListener('bogos:product-discount-render', recompute);
      document.removeEventListener('fg-app:end', recompute);
    };
  }, [productId]);

  return discount;
}

/**
 * Tells BOGOS to re-read the cards on the page. Card matching only runs on
 * 'bogos:discount-init', so cards rendered after boot (client-side navigation,
 * pagination, filters) stay invisible until this fires.
 *
 * Call from every page rendering a product list. Debounced 250ms by the SDK,
 * so one dispatch per render pass covers every card in it.
 */
export function useBogosProductListSync(listKey: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.dispatchEvent(new CustomEvent('bogos:discount-init'));
  }, [listKey]);
}

/** Stable key for useBogosProductListSync. */
export function bogosListKey(
  products: ReadonlyArray<{id: string}> | undefined | null,
): string {
  return (products ?? []).map((product) => product.id).join(',');
}

/**
 * Card price that swaps to the discounted price when BOGOS has an offer.
 * The marker div is how the SDK finds the card -- a class, not an id, because
 * a page holds many.
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
  const discount = useBogosProductDiscount(productId);
  const utils =
    typeof window !== 'undefined' ? window.FGSECOMAPP?.helper?.utils : null;

  const colors =
    (typeof window !== 'undefined'
      ? window.FGSECOMAPP?.fgAppearance?.product_discount?.color?.price_display
      : null) ?? {};

  // from computeDiscount, so sizes follow the product-list settings
  const saleStyle = discount?.config.display_discount_price;
  const originalStyle = discount?.config.display_original_price;

  return (
    <>
      <div
        className="bogos-integration-page-builder-product-discount"
        data-product-id={productId}
        data-product-handle={productHandle}
      />
      {discount ? (
        <div className="bogos-pd-price-display">
          {discount.showSalePrice && saleStyle && originalStyle && (
            <>
              <span
                className="bogos-pd-price-sale transcy-money"
                style={{
                  color:
                    colors.discount_price_color ??
                    DEFAULT_COLORS.discount_price_color,
                  fontSize: `${saleStyle.font_size}px`,
                  fontWeight: saleStyle.style === 'bold' ? 700 : 400,
                }}
              >
                {formatPrice(discount.salePrice, utils)}
              </span>
              <span
                className="bogos-pd-price-original transcy-money"
                style={{
                  color:
                    colors.number_wrap_color ?? DEFAULT_COLORS.number_wrap_color,
                  fontSize: `${originalStyle.font_size}px`,
                  fontWeight: originalStyle.style === 'bold' ? 700 : 400,
                  textDecoration: originalStyle.line_through
                    ? 'line-through'
                    : 'none',
                }}
              >
                {formatPrice(discount.originalPrice, utils)}
              </span>
            </>
          )}
          {discount.badgeLabel && (
            <span
              className="bogos-pd-price-badge"
              style={{
                background:
                  colors.discount_label_color ?? DEFAULT_COLORS.discount_label_color,
                color:
                  colors.discount_label_text_color ??
                  DEFAULT_COLORS.discount_label_text_color,
              }}
            >
              {discount.badgeLabel}
            </span>
          )}
        </div>
      ) : (
        price && <Money data={price} />
      )}
    </>
  );
}
