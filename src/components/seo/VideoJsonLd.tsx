import { useEffect } from 'react';

interface Props {
  id?: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  uploadDate?: string;
  duration?: string; // ISO 8601 e.g. PT0M30S
  embedUrl?: string;
}

const VideoJsonLd = ({
  id = 'video-jsonld',
  name,
  description,
  thumbnailUrl,
  contentUrl,
  uploadDate,
  duration,
  embedUrl,
}: Props) => {
  useEffect(() => {
    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name,
      description: description?.slice(0, 500) || name,
      thumbnailUrl: [thumbnailUrl],
      contentUrl,
      uploadDate: uploadDate || new Date().toISOString(),
    };
    if (duration) data.duration = duration;
    if (embedUrl) data.embedUrl = embedUrl;

    let s = document.getElementById(id) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.id = id;
      s.type = 'application/ld+json';
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify(data);
    return () => { document.getElementById(id)?.remove(); };
  }, [id, name, description, thumbnailUrl, contentUrl, uploadDate, duration, embedUrl]);

  return null;
};

export default VideoJsonLd;