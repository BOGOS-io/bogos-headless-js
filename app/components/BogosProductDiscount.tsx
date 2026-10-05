import {Money} from '@shopify/hydrogen';
import type React from 'react';
import {useEffect, useRef, useState} from 'react';

/**
 * Product discount on listing pages. The SDK's renderProductList resolves cards
 * by handle, which is disabled on headless, so we compute it here instead.
 * Ported from discount.js, SDK build 20260722-1784688973.
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

const LABEL_POSITIONS = [
  'image_top_left',
  'image_top_right',
  'image_bottom_left',
  'image_bottom_right',
] as const;
type LabelPosition = (typeof LABEL_POSITIONS)[number];
const DEFAULT_POSITION: LabelPosition = 'image_top_right';

/** Below this an element is an icon, not product media. */
const MIN_CARD_MEDIA_WIDTH = 80;

type MoneyData = React.ComponentProps<typeof Money>['data'];

type BogosDiscountResult = {
  salePrice: number;
  originalPrice: number;
  badgeLabel: string | null;
  showSalePrice: boolean;
  config: SurfaceConfig;
};

type SurfaceConfig = {
  status: boolean;
  display_discount_price: {status: boolean; font_size: number; style: string};
  display_original_price: {
    font_size: number;
    style: string;
    line_through: boolean;
  };
  discount_label: {status: boolean; label: string; position: LabelPosition};
};

/**
 * getSurfaceCfg(PRODUCT_LIST). The list tier is price_display.product_list;
 * top-level keys are the product page. Master defaults ON, list defaults OFF.
 */
function getProductListConfig(): SurfaceConfig {
  const OFF: SurfaceConfig = {
    status: false,
    display_discount_price: {status: false, font_size: 14, style: 'bold'},
    display_original_price: {font_size: 12, style: 'normal', line_through: true},
    discount_label: {
      status: false,
      label: DEFAULT_LABEL,
      position: DEFAULT_POSITION,
    },
  };

  const pdGeneral =
    window.FGSECOMAPP?.fgAppearance?.product_discount?.general?.price_display ??
    {};

  if (pdGeneral?.status === false) return OFF;

  const listCfg = pdGeneral?.product_list;
  if (!listCfg || Object.keys(listCfg).length === 0) return OFF;

  const rawPosition = listCfg?.discount_label?.position;

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
      position: LABEL_POSITIONS.includes(rawPosition as LabelPosition)
        ? (rawPosition as LabelPosition)
        : DEFAULT_POSITION,
    },
  };
}

function toLegacyId(id: string | number | undefined | null): number {
  if (id === undefined || id === null) return 0;
  const last = String(id).split('/').pop() ?? '';
  const parsed = Number(last.split('?')[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** convertDiscountMarket */
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

/** calculateDiscountPrice, 'total' mode. */
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

/** A recurring offer outside its active window does not apply. */
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

/** selectBestOffer: largest savings wins. */
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

/** Rows in the shape findProductsMatchConditions expects. */
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

  const config = getProductListConfig();
  if (!config.status) return null;

  const legacyId = toLegacyId(productId);
  if (!legacyId) return null;

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

  // 1 on headless, 100 on a theme. Default to the SDK's own 100.
  const ratePrice = fg.variables?.RATE_PRICE ?? 100;
  const originalPrice =
    (info.current_variant?.price ?? info.variants[0]?.price ?? 0) / ratePrice;
  if (!originalPrice) return null;

  const best = selectBestOffer(eligible, originalPrice, utils);
  if (!best) return null;

  const badgeLabel = buildBadgeLabel(best, originalPrice, config, utils);
  const showSalePrice = config.display_discount_price.status;

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

/** Null while the SDK loads or when no offer matches. */
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

    document.addEventListener('bogos:product-discount-render', recompute);
    document.addEventListener('fg-app:end', recompute);

    recompute();

    return () => {
      document.removeEventListener('bogos:product-discount-render', recompute);
      document.removeEventListener('fg-app:end', recompute);
    };
  }, [productId]);

  return discount;
}

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
 * Card price. The marker div is how the SDK finds the card. Price only -- the
 * badge goes over the media, see BogosProductDiscountBadge.
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

  const saleStyle = discount?.config.display_discount_price;
  const originalStyle = discount?.config.display_original_price;
  const showPrice = Boolean(
    discount?.showSalePrice && saleStyle && originalStyle,
  );

  return (
    <>
      <div
        className="bogos-integration-page-builder-product-discount"
        data-product-id={productId}
        data-product-handle={productHandle}
      />
      {showPrice && discount ? (
        <div className="bogos-pd-card-price">
          <span
            className="bogos-pd-price-sale transcy-money"
            style={{
              color:
                colors.discount_price_color ??
                DEFAULT_COLORS.discount_price_color,
              fontSize: `${saleStyle!.font_size}px`,
              fontWeight: saleStyle!.style === 'bold' ? 700 : 400,
            }}
          >
            {formatPrice(discount.salePrice, utils)}
          </span>
          <span
            className="bogos-pd-price-original transcy-money"
            style={{
              color:
                colors.number_wrap_color ?? DEFAULT_COLORS.number_wrap_color,
              fontSize: `${originalStyle!.font_size}px`,
              fontWeight: originalStyle!.style === 'bold' ? 700 : 400,
              textDecoration: originalStyle!.line_through
                ? 'line-through'
                : 'none',
            }}
          >
            {formatPrice(discount.originalPrice, utils)}
          </span>
        </div>
      ) : (
        price && <Money data={price} />
      )}
    </>
  );
}

