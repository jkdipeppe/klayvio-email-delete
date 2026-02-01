import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function ErrorPage() {
  const router = useRouter();
  const { message } = router.query;

  return (
    <>
      <Head>
        <title>Error - Klaviyo Spam Profile Cleaner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-6">
            {message || 'An error occurred during authentication. Please try again.'}
          </p>
          <Link
            href="/"
            className="inline-block bg-indigo-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Go Back Home
          </Link>
        </div>
      </main>
    </>
  );
}

