import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '../features/landing';
import { LoginPage, RegisterPage, ProtectedRoute } from '../features/auth';
import { OnboardingPage } from '../features/onboarding';
import { WardrobePage, AddItemPage, BulkAddPage } from '../features/wardrobe';
import ReviewItemPage from '../features/wardrobe/components/ReviewItemPage';
import { OutfitPage } from '../features/outfit';
import { CalendarPage } from '../features/calendar';
import { SettingsPage } from '../features/settings';
import { HistoryPage } from '../features/history';
import AppLayout from './AppLayout';

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
      {/* Capture flows stand alone — no app chrome. */}
      <Route
        path="/wardrobe/add"
        element={
          <ProtectedRoute>
            <BulkAddPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wardrobe/add/camera"
        element={
          <ProtectedRoute>
            <AddItemPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wardrobe/add/review"
        element={
          <ProtectedRoute>
            <ReviewItemPage />
          </ProtectedRoute>
        }
      />

      {/* In-app pages share the header + floating bottom tab bar. */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/wardrobe" element={<WardrobePage />} />
        <Route path="/outfit" element={<OutfitPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Route>
    </Routes>
  );
}
