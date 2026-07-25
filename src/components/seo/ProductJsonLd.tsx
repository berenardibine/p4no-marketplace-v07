import { useEffect } from 'react';

interface ProductJsonLdProps {
  title: string;
  description: string;
  image: string;
  images?: string[];
  url: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  seller?: string;
  location?: string;
  category?: string;
  availability?: string;
  sku?: string;
  mpn?: string;
  itemCondition?: string;
  /** Seller / shop average rating (1-5) */
  ratingValue?: number | null;
  /** Number of reviews that contributed to the rating */
  ratingCount?: number | null;
  /** Individual reviews array */
  reviews?: Array<{
    author: string;
    datePublished: string;
    reviewBody: string;
    ratingValue: number;
  }>;
  brand?: string;
}

const BASE = 'https://p4no-marketplace.vercel.app';

const ProductJsonLd = ({
  title,
  description,
  image,
  images,
  url,
  price,
  originalPrice,
  currency = 'RWF',
  seller,
  location,
  category,
  availability = 'InStock',
  sku,
  mpn,
  itemCondition = 'NewCondition',
  ratingValue,
  ratingCount,
  reviews,
  brand,
}: ProductJsonLdProps) => {
  useEffect(() => {
    // Build image list (up to 10 for SEO)
    const imageList: string[] = [];
    const addImg = (src?: string) => {
      if (!src) return;
      const full = src.startsWith('http') ? src : `${BASE}${src}`;
      if (!imageList.includes(full)) imageList.push(full);
    };
    addImg(image);
    if (images?.length) images.forEach(addImg);
    if (imageList.length === 1) imageList.push(`${BASE}/og-image-v3.jpg`);

    const jsonLd: any = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description: (description || title || '').substring(0, 5000),
      image: imageList.slice(0, 10),
      url,
      ...(sku && { sku, productID: sku }),
      ...(mpn && { mpn }),
      ...(category && { category: { '@type': 'Thing', name: category } }),
      brand: {
        '@type': 'Brand',
        name: brand || seller || 'Generic',
      },
      ...(price && {
        offers: {
          '@type': 'Offer',
          url,
          price: price.toString(),
          priceCurrency: currency,
          availability: `https://schema.org/${availability}`,
          itemCondition: `https://schema.org/${itemCondition}`,
          priceValidUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10),
          ...(originalPrice && originalPrice > price ? {
            priceSpecification: {
              '@type': 'PriceSpecification',
              price: price.toString(),
              priceCurrency: currency,
            },
          } : {}),
          ...(seller && {
            seller: {
              '@type': 'Organization',
              name: seller,
            },
          }),
          ...(location && {
            areaServed: {
              '@type': 'Place',
              name: location,
            },
          }),
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: '0',
              currency,
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'RW',
            },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 1,
                unitCode: 'DAY',
              },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 5,
                unitCode: 'DAY',
              },
            },
          },
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'RW',
            returnPolicyCategory:
              'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 7,
            returnMethod: 'https://schema.org/ReturnByMail',
            returnFees: 'https://schema.org/FreeReturn',
          },
        },
      }),
      ...(ratingValue && ratingCount ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: Number(ratingValue).toFixed(1),
          reviewCount: ratingCount,
          bestRating: 5,
          worstRating: 1,
        },
      } : {}),
      ...(reviews && reviews.length ? {
        review: reviews.slice(1, 5).map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.author },
          datePublished: r.datePublished,
          reviewBody: r.reviewBody,
          reviewRating: {
            '@type': 'Rating',
            ratingValue: r.ratingValue,
            bestRating: 5,
            worstRating: 1,
          },
        })),
      } : {}),
    };

    let script = document.querySelector('#product-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'product-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      document.querySelector('#product-jsonld')?.remove();
    };
  }, [title, description, image, images, url, price, originalPrice, currency, seller, location, category, availability, sku, mpn, itemCondition, ratingValue, ratingCount, reviews, brand]);

  return null;
};

export default ProductJsonLd;
