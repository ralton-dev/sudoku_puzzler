/**
 * The index lists the whole ladder, in ladder order, whatever the mining found.
 *
 * The order is the lesson — decision 16's fourteen techniques cheapest-first is
 * both the rater's order and the order they are worth learning in — so it is
 * asserted against `TECHNIQUE_IDS` rather than against a copy. The two quads
 * have no mined position and still get an entry: a technique that vanished from
 * the ladder because nothing could be mined for it would be a quiet lie about
 * what the solver does.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TECHNIQUE_IDS, TECHNIQUE_META } from 'sudoku-core';
import { TrainingIndex } from './TrainingIndex';
import { markDone } from './progress';

function renderIndex() {
  return render(
    <MemoryRouter>
      <TrainingIndex />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('TrainingIndex', () => {
  it('renders all fourteen techniques in ladder order', () => {
    renderIndex();

    const items = screen.getByTestId('technique-list').querySelectorAll('li');
    expect(items).toHaveLength(14);
    expect([...items].map((li) => li.getAttribute('data-technique'))).toEqual([...TECHNIQUE_IDS]);
  });

  it('shows each technique name, its cost pair and a summary', () => {
    renderIndex();

    const xwing = screen.getByTestId('technique-list').querySelector('[data-technique="xWing"]');
    expect(xwing?.textContent).toContain(TECHNIQUE_META.xWing.name);
    expect(xwing?.textContent).toContain('2800 / 1600');
    expect(xwing?.textContent).toContain('5 examples');
    expect(xwing?.querySelector('a')?.getAttribute('href')).toBe('/training/xWing');
  });

  it('says so where there is nothing to demonstrate', () => {
    renderIndex();

    for (const id of ['nakedQuad', 'hiddenQuad']) {
      const item = screen.getByTestId('technique-list').querySelector(`[data-technique="${id}"]`);
      expect(item?.textContent).toContain('explanation only');
    }
  });

  it('ticks the techniques localStorage remembers', () => {
    markDone('hiddenPair');
    renderIndex();

    const done = screen.getByTestId('technique-list').querySelectorAll('.tr-done');
    expect(done).toHaveLength(1);
    expect(done[0]?.closest('li')?.getAttribute('data-technique')).toBe('hiddenPair');
  });

  it('renders with no ticks when localStorage throws', () => {
    // A browser with site data blocked throws on read; the ladder still has to
    // render, because a tick is a convenience and the section is the point.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('site data blocked');
    });

    renderIndex();

    expect(screen.getByTestId('technique-list').querySelectorAll('li')).toHaveLength(14);
    expect(screen.getByTestId('technique-list').querySelectorAll('.tr-done')).toHaveLength(0);
  });
});
