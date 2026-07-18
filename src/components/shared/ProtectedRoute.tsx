import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ONBOARDING_KEY = 'grokdeck_onboarding_done';

/**
 * Protected route wrapper:
 * 1. If onboarding not done → redirect to /onboarding
 * 2. If not authenticated → redirect to /signin
 * 3. If still checking auth → render nothing (brief flash)
 * 4. Otherwise → render children
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  const onboardingDone = localStorage.getItem(ONBOARDING_KEY) === 'true';

  if (!onboardingDone) {
    return <Navigate to="/onboarding" replace />;
  }

  if (authenticated === null) {
    // Still checking — don't flash any page
    return null;
  }

  if (authenticated === false) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
