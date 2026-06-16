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
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
