import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BrowserFrame } from "./browser-frame";

export type ImageTextProps = {
  /** Eyebrow label shown above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** Optional extra content rendered below the description (e.g. a bullet list or link). */
  children?: ReactNode;
  /** Image source. When omitted a styled placeholder is shown instead. */
  imageSrc?: string;
  imageAlt?: string;
  /**
   * Column order on large screens. "image" puts the image first (left),
   * "text" puts the text first (left). Defaults to "text".
   */
  layout?: "text" | "image";
  className?: string;
};

export function ImageText({
  eyebrow,
  title,
  description,
  children,
  imageSrc,
  imageAlt = "",
  layout = "text",
  className,
}: ImageTextProps) {
  const imageFirst = layout === "image";

  return (
    <div
      className={cn(
        "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
        className,
      )}
    >
      {/* text column */}
      <div
        className={cn(
          "flex flex-col gap-4",
          imageFirst ? "lg:order-2" : "lg:order-1",
        )}
      >
        {eyebrow ? (
          <span className="text-sm font-medium text-primary">{eyebrow}</span>
        ) : null}
        <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h3>
        <p className="text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
        {children}
      </div>

      {/* image column */}
      <div className={cn(imageFirst ? "lg:order-1" : "lg:order-2")}>
        {imageSrc ? (
          <BrowserFrame src={imageSrc} alt={imageAlt} fade={false} />
        ) : (
          <ImagePlaceholder />
        )}
      </div>
    </div>
  );
}

export function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex aspect-[16/10] w-full items-center justify-center border border-dashed border-border bg-card",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-8"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide">
          Screenshot coming soon
        </span>
      </div>
    </div>
  );
}
