import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';

export default function PricingPage() {
  const router = useRouter();
  const { accountId } = router.query;
  const [loading, setLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);

  useEffect(() => {
    if (accountId && typeof accountId === 'string') {
      fetchSubscriptionStatus(accountId);
    }
  }, [accountId]);

  const fetchSubscriptionStatus = async (accountId: string) => {
    try {
      const res = await axios.get(`/api/subscription/${accountId}`);
      setCurrentSubscription(res.data);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  };

  const handleSubscribe = async (tier: 'BASIC' | 'PRO') => {
    if (!accountId || typeof accountId !== 'string') {
      alert('Please connect your Klaviyo account first');
      router.push('/');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/subscription/checkout', {
        accountId,
        tier,
      });

      // Redirect to Stripe Checkout
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.error || error.message}`);
      setLoading(false);
    }
  };

  const isCurrentTier = (tier: string) => {
    return currentSubscription?.tier === tier && currentSubscription?.status === 'ACTIVE';
  };

  return (
    <>
      <Head>
        <title>Pricing - Klaviyo Spam Profile Cleaner</title>
        <meta name="description" content="Choose the perfect plan for your spam profile cleanup needs" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/SpamProfileCleanerIcon.png" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
            <p className="text-xl text-gray-600">
              Select the perfect plan for your spam profile cleanup needs
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Basic Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 ${isCurrentTier('BASIC') ? 'ring-2 ring-indigo-500' : ''}`}>
              {isCurrentTier('BASIC') && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 mb-4">
                  Current Plan
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic</h2>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$5</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Up to 5 deletion rules</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Unlimited manual cleanup runs</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-500">Automatic scheduling</span>
                </li>
              </ul>
              <button
                onClick={() => handleSubscribe('BASIC')}
                disabled={loading || isCurrentTier('BASIC')}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  isCurrentTier('BASIC')
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {loading ? 'Processing...' : isCurrentTier('BASIC') ? 'Current Plan' : 'Subscribe'}
              </button>
            </div>

            {/* Pro Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 border-indigo-500 relative ${isCurrentTier('PRO') ? 'ring-2 ring-indigo-500' : ''}`}>
              {isCurrentTier('PRO') && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 mb-4">
                  Current Plan
                </div>
              )}
              {!isCurrentTier('PRO') && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white px-4 py-1 rounded-bl-lg rounded-tr-2xl text-sm font-semibold">
                  Popular
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Pro</h2>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$7</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Up to 100 deletion rules</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Unlimited manual cleanup runs</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Automatic scheduling (daily/weekly)</span>
                </li>
              </ul>
              <button
                onClick={() => handleSubscribe('PRO')}
                disabled={loading || isCurrentTier('PRO')}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  isCurrentTier('PRO')
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {loading ? 'Processing...' : isCurrentTier('PRO') ? 'Current Plan' : 'Subscribe'}
              </button>
            </div>
          </div>

          {/* Back to Dashboard */}
          {accountId && (
            <div className="text-center mt-8">
              <button
                onClick={() => router.push(`/dashboard?accountId=${accountId}`)}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                ← Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

