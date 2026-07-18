import { useNavigate, Navigate } from 'react-router-dom';
import WelcomePage from '../components/onboarding/WelcomePage';

const ONBOARDING_KEY = 'grokdeck_onboarding_done';

export default function OnboardingRoute() {
  const navigate = useNavigate();
  const onboardingDone = localStorage.getItem(ONBOARDING_KEY) === 'true';

  // If already done, redirect to main
  if (onboardingDone) {
    return <Navigate to="/" replace />;
  }

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    navigate('/signin');
  };

  return <WelcomePage onComplete={handleComplete} />;
}
