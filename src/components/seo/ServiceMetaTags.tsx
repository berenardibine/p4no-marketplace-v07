import { useEffect } from 'react';

interface Props {
  title: string;
  description: string;
  image?: string;
  url: string;
  price?: number | null;
  pricingType?: string;
  currencySymbol?: string | null;
  providerName?: string;
}

const BASE_URL = 'https://p4no-marketplace.vercel.app';

const ServiceMetaTags = ({ title, description, image, url, price, pricingType, currencySymbol, providerName }: Props) => {
  useEffect(() => {
    const priceLabel = pricingType === 'negotiable'
      ? 'Negotiable'
      : pricingType === 'starting_from'
        ? `From ${currencySymbol || ''} ${Number(price || 0).toLocaleString()}`
        : price ? `${currencySymbol || ''} ${Number(price).toLocaleString()}` : '';

    const fullTitle = providerName
      ? `${title} by ${providerName}${priceLabel ? ` – ${priceLabel}` : ''} | P4NO`
      : `${title}${priceLabel ? ` – ${priceLabel}` : ''} | P4NO`;
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const shortDesc = (description || '').length > 155 ? (description || '').slice(0, 152) + '…' : (description || '');
    const fullImage = image?.startsWith('http') ? image : (image ? `${BASE_URL}${image}` : `${BASE_URL}/og-preview.png?v=2`);

    setMeta('name', 'description', shortDesc);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', shortDesc);
    setMeta('property', 'og:image', fullImage);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:site_name', 'P4NO');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', shortDesc);
    setMeta('name', 'twitter:image', fullImage);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);

    return () => { document.title = 'P4NO – Smarter Shopping & Service Connector'; };
  }, [title, description, image, url, price, pricingType, currencySymbol, providerName]);

  return null;
};

export default ServiceMetaTags;
