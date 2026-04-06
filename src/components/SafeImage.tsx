"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SafeImageProps = Omit<ImageProps, "onError" | "alt"> & {
  alt: string;
  fallback?: React.ReactNode;
  onError?: ImageProps["onError"];
};

export default function SafeImage({ alt, fallback, onError, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <>{fallback ?? null}</>;
  }

  return (
    <Image
      alt={alt}
      {...props}
      onError={(event) => {
        setFailed(true);
        if (onError) onError(event);
      }}
    />
  );
}
