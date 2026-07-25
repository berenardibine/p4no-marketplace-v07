import { useEffect } from 'react';

interface ProductMetaTagsProps {
  title: string;
  description: string;
  image: string;
  url: string;
  price?: number;
  currency?: string;
  shopName?: string;
  siteName?: string;
}

const ProductMetaTags = ({ 
  title, 
  description, 
  image, 
  url, 
  price,
  currency = 'RWF',
  shopName,
  siteName = 'p4no'
}: ProductMetaTagsProps) => {
  useEffect(() => {
    const displayTitle = shopName
      ? (price ? `${title} by ${shopName} – Fr ${price.toLocaleString()} | p4no` : `${title} by ${shopName} | p4no`)
      : (price ? `${title} – Fr ${price.toLocaleString()} | p4no` : `${title} | p4no`);
    document.title = displayTitle;
    
    const setMetaTag = (property: string, content: string, isOg = true) => {
      const attr = isOg ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    const shortDescription = description?.length > 150 ? description.substring(0, 147) + '...' : (description || '');
    const fullImageUrl = image?.startsWith('http') ? image : `https://p4no-marketplace.vercel.app${image || '/og-preview.png?v=2'}`;
    
    const ogTitle = shopName
      ? (price ? `${title} by ${shopName} – Fr ${price.toLocaleString()}` : `${title} by ${shopName}`)
      : (price ? `${title} – Fr ${price.toLocaleString()}` : title);

    setMetaTag('og:title', ogTitle);
    setMetaTag('og:description', shortDescription || 'Available on p4no. Discover smarter shopping.');
    setMetaTag('og:image', fullImageUrl);
    setMetaTag('og:image:width', '1200');
    setMetaTag('og:image:height', '630');
    setMetaTag('og:url', url);
    setMetaTag('og:type', 'product');
    setMetaTag('og:site_name', siteName);
    setMetaTag('og:image:alt', title);
    
    setMetaTag('twitter:card', 'summary_large_image', false);
    setMetaTag('twitter:title', `${ogTitle} – p4no`, false);
    setMetaTag('twitter:description', shortDescription || 'Discover quality products on p4no.', false);
    setMetaTag('twitter:image', fullImageUrl, false);
    setMetaTag('twitter:url', url, false);
    
    setMetaTag('description', shortDescription, false);
    
    if (price) {
      setMetaTag('product:price:amount', price.toString());
      setMetaTag('product:price:currency', currency);
    }
    
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
    
    return () => {
      document.title = 'p4no – Discover Smarter Shopping';
    };
  }, [title, description, image, url, price, currency, shopName, siteName]);
  
  return null;
};

export default ProductMetaTags;
