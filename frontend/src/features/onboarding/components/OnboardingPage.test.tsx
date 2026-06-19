import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the data + geolocation layers so no real HTTP/permission prompts happen.
const mocks = vi.hoisted(() => ({
  savePreferences: vi.fn(),
  getDeviceLocation: vi.fn(),
  reverseGeocode: vi.fn(),
}));
vi.mock('../api', () => ({
  EMPTY_ANSWERS: { aesthetic: 'Basic', location: '' },
  buildPreferences: (a: { aesthetic: string; location: string }) => ({
    styles: [],
    answers: { aesthetic: a.aesthetic, location: a.location },
    use_ai: true,
  }),
  savePreferences: mocks.savePreferences,
}));
vi.mock('../geocode', () => ({
  getDeviceLocation: mocks.getDeviceLocation,
  reverseGeocode: mocks.reverseGeocode,
  searchCities: vi.fn().mockResolvedValue([]),
}));

import OnboardingPage from './OnboardingPage';

// Surfaces the current route so we can assert where the flow navigates.
function PathProbe() {
  return <div>PATH:{useLocation().pathname}</div>;
}

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<PathProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const click = (name: RegExp) => userEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  mocks.savePreferences.mockReset();
  mocks.savePreferences.mockResolvedValue(undefined);
  mocks.getDeviceLocation.mockReset();
  mocks.reverseGeocode.mockReset();
  localStorage.clear();
});

describe('OnboardingPage flow (KAN-94)', () => {
  it('walks Welcome → Aesthetic → Location (manual) → Done and into add-clothes', async () => {
    renderFlow();

    expect(await screen.findByText(/your closet, styled daily/i)).toBeTruthy();
    await click(/get started/i);

    expect(await screen.findByText(/what's your aesthetic/i)).toBeTruthy();
    await click(/continue/i);

    expect(await screen.findByText(/where are you based/i)).toBeTruthy();
    await click(/enter a city instead/i);
    await userEvent.type(screen.getByLabelText(/city or region/i), 'Paris');
    await click(/continue/i);

    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledTimes(1));
    expect(mocks.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({ aesthetic: 'Basic', location: 'Paris' }),
      }),
    );

    expect(await screen.findByText(/you're all set/i)).toBeTruthy();
    await click(/add my clothes/i);
    expect(await screen.findByText('PATH:/wardrobe/add')).toBeTruthy();
  });

  it('persists the chosen aesthetic (not the Basic default)', async () => {
    renderFlow();
    await click(/get started/i);

    await screen.findByText(/what's your aesthetic/i);
    await click(/streetwear/i);
    await click(/continue/i);

    await screen.findByText(/where are you based/i);
    await click(/enter a city instead/i);
    await click(/skip for now/i);

    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledTimes(1));
    expect(mocks.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({ aesthetic: 'Streetwear', location: '' }),
      }),
    );
  });

  it('keeps Basic when the aesthetic step is skipped', async () => {
    renderFlow();
    await click(/get started/i);
    await screen.findByText(/what's your aesthetic/i);
    await click(/skip for now/i);

    await screen.findByText(/where are you based/i);
    await click(/enter a city instead/i);
    await click(/skip for now/i);

    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledTimes(1));
    expect(mocks.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({ aesthetic: 'Basic' }),
      }),
    );
  });

  it('Allow Location resolves a city, persists it, and finishes', async () => {
    mocks.getDeviceLocation.mockResolvedValue({ lat: 52.52, lon: 13.405 });
    mocks.reverseGeocode.mockResolvedValue('Berlin');

    renderFlow();
    await click(/get started/i);
    await click(/continue/i);
    await screen.findByText(/where are you based/i);

    await click(/weather-based outfits/i);

    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledTimes(1));
    expect(mocks.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({ location: 'Berlin' }),
      }),
    );
    expect(await screen.findByText(/you're all set/i)).toBeTruthy();
  });

  it('falls back to manual entry when geolocation is denied', async () => {
    mocks.getDeviceLocation.mockRejectedValue(new Error('denied'));

    renderFlow();
    await click(/get started/i);
    await click(/continue/i);
    await screen.findByText(/where are you based/i);

    await click(/weather-based outfits/i);

    expect(await screen.findByText(/couldn't detect your location/i)).toBeTruthy();
    expect(screen.getByLabelText(/city or region/i)).toBeTruthy();
    expect(mocks.savePreferences).not.toHaveBeenCalled();
  });

  it('on save failure shows an error, stays put, and preserves input', async () => {
    mocks.savePreferences.mockRejectedValue(new Error('network down'));

    renderFlow();
    await click(/get started/i);
    await click(/continue/i);
    await screen.findByText(/where are you based/i);
    await click(/enter a city instead/i);
    await userEvent.type(screen.getByLabelText(/city or region/i), 'Paris');
    await click(/continue/i);

    expect(await screen.findByText(/could not save your preferences/i)).toBeTruthy();
    // Did not advance...
    expect(screen.queryByText(/you're all set/i)).toBeNull();
    // ...and the typed city is still there.
    expect((screen.getByLabelText(/city or region/i) as HTMLInputElement).value).toBe(
      'Paris',
    );
  });

});
