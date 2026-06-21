import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preferences } from '../../../shared/api/types';

// Mock the data layer so no real HTTP happens on mount or on save.
const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  getWorkSchedule: vi.fn(),
  updateWorkSchedule: vi.fn(),
}));
vi.mock('../api', () => mocks);

import SettingsPage from './SettingsPage';

// A stored preferences map with a non-aesthetic key, so we can prove saveStyle
// merges into (rather than clobbers) the existing answers.
function makePrefs(aesthetic?: string): Preferences {
  return {
    styles: [],
    answers: {
      location: 'London',
      ...(aesthetic ? { aesthetic } : {}),
    },
    use_ai: true,
  } as unknown as Preferences;
}

// Locate the aesthetic Segmented control by its section label, then return the
// option button with the given name within it.
function aestheticButton(name: string): HTMLElement {
  const heading = screen.getByText('Aesthetic');
  const group = heading.closest('div')!.parentElement!;
  return within(group).getByRole('button', { name });
}

function isSelected(button: HTMLElement): boolean {
  // The selected segment is the only one painted with the primary fill.
  return button.className.includes('bg-primary');
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getProfile.mockResolvedValue({ email: 'dev@thethinker.com', name: '' });
  mocks.getWorkSchedule.mockResolvedValue({
    working_days: [1, 2, 3, 4, 5],
    work_start: '09:00',
    work_end: '17:00',
    holidays: [],
  });
  mocks.updatePreferences.mockResolvedValue(makePrefs());
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('SettingsPage aesthetic preference (KAN-92)', () => {
  it('loads and selects the stored aesthetic', async () => {
    mocks.getPreferences.mockResolvedValue(makePrefs('Streetwear'));

    renderPage();

    await waitFor(() => expect(isSelected(aestheticButton('Streetwear'))).toBe(true));
    expect(isSelected(aestheticButton('Basic'))).toBe(false);
  });

  it('canonicalises a legacy lowercase stored value when selecting', async () => {
    mocks.getPreferences.mockResolvedValue(makePrefs('minimalist'));

    renderPage();

    await waitFor(() => expect(isSelected(aestheticButton('Minimalist'))).toBe(true));
  });

  it('saves a new aesthetic, merging into existing answers without dropping them', async () => {
    mocks.getPreferences.mockResolvedValue(makePrefs('Minimalist'));

    renderPage();
    await waitFor(() => expect(isSelected(aestheticButton('Minimalist'))).toBe(true));

    await userEvent.click(aestheticButton('Streetwear'));

    // Selecting stages the choice immediately but must not persist on its own.
    expect(isSelected(aestheticButton('Streetwear'))).toBe(true);
    expect(mocks.updatePreferences).not.toHaveBeenCalled();

    // Only tapping Save persists it.
    await userEvent.click(aestheticButton('Save'));

    await waitFor(() => expect(mocks.updatePreferences).toHaveBeenCalledTimes(1));
    expect(mocks.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({
          aesthetic: 'Streetwear',
          location: 'London', // preserved, not clobbered
        }),
      }),
    );
    expect(await screen.findByText('Saved!')).toBeTruthy();
  });

  it('reverts to the previous aesthetic and surfaces an error when the save fails', async () => {
    mocks.getPreferences.mockResolvedValue(makePrefs('Minimalist'));
    mocks.updatePreferences.mockRejectedValue(new Error('network down'));

    renderPage();
    await waitFor(() => expect(isSelected(aestheticButton('Minimalist'))).toBe(true));

    await userEvent.click(aestheticButton('Streetwear'));
    await userEvent.click(aestheticButton('Save'));

    // Rolls back to the last-saved value once the request rejects.
    await waitFor(() => expect(isSelected(aestheticButton('Minimalist'))).toBe(true));
    expect(isSelected(aestheticButton('Streetwear'))).toBe(false);
    expect(await screen.findByText(/could not save/i)).toBeTruthy();
  });
});
