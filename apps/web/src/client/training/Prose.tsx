/**
 * A very small Markdown renderer — enough for `prose/<techniqueId>.md`, and
 * nothing more.
 *
 * The alternative was a Markdown dependency in the client bundle for fourteen
 * files we write ourselves and can therefore keep to four constructs:
 * `## heading`, paragraph, `- ` list, and inline `**bold**`, `` `code` `` and
 * `[text](url)`. Anything else in a prose file renders as literal text, which
 * is the failure mode you want from a renderer this size: visible, in the file
 * being written, immediately.
 *
 * `dangerouslySetInnerHTML` is not used anywhere here. The prose is ours and is
 * compiled into the bundle, so it is not untrusted — but a renderer that emits
 * elements rather than HTML cannot become an injection route later if the
 * source of a page ever changes.
 */

import { Fragment, type ReactNode } from 'react';

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Prose({ markdown }: { markdown: string }) {
  const blocks = markdown.trim().split(/\n{2,}/);
  return (
    <div className="tr-prose">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.startsWith('## ')) {
          return <h3 key={key}>{inline(block.slice(3).replace(/\n/g, ' '), key)}</h3>;
        }
        const lines = block.split('\n');
        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={key}>
              {lines.map((line, i) => (
                <li key={`${key}-${i}`}>{inline(line.slice(2), `${key}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={key}>{inline(lines.join(' '), key)}</p>;
      })}
    </div>
  );
}
