import type { ReactNode } from "react";

/**
 * Minimal, safe markdown renderer for AI output.
 *
 * Deliberately dependency-free and element-based: raw HTML is never injected,
 * so model output cannot introduce script injection. Supports the subset the
 * assistant actually produces — headings, bullet lists, bold/italic/code spans
 * and paragraphs.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: bold before italic so ** is not consumed as two italics.
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`)/g;
  const parts = text.split(pattern).filter((part) => part !== "");

  parts.forEach((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (/^\*\*[\s\S]+\*\*$/.test(part) || /^__[\s\S]+__$/.test(part)) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>,
      );
    } else if (/^`[^`]+`$/.test(part)) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>,
      );
    } else if (/^\*[^*]+\*$/.test(part)) {
      nodes.push(
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>,
      );
    } else {
      nodes.push(<span key={key}>{part}</span>);
    }
  });

  return nodes;
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key} className="ml-4 list-disc space-y-1.5 text-sm">
        {listBuffer.map((item, index) => (
          <li key={`${key}-${index}`} className="leading-relaxed">
            {renderInline(item, `${key}-${index}`)}
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const key = `block-${index}`;

    if (/^\s*[-*•]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*•]\s+/, ""));
      return;
    }

    flushList(`${key}-list`);

    if (line.trim() === "") return;

    if (/^###\s+/.test(line)) {
      blocks.push(
        <h4 key={key} className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {renderInline(line.replace(/^###\s+/, ""), key)}
        </h4>,
      );
      return;
    }

    if (/^##\s+/.test(line)) {
      blocks.push(
        <h3 key={key} className="mt-2 text-base font-semibold">
          {renderInline(line.replace(/^##\s+/, ""), key)}
        </h3>,
      );
      return;
    }

    if (/^#\s+/.test(line)) {
      blocks.push(
        <h2 key={key} className="text-lg font-bold">
          {renderInline(line.replace(/^#\s+/, ""), key)}
        </h2>,
      );
      return;
    }

    blocks.push(
      <p key={key} className="text-sm leading-relaxed">
        {renderInline(line, key)}
      </p>,
    );
  });

  flushList("block-final-list");

  return <div className={className}>{blocks}</div>;
}
