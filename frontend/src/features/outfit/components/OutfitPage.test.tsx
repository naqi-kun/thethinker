import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
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
}));
vi.mock('../api', () => ({
  getOutfit: mocks.getOutfit,
  acceptOutfit: mocks.acceptOutfit,
}));
vi.mock('../../calendar/api', () => ({
  getTodayEvents: mocks.getTodayEvents,
  ignoreEvent: mocks.ignoreEvent,
}));

import OutfitPage from './OutfitPage';

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
});

describe('OutfitPage outfit loading (KAN-90)', () => {
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
    // Initial load starts a fresh session (no session_id passed).
    expect(mocks.getOutfit).toHaveBeenNthCalledWith(1, undefined);
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

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    expect(await screen.findByText('#Gym')).toBeTruthy();
    expect(mocks.getOutfit).toHaveBeenCalledTimes(2);
    // Refresh reuses the current session rather than starting a new one.
    expect(mocks.getOutfit).toHaveBeenNthCalledWith(2, 'a');
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