/**
 * Discount badge, overlaid on the card media at `discount_label.position`.
 * Render it as the LAST child of the element holding the image -- it positions
 * itself against its parent. No usable image falls back to inline (--no-media).
 */
export function BogosProductDiscountBadge({productId}: {productId: string}) {
  const discount = useBogosProductDiscount(productId);
  const badgeRef = useRef<HTMLDivElement>(null);

  const colors =
    (typeof window !== 'undefined'
      ? window.FGSECOMAPP?.fgAppearance?.product_discount?.color?.price_display
      : null) ?? {};

  const label = discount?.badgeLabel ?? null;
  const [hasMedia, setHasMedia] = useState(true);

  useEffect(() => {
    const badge = badgeRef.current;
    const card = badge?.parentElement;
    if (!badge || !card) return;

    if (!label) {
      card.classList.remove('bogos-pd-price-dp-collection');
      card.style.removeProperty('--bogos-pd-media-h');
      return;
    }

    card.classList.add('bogos-pd-price-dp-collection');
    if (getComputedStyle(card).position === 'static') {
      card.style.setProperty('position', 'relative');
    }

    const mediaImg = Array.from(card.querySelectorAll('img'))
      .filter((img) => !img.closest('button, [role="button"]'))
      .reduce<HTMLImageElement | null>(
        (widest, img) => (img.offsetWidth > (widest?.offsetWidth ?? 0) ? img : widest),
        null,
      );

    if (mediaImg && mediaImg.offsetWidth >= MIN_CARD_MEDIA_WIDTH) {
      const height =
        mediaImg.getBoundingClientRect().bottom -
        card.getBoundingClientRect().top;
      card.style.setProperty('--bogos-pd-media-h', `${Math.round(height)}px`);
      setHasMedia(true);
    } else {
      card.style.removeProperty('--bogos-pd-media-h');
      setHasMedia(false);
    }
  }, [label]);

  if (!label) return <div ref={badgeRef} hidden />;

  const positionClass = `bogos-pd-card-badge--${discount!.config.discount_label.position.replace(/_/g, '-')}`;

  return (
    <div
      ref={badgeRef}
      className={`bogos-pd-card-badge ${positionClass}${
        hasMedia ? '' : ' bogos-pd-card-badge--no-media'
      }`}
      style={{
        background:
          colors.discount_label_color ?? DEFAULT_COLORS.discount_label_color,
        color:
          colors.discount_label_text_color ??
          DEFAULT_COLORS.discount_label_text_color,
      }}
    >
      {label}
    </div>
  );
}
