"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SafeImageProps = Omit<ImageProps, "onError"> & {
  fallback?: React.ReactNode;
  onError?: ImageProps["onError"];
};

export default function SafeImage({ fallback, onError, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <>{fallback ?? null}</>;
  }

  return (
    <Image
      {...props}
      onError={(event) => {
        setFailed(true);
        if (onError) onError(event);
      }}
    />
  );
}
