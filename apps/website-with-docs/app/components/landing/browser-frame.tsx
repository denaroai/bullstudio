import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ *
 * Wraps a real product screenshot in stylized browser chrome — traffic-
 * light dots and a localhost URL bar — then rounds the corners and softly
 * fades the image into the page at every edge, so the shot reads as a
 * framed product still rather than a hard-cut rectangle.
 *
 * The site otherwise runs a zero-radius identity (see app.css), so the
 * rounding here is opt-in via explicit pixel radii.
 * ------------------------------------------------------------------ */

export function BrowserFrame({
  src,
  alt,
  url = "localhost:4000",
  fade = true,
  className,
}: {
  /**
   * Base screenshot path with NO theme suffix or extension, e.g.
   * "/demo/bullstudio-dashboard-demo". The frame renders both the
   * `-light.png` and `-dark.png` variants and toggles between them via the
   * active theme's `.dark` class — so the shot always matches the page.
   */
  src: string;
  alt: string;
  url?: string;
  /** Softly fade the screenshot into the frame at every edge. */
  fade?: boolean;
  className?: string;
}) {
  const imgClass = cn(
    "block w-full",
    fade &&
      "[mask-image:linear-gradient(to_bottom,transparent,#000_4%,#000_92%,transparent),linear-gradient(to_right,transparent,#000_3%,#000_97%,transparent)] [mask-composite:intersect] [-webkit-mask-composite:source-in]",
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-border bg-card shadow-xl",
        className,
      )}
    >
      {/* window bar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-red-400/70" />
          <span className="size-3 rounded-full bg-amber-400/70" />
          <span className="size-3 rounded-full bg-emerald-400/70" />
        </div>
        <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground">
          <Lock className="size-3 text-emerald-400" />
          {url}
        </div>
        {/* spacer balances the traffic lights so the URL bar stays centered */}
        <div aria-hidden className="w-[42px]" />
      </div>

      {/* screenshot — theme-matched pair, toggled by the active `.dark` class,
       * optionally masked so its edges dissolve into the frame */}
      <div className="relative">
        <img
          src={`${src}-light.png`}
          alt={alt}
          className={cn(imgClass, "dark:hidden")}
        />
        <img
          src={`${src}-dark.png`}
          alt={alt}
          className={cn(imgClass, "hidden dark:block")}
        />
      </div>
    </div>
  );
}
