import React, { useEffect, useRef, useState } from 'react';
import * as googleService from '../services/googleService';

interface ArtworkImageProps {
  fileId?: string;
  fallbackUrl?: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
  lazy?: boolean;
}

const blobUrlCache = new Map<string, string>();

const ArtworkImage: React.FC<ArtworkImageProps> = ({ fileId, fallbackUrl, alt, className, fallback, lazy = true }) => {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!fileId || !isVisible) return;
      const cached = blobUrlCache.get(fileId);
      if (cached) {
        setObjectUrl(cached);
        return;
      }
      try {
        const blob = await googleService.fetchDriveFile(fileId);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlCache.set(fileId, url);
        setObjectUrl(url);
      } catch (error) {
        console.error('Failed to load artwork', error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fileId, isVisible]);

  useEffect(() => {
    if (!lazy) return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy]);

  let content: React.ReactNode = fallback;
  if (objectUrl) {
    content = <img src={objectUrl} alt={alt} className={className} loading={lazy ? 'lazy' : undefined} />;
  } else if (fallbackUrl && !loadError) {
    content = (
      <img
        src={fallbackUrl}
        alt={alt}
        className={className}
        loading={lazy ? 'lazy' : undefined}
        onError={() => setLoadError(true)}
      />
    );
  }

  return <span ref={containerRef} className="block">{content}</span>;
};

export default ArtworkImage;
