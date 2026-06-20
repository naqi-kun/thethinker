import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/client';
import type { OutfitRecommendation } from '../../../shared/api/types';

// Mock the data layer so no real HTTP happens and we can drive request timing.
const mocks = vi.hoisted(() => ({
  getOutfit: vi.fn(),
  acceptOutfit: vi.fn(),
  getTodayEvents: vi.fn(),
  ignoreEvent: vi.fn(),
  resyncAllCalendars: vi.fn(),
}));
vi.mock('../api', () => ({
  getOutfit: mocks.getOutfit,
  acceptOutfit: mocks.acceptOutfit,
}));
vi.mock('../../calendar/api', () => ({
  getTodayEvents: mocks.getTodayEvents,
  ignoreEvent: mocks.ignoreEvent,
  resyncAllCalendars: mocks.resyncAllCalendars,
}));

import OutfitPage from './OutfitPage';
import { markRevealedToday } from '../revealStore';

function makeRec(sessionId: string, occasion: string): OutfitRecommendation {
  return {
    session_id: sessionId,
    recommender: 'ai',
    occasion,
    items: [
      {
        id: `${sessionId}-1`,
        sub_type: 'shirt',
        color: 'blue',
        category: 'top',
        season: 'all',
      },
    ],
  } as unknown as OutfitRecommendation;
}

beforeEach(() => {
  mocks.getOutfit.mockReset();
  mocks.acceptOutfit.mockReset();
  mocks.getTodayEvents.mockReset();
  mocks.getTodayEvents.mockResolvedValue([]);
  mocks.resyncAllCalendars.mockReset();
  mocks.resyncAllCalendars.mockResolvedValue([]);
  localStorage.clear();
});

describe('OutfitPage outfit loading (KAN-90)', () => {
  // These exercise request behaviour, not the reveal ceremony — start past the
  // seal so the flat-lay renders immediately.
  beforeEach(() => markRevealedToday());

  it('issues exactly one outfit request on initial load under StrictMode', async () => {
    // Before the fix, StrictMode's double-invoked mount effect started two
    // independent AI sessions and the page swapped to the second result ~2s
    // after load. The once-only guard must collapse that to a single request.
    mocks.getOutfit.mockResolvedValue(makeRec('a', 'Work'));

    render(
      <StrictMode>
        <MemoryRouter>
          <OutfitPage />
        </MemoryRouter>
      </StrictMode>,
    );

    expect(await screen.findByText('#Work')).toBeTruthy();
    expect(mocks.getOutfit).toHaveBeenCalledTimes(1);
    // Initial load starts a fresh session (no session_id) and dresses for the
    // day's most-formal event by default (empty options).
    expect(mocks.getOutfit).toHaveBeenNthCalledWith(1, undefined, {});
  });

  it('Refresh regenerates with the existing session_id and swaps in the new outfit', async () => {
    mocks.getOutfit
      .mockResolvedValueOnce(makeRec('a', 'Work'))
      .mockResolvedValueOnce(makeRec('b', 'Gym'));

    render(
      <MemoryRouter>
        <OutfitPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('#Work')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /shuffle/i }));

    expect(await screen.findByText('#Gym')).toBeTruthy();
    expect(mocks.getOutfit).toHaveBeenCalledTimes(2);
    // Shuffle reuses the current session (with the same dressing-for brief)
    // rather than starting a new one.
    expect(mocks.getOutfit).toHaveBeenNthCalledWith(2, 'a', {});
  });

  it('dressing-for dropdown fetches a fresh session for the chosen event (KAN-92)', async () => {
    mocks.getTodayEvents.mockResolvedValue([
      {
        id: 'ev-1',
        title: 'Board meeting',
        starts_at: '2026-06-16T09:00:00Z',
        all_day: false,
      },
    ]);
    mocks.getOutfit
      .mockResolvedValueOnce(makeRec('a', 'Board meeting'))
      .mockResolvedValueOnce(makeRec('b', 'Board meeting'));

    render(
      <MemoryRouter>
        <OutfitPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('#Board meeting')).toBeTruthy();

    // Open the custom "Dressing for" listbox (its trigger shows the current
    // selection), then pick the event option.
    await userEvent.click(
      await screen.findByRole('button', { name: /best for today/i }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /board meeting/i }),
    );

    await waitFor(() => expect(mocks.getOutfit).toHaveBeenCalledTimes(2));
    // Choosing an event starts a fresh session (undefined) dressing for it.
    expect(mocks.getOutfit).toHaveBeenNthCalledWith(2, undefined, { eventId: 'ev-1' });
  });

  it('shows the empty-wardrobe state when the outfit request 404s', async () => {
    mocks.getOutfit.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'empty wardrobe'));

    render(
      <MemoryRouter>
        <OutfitPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/your wardrobe is empty/i)).toBeTruthy();
  });
});

describe('OutfitPage daily reveal ceremony (KAN-100)', () => {
  it('seals the outfit on the first open of the day until Reveal is tapped', async () => {
    mocks.getOutfit.mockResolvedValue(makeRec('a', 'Work'));

    render(
      <MemoryRouter>
        <OutfitPage />
      </MemoryRouter>,
    );

    // Sealed wrapper is shown; the flat-lay / hashtags stay hidden.
    const reveal = await screen.findByRole('button', { name: /reveal/i });
    expect(screen.queryByText('#Work')).toBeNull();

    await userEvent.click(reveal);

    // Bloom resolves and the flat-lay takes over.
    expect(await screen.findByText('#Work')).toBeTruthy();
  });

  it('skips the seal when the outfit was already revealed earlier today', async () => {
    markRevealedToday();
    mocks.getOutfit.mockResolvedValue(makeRec('a', 'Work'));

    render(
      <MemoryRouter>
        <OutfitPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('#Work')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /reveal/i })).toBeNull();
  });
});
