import { Routes, Route } from 'react-router-dom';
import { LoginPage } from '../features/auth';
import { OnboardingPage } from '../features/onboarding';
import { WardrobePage, ScanPage } from '../features/wardrobe';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/wardrobe" element={<WardrobePage />} />
      <Route path="/wardrobe/scan" element={<ScanPage />} />
    </Routes>
  );
}
