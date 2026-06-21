'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Thumbnail that fades in once it has loaded — including images already in cache. */
export function OutputArchiveImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reveal = () => setLoaded(true);

  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <Image
      ref={ref}
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(max-width: 640px) 50vw, 33vw"
      onLoad={reveal}
      onError={reveal}
      className={cn(
        'object-cover transition-opacity duration-700 ease-out',
        loaded ? 'opacity-100' : 'opacity-0'
      )}
    />
  );
}
