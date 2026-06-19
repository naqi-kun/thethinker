import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppHeader from './AppHeader';

const TABS = ['Wardrobe', 'Outfit', 'Calendar', 'History'];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe('AppHeader (desktop nav)', () => {
  it('renders the four destinations linking to their routes', () => {
    renderAt('/wardrobe');

    for (const label of TABS) {
      const link = screen.getByRole('link', { name: label });
      expect(link.getAttribute('href')).toBe(`/${label.toLowerCase()}`);
    }
  });

  it('links the wordmark home and the gear to settings', () => {
    renderAt('/wardrobe');

    expect(
      screen.getByRole('link', { name: 'The Thinker home' }).getAttribute('href'),
    ).toBe('/');
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe(
      '/settings',
    );
  });

  it('marks the tab for the current route as active and tracks the URL', () => {
    renderAt('/calendar');

    expect(
      screen.getByRole('link', { name: 'Calendar' }).getAttribute('aria-current'),
    ).toBe('page');
    for (const label of ['Wardrobe', 'Outfit', 'History']) {
      expect(
        screen.getByRole('link', { name: label }).getAttribute('aria-current'),
      ).toBeNull();
    }
  });
});
