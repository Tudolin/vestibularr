"use client";

import { forwardRef } from "react";
import { GUIDE_POSTER, GUIDE_VIDEO } from "@/lib/guide";
import { cn } from "@/lib/utils";

/** Player do vídeo de apresentação (controles nativos, sem baixar o vídeo até o play). */
export const GuideVideo = forwardRef<HTMLVideoElement, { className?: string; autoPlay?: boolean }>(function GuideVideo({ className, autoPlay }, ref) {
  return (
    <video
      ref={ref}
      className={cn("aspect-video w-full rounded-2xl bg-black shadow-lg", className)}
      src={GUIDE_VIDEO}
      poster={GUIDE_POSTER}
      controls
      playsInline
      preload="none"
      autoPlay={autoPlay}
      aria-label="Vídeo de apresentação do Vestibularr"
    />
  );
});
