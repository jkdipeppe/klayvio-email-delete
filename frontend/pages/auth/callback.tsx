import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';
import { setToken } from '@/utils/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { code, error, message } = router.query;
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    if (error && message) {
      router.replace(`/?error=${error}&message=${encodeURIComponent(message as string)}`);
      return;
    }

    if (code && typeof code === 'string') {
      axios
        .post('/auth/exchange-token', { code }, { headers: { 'Content-Type': 'application/json' } })
        .then((res) => {
          const token = res.data?.token;
          if (token) {
            setToken(token);
            router.replace('/');
          } else {
            setExchangeError('Invalid response');
          }
        })
        .catch(() => {
          setExchangeError('Invalid or expired code. Please sign in again.');
        });
      return;
    }

    router.replace('/');
  }, [router.isReady, code, error, message, router]);

  return (
    <>
      <Head>
        <title>Signing you in... - Klaviyo Spam Profile Cleaner</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center">
          {exchangeError ? (
            <>
              <p className="text-red-600 mb-4">{exchangeError}</p>
              <a href="/" className="text-indigo-600 underline">Return home</a>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
              <p className="text-gray-600">Signing you in...</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
