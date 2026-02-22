import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as googleService from '../services/googleService';

interface ArtworkImageProps {
  fileId?: string;
  fallbackUrl?: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback: React.ReactNode;
  lazy?: boolean;
}

const blobUrlCache = new Map<string, string>();

const parseFileId = (url?: string) => {
  if (!url) return undefined;
  const match = url.match(/\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : undefined;
};

const ArtworkImage: React.FC<ArtworkImageProps> = ({ fileId, fallbackUrl, alt, className, containerClassName, fallback, lazy = true }) => {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);
  const effectiveFileId = useMemo(() => fileId || parseFileId(fallbackUrl), [fileId, fallbackUrl]);

  useEffect(() => {
    let cancelled = false;
    // Reset immediately when fileId changes so stale artwork doesn't persist
    const cached = effectiveFileId ? blobUrlCache.get(effectiveFileId) : undefined;
    setObjectUrl(cached || null);
    setLoadError(false);

    const load = async () => {
      if (!effectiveFileId || !isVisible || cached) return;
      try {
        const blob = await googleService.fetchDriveFile(effectiveFileId);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlCache.set(effectiveFileId, url);
        setObjectUrl(url);
      } catch (error) {
        console.error('Failed to load artwork', error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveFileId, isVisible]);

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

  return <span ref={containerRef} className={`block ${containerClassName || ''}`}>{content}</span>;
};

export default ArtworkImage;
