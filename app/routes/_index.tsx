import { defer, type LoaderArgs } from '@shopify/remix-oxygen';
import {
  Await,
  useLoaderData,
  Link,
  type V2_MetaFunction,
} from '@remix-run/react';
import { Suspense, useEffect, useState } from 'react';
import { Image, Money } from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';

export const meta: V2_MetaFunction = () => {
  return [{ title: 'Hydrogen | Home' }];
};

export async function loader({ context }: LoaderArgs) {
  const { storefront } = context;
  const { collections } = await storefront.query(FEATURED_COLLECTION_QUERY);
  const featuredCollection = collections.nodes[0];
  const recommendedProducts = storefront.query(RECOMMENDED_PRODUCTS_QUERY);

  return defer({ featuredCollection, recommendedProducts });
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <FeaturedCollection collection={data.featuredCollection} />
      <RecommendedProducts products={data.recommendedProducts} />
      
      <div className="bogos-to-block-view"></div>
    </div>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment;
}) {
  const image = collection.image;
  return (
    <Link
      className="featured-collection"
      to={`/collections/${collection.handle}`}
    >
      {image && (
        <div className="featured-collection-image">
          <Image data={image} sizes="100vw" />
        </div>
      )}
      <h1>{collection.title}</h1>
    </Link>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery>;
}) {
  return (
    <div className="recommended-products">
      <h2>Recommended Products</h2>
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {({ products }) => (
            <div className="recommended-products-grid">
              {products.nodes.map((product) => (<ProductItem key={`${product.id}`} product={product} />))}
            </div>
          )}
        </Await>
      </Suspense>
      <br />
    </div>
  );
}

const ProductItem = ({ product }: { product: any }) => {

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

  return <Link
    key={product.id}
    className="recommended-product fg-secomapp-collection-img"
    to={`/products/${product.handle}`}
  >
    <Image
      data={product.images.nodes[0]}
      aspectRatio="1/1"
      sizes="(min-width: 45em) 20vw, 50vw"
    />
    <h4>{product.title}</h4>
    <small>
      <Money data={product.priceRange.minVariantPrice} />
    </small>
  </Link>
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 1) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true, query: "tag_not:bogos-gift AND tag_not:freegifts") {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
