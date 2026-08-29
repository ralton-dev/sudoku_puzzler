/**
 * The prose renderer, and a guard over all fourteen committed pages.
 *
 * The guard is the point. The renderer understands four constructs, the gate
 * runs Prettier over `.md` as well as `.ts`, and Prettier rewrites Markdown —
 * `*this*` becomes `_this_` — so a page can acquire syntax the renderer does
 * not know without anybody editing it. That failure is silent on screen: the
 * marker is simply printed. So every page is rendered here and checked for
 * leftover markers.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TECHNIQUE_IDS } from 'sudoku-core';
import { PROSE, SUMMARIES } from './content';
import { Prose } from './Prose';

describe('Prose', () => {
  it('renders headings, emphasis, code and links', () => {
    render(
      <Prose
        markdown={
          '## A heading\n\nSome **bold** and _emphasis_ and `code`, plus a\n' +
          '[link](https://example.invalid/x).\n\n- one\n- two\n'
        }
      />,
    );

    expect(screen.getByRole('heading', { name: 'A heading' })).toBeDefined();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('emphasis').tagName).toBe('EM');
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(screen.getByRole('link', { name: 'link' }).getAttribute('href')).toBe(
      'https://example.invalid/x',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('has a page for every technique, with no unrendered Markdown left on it', () => {
    for (const id of TECHNIQUE_IDS) {
      expect(PROSE[id], id).toBeTypeOf('string');
      expect(SUMMARIES[id], id).toBeTypeOf('string');

      const { container, unmount } = render(<Prose markdown={PROSE[id]} />);
      const text = container.textContent ?? '';

      expect(text.length, id).toBeGreaterThan(800);
      for (const marker of ['**', '_', '`', '](', '## ']) {
        expect(text.includes(marker), `${id} leaked ${marker}`).toBe(false);
      }
      // Every page cites the reference (decision 18) and none of them is empty
      // of headings.
      expect(text, id).toContain('sudokuoftheday.com');
      expect(container.querySelectorAll('h3').length, id).toBeGreaterThan(0);
      unmount();
    }
  });
});
