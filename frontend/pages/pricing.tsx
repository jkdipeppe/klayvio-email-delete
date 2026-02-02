import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';

export default function PricingPage() {
  const router = useRouter();
  const { accountId, tier: selectedTier } = router.query;
  const [loading, setLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Wait for router to be ready
    if (!router.isReady) return;

    // Check if we have accountId from OAuth callback
    if (accountId && typeof accountId === 'string') {
      setIsAuthenticated(true);
      fetchSubscriptionStatus(accountId);
      
      // Check for tier selection from sessionStorage (set before OAuth) or URL param
      const storedTier = sessionStorage.getItem('selectedTier');
      const tierToUse = (selectedTier as string) || storedTier;
      
      if (tierToUse && typeof tierToUse === 'string') {
        // Clear the stored tier immediately to prevent re-triggering
        sessionStorage.removeItem('selectedTier');
        // Wait for subscription status to load, then handle navigation
        setTimeout(() => {
          handlePostAuthTier(accountId, tierToUse);
        }, 1000); // Give time for subscription status to load
      } else {
        setCheckingAuth(false);
      }
    } else {
      setIsAuthenticated(false);
      setCheckingAuth(false);
    }
  }, [router.isReady, accountId, selectedTier]);

  const fetchSubscriptionStatus = async (accountId: string) => {
    try {
      const res = await axios.get(`/api/subscription/${accountId}`);
      setCurrentSubscription(res.data);
      setCheckingAuth(false);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      setCheckingAuth(false);
    }
  };

  const handlePostAuthTier = async (accountId: string, tier: string) => {
    if (tier === 'FREE') {
      // Navigate to dashboard for free tier
      router.push(`/dashboard?accountId=${accountId}`);
    } else if (tier === 'BASIC' || tier === 'PRO') {
      // Wait a moment for subscription status to be fetched, then navigate to Stripe checkout
      setTimeout(() => {
        handleSubscribe(tier as 'BASIC' | 'PRO', accountId);
      }, 500);
    }
  };

  const handleConnectKlaviyo = (tier?: 'FREE' | 'BASIC' | 'PRO') => {
    // Store the selected tier in sessionStorage so we can use it after OAuth
    if (tier) {
      sessionStorage.setItem('selectedTier', tier);
    }
    // Start OAuth flow
    window.location.href = '/auth/klaviyo';
  };

  const handleSubscribe = async (tier: 'BASIC' | 'PRO', providedAccountId?: string) => {
    const targetAccountId = providedAccountId || accountId;
    
    if (!targetAccountId || typeof targetAccountId !== 'string') {
      // Not authenticated - start OAuth flow with tier selection
      handleConnectKlaviyo(tier);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/subscription/checkout', {
        accountId: targetAccountId,
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

  const handleSelectFree = async () => {
    if (!accountId || typeof accountId !== 'string') {
      // Not authenticated - start OAuth flow
      handleConnectKlaviyo('FREE');
      return;
    }
    
    // Already authenticated - just go to dashboard
    router.push(`/dashboard?accountId=${accountId}`);
  };

  const isCurrentTier = (tier: string) => {
    if (!currentSubscription) return false;
    // For FREE tier, check if tier is null/undefined or explicitly FREE
    if (tier === 'FREE') {
      return !currentSubscription.tier || currentSubscription.tier === 'FREE';
    }
    return currentSubscription.tier === tier && currentSubscription.status === 'ACTIVE';
  };

  return (
    <>
      <Head>
        <title>Pricing - Klaviyo Spam Profile Cleaner</title>
        <meta name="description" content="Choose the perfect plan for your spam profile cleanup needs" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/SpamProfileCleanerIcon.png" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Navigation Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.push('/')}
                className="flex items-center text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </button>
              {isAuthenticated && accountId && (
                <button
                  onClick={() => router.push(`/dashboard?accountId=${accountId}`)}
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Go to Dashboard →
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
            <p className="text-xl text-gray-600">
              Select the perfect plan for your spam profile cleanup needs
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 `}>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Free</h2>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">1 deletion rule</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">3 profiles per deletion</span>
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
                onClick={handleSelectFree}
                disabled={isCurrentTier('FREE') || (!currentSubscription?.tier && isAuthenticated)}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  isCurrentTier('FREE') || (!currentSubscription?.tier && isAuthenticated)
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isCurrentTier('FREE') || (!currentSubscription?.tier && isAuthenticated) 
                  ? 'Current Plan' 
                  : isAuthenticated 
                    ? 'Go to Dashboard' 
                    : 'Get Started Free'}
              </button>
              {(isCurrentTier('FREE') && currentSubscription?.status === 'ACTIVE') && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 mt-4">
                  Current Plan
                </div>
              )}
            </div>

            {/* Basic Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 ${isCurrentTier('BASIC') ? 'ring-2 ring-indigo-500' : ''}`}>
             
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
                  <span className="text-gray-700">Unlimited profiles per deletion</span>
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
                {loading ? 'Processing...' : isCurrentTier('BASIC') ? 'Current Plan' : isAuthenticated ? 'Subscribe' : 'Connect & Subscribe'}
              </button>
              {(isCurrentTier('BASIC') && currentSubscription?.status === 'ACTIVE') ?? (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 mb-4">
                  Current Plan
                </div>)
              }
            </div>

            {/* Pro Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 border-indigo-500 relative ${isCurrentTier('PRO') ? 'ring-2 ring-indigo-500' : ''}`}>
             
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
                  <span className="text-gray-700">Unlimited profiles per deletion</span>
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
                {loading ? 'Processing...' : isCurrentTier('PRO') ? 'Current Plan' : isAuthenticated ? 'Subscribe' : 'Connect & Subscribe'}
              </button>
              {(isCurrentTier('PRO') && currentSubscription?.status === 'ACTIVE') ?? (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 mb-4">
                  Current Plan
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="text-center mt-8">
            {!isAuthenticated && (
              <p className="text-gray-600 text-sm">
                Connect your Klaviyo account to get started
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-600">
              <p className="mb-2">Klaviyo Spam Profile Cleaner</p>
              <p className="text-sm">
                <a href="/privacy" className="text-indigo-600 hover:text-indigo-700 underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

