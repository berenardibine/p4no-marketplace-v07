import { useEffect } from 'react';

interface Crumb { name: string; url: string }
interface Props { items: Crumb[]; id?: string }

const BreadcrumbJsonLd = ({ items, id = 'breadcrumb-jsonld' }: Props) => {
  useEffect(() => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: c.url,
      })),
    };
    let s = document.querySelector(`#${id}`) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.id = id;
      s.type = 'application/ld+json';
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify(data);
    return () => { document.querySelector(`#${id}`)?.remove(); };
  }, [items, id]);
  return null;
};

export default BreadcrumbJsonLd;
