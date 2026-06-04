import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '../features/landing';
import { LoginPage, RegisterPage, ProtectedRoute } from '../features/auth';
import { OnboardingPage } from '../features/onboarding';
import { WardrobePage, ScanPage, AddItemPage } from '../features/wardrobe';
import { OutfitPage } from '../features/outfit';
import { CalendarPage } from '../features/calendar';
import { SettingsPage } from '../features/settings';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wardrobe"
        element={
          <ProtectedRoute>
            <WardrobePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wardrobe/scan"
        element={
          <ProtectedRoute>
            <ScanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wardrobe/add"
        element={
          <ProtectedRoute>
            <AddItemPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/outfit"
        element={
          <ProtectedRoute>
            <OutfitPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
