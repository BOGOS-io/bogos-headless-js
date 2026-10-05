/// <reference types="@remix-run/dev" />
/// <reference types="@shopify/remix-oxygen" />
/// <reference types="@shopify/oxygen-workers-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

import type {Storefront, HydrogenCart} from '@shopify/hydrogen';
import type {HydrogenSession} from './server';

declare global {
  /**
   * A global `process` object is only available during build to access NODE_ENV.
   */
  const process: {env: {NODE_ENV: 'production' | 'development'}};

  /**
   * Declare expected Env parameter in fetch handler.
   */
  interface Env {
    SESSION_SECRET: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
    PRIVATE_STOREFRONT_API_TOKEN: string;
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_ID: string;
    CURRENCY_CODE: string;
    BOGOS_ACCESS_TOKEN: string;
    BOGOS_JS_SDK: string;
    APP_ENV: string;
  }

  interface Window {
    BOGOS: any;
    /**
     * Internal BOGOS SDK global. Not part of the public API, so every access
     * must use optional chaining: the SDK loads async from the CDN and the
     * shape can change on an SDK update.
     *
     * Mirrors `interface FGSECOMAPP` in the backend's
     * `freegifts-be/resources/js/bogos.ts`, plus the fields that exist at
     * runtime but are missing there (`helper.utils`, `helper.proxy`,
     * `variables.RATE_PRICE`, `variables.isHeadless`, `upsells`, `boosters`,
     * the `current_*` buffers). Synced against SDK build 20260722-1784688973.
     */
    FGSECOMAPP?: {
      /* --- offer data, loaded from fgData --- */
      offers?: any[];
      bundles?: any[];
      upsells?: any[];
      /** Active discount offers: volume / product / cheapest / cart. */
      discounts?: any[];
      boosters?: any[];
      offer_pages?: any[];

      /* --- resolved config, mirrors fgData.* --- */
      fgSettings?: Record<string, any>;
      fgAppearance?: {
        product_discount?: {
          general?: {
            price_display?: {
              /** Master switch; false turns the feature off everywhere. */
              status?: boolean;
              product_page_status?: boolean;
              display_discount_price?: {
                status?: boolean;
                font_size?: number;
                style?: string;
              };
              display_original_price?: {
                font_size?: number;
                style?: string;
                line_through?: boolean;
              };
              discount_label?: {status?: boolean; label?: string};
              /**
               * Listing-page tier (collection / home / search), separate from
               * the product-page fields above. Absent means the merchant left
               * listing-page prices off -- see getSurfaceCfg in discount.js.
               */
              product_list?: {
                status?: boolean;
                display_discount_price?: {
                  status?: boolean;
                  font_size?: number;
                  style?: string;
                };
                display_original_price?: {
                  font_size?: number;
                  style?: string;
                  line_through?: boolean;
                };
                discount_label?: {
                  status?: boolean;
                  label?: string;
                  position?: string;
                };
              };
            };
          };
          color?: {
            price_display?: {
              discount_price_color?: string;
              discount_label_color?: string;
              discount_label_text_color?: string;
              number_wrap_color?: string;
              [key: string]: any;
            };
            [key: string]: any;
          };
          [key: string]: any;
        };
        [key: string]: any;
      };
      fgTranslation?: Record<string, any>;
      fgIntegration?: Record<string, any>;
      storefront?: Record<string, any>;
      integratedApps?: Record<string, any>;

      /* --- product cache --- */
      /** Keyed by product HANDLE. Stays empty on a headless storefront. */
      productsInPage?: Record<string, any>;
      /** Keyed by legacy product id. Populated on headless. */
      productsByID?: Record<string, any>;
      productsDefaultByID?: Record<string, any>;
      giftMatchOptionsByID?: Record<string, any>;

      /* --- cart state --- */
      cartItems?: any[];
      SHOPIFY_CART?: Record<string, any>;
      arrOfferAdded?: any[];
      bogos_discounts_apply?: any[];

      variables?: {
        /**
         * Price scale factor: 1 on headless (the Storefront API returns
         * decimals), 100 on an Online Store theme (cart.js returns cents).
         * Never hard-code it.
         */
        RATE_PRICE?: number;
        isHeadless?: boolean;
        isCheckout?: boolean;
        isCartPage?: boolean;
        Shopify?: {
          shop?: string;
          locale?: string;
          country?: string;
          currency?: {active?: string; rate?: number; [key: string]: any};
          current_product?: Record<string, any>;
          current_collection?: Record<string, any>;
          /** Decimal places used when formatting money. */
          fg_decimal?: number;
          sca_fg_price?: 'discounted_price' | 'price' | 'final_price';
          [key: string]: any;
        };
        constants?: Record<string, any>;
        conditions?: Record<string, any>;
        scaHandleConfigValue?: Record<string, any>;
        integration_apps?: string[];
        giftIds?: any[];
        maxOfferPriority?: number;
        bogos_added_gift?: number;
        bogos_total_gift?: number;
        sca_fg_codes?: string[];
        sca_bundle_codes?: string[];
        sca_upsell_codes?: string[];
        sca_discount_codes?: string[];
        [key: string]: any;
      };

      helper?: {
        utils?: {
          /** Filters products against an offer's `product_narrow` condition. */
          findProductsMatchConditions?: (
            items: any[],
            condition: {product_narrow?: any; [key: string]: any},
            options?: any,
          ) => any[];
          /** Formats a money amount with the shop's locale + currency. */
          renderPrice?: (amount: number) => string;
          /** Converts an amount into the active market currency. */
          convertMultiCurrency?: (value: number) => number;
          /** Applies one discount entry to a base price. */
          calculateDiscountPrice?: (
            entry: any,
            basePrice: number,
            mode?: string,
          ) => number | string;
          /** Strips `gid://shopify/...` down to the legacy numeric id. */
          getIntShopifyId?: (id: string | number | null) => string | number;
          getDataConfigSetting?: (key: string) => any;
          empty?: (data: any) => boolean;
          [key: string]: any;
        };
        /** Recurring-offer time windows. */
        recurring_handler?: {
          /** Current active window's end, or null when outside it. */
          getActiveWindowEnd?: (
            recurring: any,
            end?: unknown,
            startTime?: string | Date,
          ) => Date | null;
          [key: string]: any;
        };
        /** Storefront GraphQL calls. */
        storefront?: Record<string, any>;
        /** Product fetching + caching (`cacheProducts`, ...). */
        proxy?: Record<string, any>;
        /** Third-party app integrations (Judgeme, Transcy, Trustoo, ...). */
        integration?: Record<string, any>;
        /** Gift popup / slider customisation hooks. */
        customize?: Record<string, any>;
        /** Analytics: session_view / add_to_cart to collect.bogos.io. */
        collect?: Record<string, any>;
        /** Template renderer used by every widget. */
        templateHTML?: Record<string, any>;
        formatter?: Intl.NumberFormat;
        LZString?: Record<string, any>;
        [key: string]: any;
      };

      /** Event-name constants the SDK dispatches on `document`. */
      CUSTOM_EVENTS?: {
        START_RENDER_APP?: string;
        END_RENDER_APP?: string;
        BOGOS_FETCH_CART?: string;
        GIFT_UPDATED?: string;
        SHOW_GIFT_SLIDER?: string;
        BOGOS_FG_CART_MESSAGE?: string;
        BOGOS_CART_CHANGE?: string;
        BOGOS_PRODUCT_CHANGE?: string;
        BOGOS_ITEMS_ADDED?: string;
        [key: string]: any;
      };

      /** Selector lists per widget type, used to find view divs on the page. */
      QUERY_SELECTOR?: Record<string, Record<string, string[]>>;

      /* --- per-render buffers, written by each widget's filter() pass --- */
      current_product_discounts?: any[];
      current_cart_discounts?: any[];
      current_cheapest_discounts?: any[];
      current_volume_discounts?: any[];
      current_bundles?: any[];
      current_bundles_mix_match?: any[];
      current_bundles_quantity_break?: any[];
      current_bundles_product_page?: any[];
      current_bundles_page?: any[];
      current_bundles_child_widget?: any[];
      current_upsells_fbt?: any[];
      current_progressing_bars?: any[];
      current_announcement_bars?: any[];
      current_today_offer_widget?: any[];
      current_today_offer_blocks?: any[];

      [key: string]: any;
    };
    BOGOS_CORE: {
      helper: {
        updateCore(option: {
          cart?: object;
          customer?: object | string;
          [key: string]: any;
        }): unknown;
        init(
          myshopifyDomain: string,
          bogosKey: string,
          option: {cart?: object; customer?: object | string},
        ): unknown;
        gift: {
          prepareCheckout(): Promise<void>;
          checkItemIsGift(product: object | string): any;
          renderCustomizeForProduct: (
            product: object[] | any[],
            options: {
              collection?: boolean;
              product?: boolean;
              selectedVariants?: {
                id: any;
                product_id: any;
              }[];
            },
          ) => void;
        };
      };
    };
  }
}

/**
 * Declare local additions to `AppLoadContext` to include the session utilities we injected in `server.ts`.
 */
declare module '@shopify/remix-oxygen' {
  export interface AppLoadContext {
    env: Env;
    cart: HydrogenCart;
    storefront: Storefront;
    session: HydrogenSession;
    waitUntil: ExecutionContext['waitUntil'];
  }
}
