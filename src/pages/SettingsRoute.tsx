import { useNavigate } from 'react-router-dom';
import SettingsPage from '../components/settings/SettingsPage';
import { useAuth } from '../hooks/useAuth';

export default function SettingsRoute() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <SettingsPage
      onClose={() => navigate('/')}
      onSignOut={() => {
        signOut();
        navigate('/signin');
      }}
    />
  );
}
