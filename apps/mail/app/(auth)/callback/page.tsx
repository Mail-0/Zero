import { getSession } from '@/lib/auth-client';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function checkUser() {
      const session = await getSession();

      if (!session.data?.user) {
        navigate('/');
        return;
      }

      // temporary: always send to signup first
      navigate('/zero/signup');
    }

    checkUser();
  }, [navigate]);

  return <div>Checking your account...</div>;
}