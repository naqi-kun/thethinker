import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BottomNav from './BottomNav';

const TABS = ['Wardrobe', 'Outfit', 'Calendar', 'History'];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('BottomNav', () => {
  it('renders the four primary destinations linking to their routes', () => {
    renderAt('/wardrobe');

    for (const label of TABS) {
      const link = screen.getByRole('link', { name: label });
      expect(link.getAttribute('href')).toBe(`/${label.toLowerCase()}`);
    }
  });

  it('marks the tab for the current route as active (aria-current)', () => {
    renderAt('/calendar');

    // react-router sets aria-current="page" on the matching NavLink only.
    expect(
      screen.getByRole('link', { name: 'Calendar' }).getAttribute('aria-current'),
    ).toBe('page');
    for (const label of ['Wardrobe', 'Outfit', 'History']) {
      expect(
        screen.getByRole('link', { name: label }).getAttribute('aria-current'),
      ).toBeNull();
    }
  });

  it('tracks a different route — the active tab follows the URL', () => {
    renderAt('/history');

    expect(
      screen.getByRole('link', { name: 'History' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.getByRole('link', { name: 'Wardrobe' }).getAttribute('aria-current'),
    ).toBeNull();
  });
});
