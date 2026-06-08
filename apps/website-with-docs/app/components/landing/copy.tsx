import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, []);
  return { copied, copy };
}

export function CopyButton({
  value,
  className,
  label = "Copy",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {copied ? (
        <Check className="size-4 text-secondary" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

/** The hero install command — terminal styled, one-click copy. */
export function CommandBlock({
  command,
  className,
}: {
  command: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 border border-border bg-card pl-4 pr-2 py-2.5 font-mono text-sm shadow-sm",
        className,
      )}
    >
      <span aria-hidden className="select-none text-primary">
        $
      </span>
      <code className="flex-1 truncate text-foreground">{command}</code>
      <CopyButton value={command} label="Copy command" />
    </div>
  );
}
