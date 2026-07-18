import { Navigate, useNavigate } from 'react-router-dom';
import SignInPage from '../components/signin/SignInPage';
import { useAuth } from '../hooks/useAuth';

export default function SignInRoute() {
  const navigate = useNavigate();
  const { authenticated, signIn } = useAuth();

  // If already authenticated, redirect to main
  if (authenticated === true) {
    return <Navigate to="/" replace />;
  }

  const handleAuthenticated = () => {
    signIn();
    navigate('/');
  };

  return <SignInPage onAuthenticated={handleAuthenticated} />;
}
