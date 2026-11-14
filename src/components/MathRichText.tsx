import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';

interface MathRichTextProps {
  content: string;
  className?: string;
  blockMath?: boolean;
  inline?: boolean;
}

/**
 * Normalizes LaTeX delimiters:
 * - Converts \[ ... \] into $$ ... $$
 * - Converts \( ... \) into $ ... $
 */
export function normalizeLatexDelimiters(input: string): string {
  if (!input) return '';
  return input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
}

export function renderLatexSegment(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return latex;
  }
}

export const MathRichText: React.FC<MathRichTextProps> = ({
  content,
  className = '',
  blockMath = false,
  inline = false,
}) => {
  if (!content) return null;

  const normalized = normalizeLatexDelimiters(content);

  if (blockMath && !normalized.includes('$')) {
    const html = renderLatexSegment(normalized, true);
    return (
      <div
        className={`katex-block-wrapper overflow-x-auto py-1 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Always run full markdown + remark-math + rehype-katex for non-inline blocks (prevents raw * leakage around $...$)
  if (!inline) {
    return (
      <div className={`leading-relaxed space-y-1.5 ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, trust: false }]]}
          urlTransform={(url) =>
            /^https?:\/\//i.test(url) || url.startsWith('#') || url.startsWith('/') ? url : ''
          }
          components={{
            p: ({ children }) => <p className="leading-relaxed">{children}</p>,
            strong: ({ children }) => (
              <strong className="font-semibold text-[#1C1917] dark:text-[#F5F0E6] bg-[#D4653B]/10 px-1 py-0.5 rounded">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic font-medium text-[#D4653B] dark:text-[#E07348] underline decoration-[#D4653B]/40 underline-offset-2">
                {children}
              </em>
            ),
            ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          }}
        >
          {normalized}
        </ReactMarkdown>
      </div>
    );
  }

  // Inline markdown + math mode (handles bold/italic wrapping $...$ cleanly via ReactMarkdown inline paragraphs)
  if (normalized.includes('*')) {
    return (
      <span className={`leading-relaxed ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, trust: false }]]}
          urlTransform={(url) =>
            /^https?:\/\//i.test(url) || url.startsWith('#') || url.startsWith('/') ? url : ''
          }
          components={{
            p: ({ children }) => <span>{children}</span>,
            strong: ({ children }) => (
              <strong className="font-semibold text-[#1C1917] dark:text-[#F5F0E6] bg-[#D4653B]/10 px-1 py-0.5 rounded">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic font-medium text-[#D4653B] dark:text-[#E07348] underline decoration-[#D4653B]/40 underline-offset-2">
                {children}
              </em>
            ),
          }}
        >
          {normalized}
        </ReactMarkdown>
      </span>
    );
  }

  // Fast pure-inline KaTeX tokenizer when no asterisks are present
  const tokens = normalized.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <span className={`leading-relaxed ${className}`}>
      {tokens.map((token, i) => {
        if (!token) return null;
        if (token.startsWith('$$') && token.endsWith('$$')) {
          const raw = token.slice(2, -2);
          const html = renderLatexSegment(raw, true);
          return (
            <span
              key={i}
              className="block my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        if (token.startsWith('$') && token.endsWith('$')) {
          const raw = token.slice(1, -1);
          const html = renderLatexSegment(raw, false);
          return (
            <span
              key={i}
              className="inline-block mx-0.5 align-middle"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <React.Fragment key={i}>{token}</React.Fragment>;
      })}
    </span>
  );
};
