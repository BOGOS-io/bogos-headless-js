import { json, redirect, type LoaderArgs } from '@shopify/remix-oxygen';
import { useLoaderData, Link, type V2_MetaFunction } from '@remix-run/react';
import {
  Pagination,
  getPaginationVariables,
  Image,
} from '@shopify/hydrogen';
import type { ProductItemFragment } from 'storefrontapi.generated';
import { useVariantUrl } from '~/utils';
import { useEffect, useState } from 'react';
import {
  BogosProductDiscountPrice,
  bogosListKey,
  useBogosProductListSync,
} from '~/components/BogosProductDiscount';

export const meta: V2_MetaFunction = ({ data }) => {
  return [{ title: `Hydrogen | ${data.collection.title} Collection` }];
};

export async function loader({ request, params, context }: LoaderArgs) {
  const { handle } = params;
  const { storefront } = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    return redirect('/collections');
  }

  const { collection } = await storefront.query(COLLECTION_QUERY, {
    variables: { handle, ...paginationVariables },
  });

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }
  return json({ collection });
}

export default function Collection() {
  const { collection } = useLoaderData<typeof loader>();

  return (
    <div className="collection">
      <h1>{collection.title}</h1>
      <p className="collection-description">{collection.description}</p>
      <Pagination connection={collection.products}>
        {({ nodes, isLoading, PreviousLink, NextLink }) => (
          <>
            <PreviousLink>
              {isLoading ? 'Loading...' : <span>↑ Load previous</span>}
            </PreviousLink>
            <ProductsGrid products={nodes} />
            <br />
            <NextLink>
              {isLoading ? 'Loading...' : <span>Load more ↓</span>}
            </NextLink>
          </>
        )}
      </Pagination>
    </div>
  );
}

function ProductsGrid({ products }: { products: ProductItemFragment[] }) {
  // re-matches the cards to BOGOS offers whenever the page of products changes
  useBogosProductListSync(bogosListKey(products));

  return (
    <div className="products-grid">
      {products.map((product, index) => {
        return (
          <ProductItem
            key={product.id}
            product={product}
            loading={index < 8 ? 'eager' : undefined}
          />
        );
      })}
    </div>
  );
}

function ProductItem({
  product,
  loading,
}: {
  product: ProductItemFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variant = product.variants.nodes[0];
  const variantUrl = useVariantUrl(product.handle, variant.selectedOptions);

  const [isBogosGift, setIsBogosGift] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setTimeout(() => {
      window.BOGOS_CORE?.helper?.gift?.renderCustomizeForProduct(
        [{ id: product.id }],
        { collection: true },
      );
    }, 500)
  }, [product.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Bogos gift handle: sca_clone_freegift, Bogos gift tags: bogos-gift
    const checkBogosGift = (product: any) => {
      return product.handle.includes('sca_clone_freegift') || product?.tags?.includes('bogos-gift');
    }

    const isGift = window.BOGOS_CORE?.helper?.gift?.checkItemIsGift(product) || checkBogosGift(product);
    if (isGift && !isBogosGift) {
      setIsBogosGift(isGift);
    };
  }, [product, isBogosGift]);

  if (isBogosGift) {
    return <></>;
  }

  return (
    <Link
      className="product-item fg-secomapp-collection-img"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
      style={{ position: 'relative' }}
    >
      {product.featuredImage && (
        <Image
          alt={product.featuredImage.altText || product.title}
          aspectRatio="1/1"
          data={product.featuredImage}
          loading={loading}
          sizes="(min-width: 45em) 400px, 100vw"
        />
      )}
      <h4>{product.title}</h4>
      <small>
        <BogosProductDiscountPrice
          productId={product.id}
          productHandle={product.handle}
          price={product.priceRange.minVariantPrice}
        />
      </small>
    </Link>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    variants(first: 1) {
      nodes {
        selectedOptions {
          name
          value
        }
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
