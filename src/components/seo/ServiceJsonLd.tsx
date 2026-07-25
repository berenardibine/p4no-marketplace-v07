import { useEffect } from 'react';

interface Props {
  title: string;
  description: string;
  image?: string;
  url: string;
  price?: number | null;
  pricingType?: string;
  currency?: string;
  providerName?: string;
  providerUrl?: string;
  rating?: number | null;
  ratingCount?: number | null;
  category?: string;
  areaServed?: string;
}

const BASE = 'https://p4no-marketplace.vercel.app';

const ServiceJsonLd = ({
  title, description, image, url, price, pricingType, currency = 'RWF',
  providerName, providerUrl, rating, ratingCount, category, areaServed,
}: Props) => {
  useEffect(() => {
    const fullImage = image?.startsWith('http') ? image : `${BASE}${image || '/og-preview.png?v=2'}`;
    const jsonLd: any = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: title,
      description: (description || '').substring(0, 500),
      image: [fullImage],
      url,
      ...(category && { serviceType: category }),
      ...(areaServed && { areaServed: { '@type': 'Place', name: areaServed } }),
      ...(providerName && {
        provider: {
          '@type': 'Organization',
          name: providerName,
          ...(providerUrl && { url: providerUrl }),
        },
      }),
      ...(price != null && pricingType !== 'negotiable' && {
        offers: {
          '@type': 'Offer',
          price: String(price),
          priceCurrency: currency,
          url,
          availability: 'https://schema.org/InStock',
        },
      }),
      ...(rating && ratingCount ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: Number(rating).toFixed(1),
          reviewCount: ratingCount,
        },
      } : {}),
    };

    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'Connect', item: `${BASE}/connect` },
        { '@type': 'ListItem', position: 3, name: title, item: url },
      ],
    };

    const upsert = (id: string, data: any) => {
      let s = document.querySelector(`#${id}`) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.id = id;
        s.type = 'application/ld+json';
        document.head.appendChild(s);
      }
      s.textContent = JSON.stringify(data);
    };
    upsert('service-jsonld', jsonLd);
    upsert('service-breadcrumb-jsonld', breadcrumbLd);

    return () => {
      document.querySelector('#service-jsonld')?.remove();
      document.querySelector('#service-breadcrumb-jsonld')?.remove();
    };
  }, [title, description, image, url, price, pricingType, currency, providerName, providerUrl, rating, ratingCount, category, areaServed]);

  return null;
};

export default ServiceJsonLd;
