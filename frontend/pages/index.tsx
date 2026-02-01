import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Wait for router to be ready before checking
    if (!router.isReady) return;
    
    // Check if we have accountId in URL (from OAuth callback)
    const { accountId } = router.query;
    if (accountId) {
      router.push(`/dashboard?accountId=${accountId}`);
      return;
    }
    setCheckingAuth(false);
  }, [router.isReady, router.query, router]);

  const handleConnect = () => {
    window.location.href = '/auth/klaviyo';
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Klaviyo Spam Profile Cleaner</title>
        <meta name="description" content="Clean up spam profiles from your Klaviyo account" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Klaviyo Spam Profile Cleaner</h1>
          <p className="text-gray-600 mb-8">
            Automatically identify and delete spam profiles from your Klaviyo account based on configurable email patterns.
          </p>
          <button
            onClick={handleConnect}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Connect with Klaviyo
          </button>
        </div>
      </main>
    </>
  );
}

