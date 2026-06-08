import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CopyButton } from "./copy";

const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "const",
  "let",
  "var",
  "await",
  "async",
  "new",
  "return",
  "type",
  "void",
  "function",
  "default",
]);

// One pass over the source, emitting colored spans for comments, strings,
// keywords and numbers. Deliberately small — enough to make snippets feel
// alive without pulling in a full highlighter.
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|([A-Za-z_$][\w$]*)|(\d[\d_.]*)/g;

function highlight(code: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  match = TOKEN.exec(code);
  while (match !== null) {
    if (match.index > last) nodes.push(code.slice(last, match.index));
    const [text, comment, str, word, num] = match;
    if (comment) {
      nodes.push(
        <span key={key++} className="text-muted-foreground/70 italic">
          {comment}
        </span>,
      );
    } else if (str) {
      nodes.push(
        <span key={key++} className="text-secondary">
          {str}
        </span>,
      );
    } else if (word && KEYWORDS.has(word)) {
      nodes.push(
        <span key={key++} className="text-primary">
          {word}
        </span>,
      );
    } else if (num) {
      nodes.push(
        <span key={key++} className="text-destructive">
          {num}
        </span>,
      );
    } else {
      nodes.push(text);
    }
    last = match.index + text.length;
    match = TOKEN.exec(code);
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

export function CodeBlock({
  code,
  filename,
  className,
}: {
  code: string;
  filename?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col border border-border bg-card", className)}
    >
      {filename ? (
        <div className="flex items-center justify-between border-b border-border bg-muted/40 pl-4 pr-2 py-2">
          <span className="font-mono text-xs text-muted-foreground">
            {filename}
          </span>
          <CopyButton value={code} label="Copy code" className="size-7" />
        </div>
      ) : null}
      <div className="relative">
        {!filename ? (
          <CopyButton
            value={code}
            label="Copy code"
            className="absolute right-2 top-2 size-7"
          />
        ) : null}
        <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
          <code>{highlight(code)}</code>
        </pre>
      </div>
    </div>
  );
}
