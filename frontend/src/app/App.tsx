import { Routes, Route } from 'react-router-dom';
import { LoginPage } from '../features/auth';
import { OnboardingPage } from '../features/onboarding';
import { WardrobePage } from '../features/wardrobe';

export function App() {
  return (
    <Routes>
      <Route path="/"           element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/wardrobe"   element={<WardrobePage />} />
    </Routes>
  );
}
