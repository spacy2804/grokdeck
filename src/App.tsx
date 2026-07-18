import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/shared/ProtectedRoute';
import OnboardingRoute from './pages/OnboardingRoute';
import SignInRoute from './pages/SignInRoute';
import MainPage from './pages/MainPage';
import SettingsRoute from './pages/SettingsRoute';

const ONBOARDING_KEY = 'grokdeck_onboarding_done';

function InitialRedirect() {
  const onboardingDone = localStorage.getItem(ONBOARDING_KEY) === 'true';
  if (!onboardingDone) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/signin" element={<SignInRoute />} />

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsRoute /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<InitialRedirect />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
