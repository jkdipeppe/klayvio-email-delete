import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

export default function SubscriptionPage() {
  const router = useRouter();
  const { accountId } = router.query;
  const queryClient = useQueryClient();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showChangeTierConfirm, setShowChangeTierConfirm] = useState<string | null>(null);

  // Fetch subscription status
  const { data: subscription, isLoading, refetch } = useQuery(
    ['subscription', accountId],
    () => axios.get(`/api/subscription/${accountId}`).then(res => res.data),
    { enabled: !!accountId }
  );

  // Cancel subscription mutation
  const cancelSubscription = useMutation(
    () => axios.post(`/api/subscription/${accountId}/cancel`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['subscription', accountId]);
        refetch();
        setShowCancelConfirm(false);
        alert('Your subscription will be canceled at the end of the current billing period.');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  // Change tier mutation
  const changeTier = useMutation(
    (newTier: 'BASIC' | 'PRO') => axios.post(`/api/subscription/${accountId}/change-tier`, { newTier }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['subscription', accountId]);
        refetch();
        setShowChangeTierConfirm(null);
        alert('Subscription tier updated successfully!');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  // Reactivate subscription mutation
  const reactivateSubscription = useMutation(
    () => axios.post(`/api/subscription/${accountId}/reactivate`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['subscription', accountId]);
        refetch();
        alert('Subscription reactivated successfully!');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTierDisplay = (tier: string | null) => {
    switch (tier) {
      case 'PRO':
        return { name: 'Pro Plan', price: '$7/month', color: 'indigo' };
      case 'BASIC':
        return { name: 'Basic Plan', price: '$5/month', color: 'blue' };
      default:
        return { name: 'No Subscription', price: 'Free', color: 'gray' };
    }
  };

  if (!accountId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-indigo-600 text-lg font-medium">Loading subscription...</div>
      </div>
    );
  }

  const currentTier = getTierDisplay(subscription?.tier || null);
  const hasActiveSubscription = subscription?.status === 'ACTIVE' && subscription?.tier;

  return (
    <>
      <Head>
        <title>Subscription Management - Klaviyo Spam Profile Cleaner</title>
        <meta name="description" content="Manage your subscription, change plans, or cancel" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/SpamProfileCleanerIcon.png" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push(`/dashboard?accountId=${accountId}`)}
              className="text-indigo-600 hover:text-indigo-700 font-medium mb-4 flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
            <p className="text-gray-600 mt-2">Manage your subscription, change plans, or cancel</p>
          </div>

          {/* Current Subscription Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Current Subscription</h2>
            
            {!hasActiveSubscription ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Subscription</h3>
                <p className="text-gray-600 mb-6">You're currently on the free plan with limited features.</p>
                <button
                  onClick={() => router.push(`/pricing?accountId=${accountId}`)}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  View Plans & Subscribe
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold bg-${currentTier.color}-100 text-${currentTier.color}-800`}>
                        {currentTier.name}
                      </span>
                      {subscription?.cancelAtPeriodEnd && (
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                          Canceling
                        </span>
                      )}
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{currentTier.price}</p>
                    {subscription?.currentPeriodEnd && (
                      <p className="text-sm text-gray-600 mt-2">
                        {subscription.cancelAtPeriodEnd 
                          ? `Access until ${formatDate(subscription.currentPeriodEnd)}`
                          : `Renews on ${formatDate(subscription.currentPeriodEnd)}`
                        }
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      subscription?.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {subscription?.status || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Subscription Limits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Max Rules</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {subscription?.limits?.maxRules || (subscription?.tier === 'PRO' ? 100 : 5)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Automatic Scheduling</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {subscription?.canSchedule ? '✅ Enabled' : '❌ Disabled'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  {subscription?.cancelAtPeriodEnd ? (
                    <button
                      onClick={() => reactivateSubscription.mutate()}
                      disabled={reactivateSubscription.isLoading}
                      className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {reactivateSubscription.isLoading ? 'Reactivating...' : 'Reactivate Subscription'}
                    </button>
                  ) : (
                    <>
                      {/* Change Tier */}
                      {subscription?.tier === 'BASIC' ? (
                        <button
                          onClick={() => setShowChangeTierConfirm('PRO')}
                          disabled={changeTier.isLoading}
                          className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          Upgrade to Pro Plan ($7/month)
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowChangeTierConfirm('BASIC')}
                          disabled={changeTier.isLoading}
                          className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                          Downgrade to Basic Plan ($5/month)
                        </button>
                      )}

                      {/* Cancel Subscription */}
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                      >
                        Cancel Subscription
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Plan Comparison */}
          {hasActiveSubscription && (
            <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Plan Comparison</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Basic Plan */}
                <div className={`border-2 rounded-lg p-6 ${
                  subscription?.tier === 'BASIC' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                }`}>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Basic Plan</h3>
                  <p className="text-2xl font-bold text-gray-900 mb-4">$5/month</p>
                  <ul className="space-y-2 text-sm text-gray-700 mb-4">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Up to 5 deletion rules
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Unlimited manual cleanup runs
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      No automatic scheduling
                    </li>
                  </ul>
                </div>

                {/* Pro Plan */}
                <div className={`border-2 rounded-lg p-6 ${
                  subscription?.tier === 'PRO' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                }`}>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Pro Plan</h3>
                  <p className="text-2xl font-bold text-gray-900 mb-4">$7/month</p>
                  <ul className="space-y-2 text-sm text-gray-700 mb-4">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Up to 100 deletion rules
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Unlimited manual cleanup runs
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Automatic scheduling (daily/weekly)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Cancel Confirmation Modal */}
          {showCancelConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Cancel Subscription?</h3>
                <p className="text-gray-600 mb-6">
                  Your subscription will remain active until the end of the current billing period ({formatDate(subscription?.currentPeriodEnd)}). 
                  After that, you'll lose access to premium features.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Keep Subscription
                  </button>
                  <button
                    onClick={() => cancelSubscription.mutate()}
                    disabled={cancelSubscription.isLoading}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {cancelSubscription.isLoading ? 'Canceling...' : 'Cancel Subscription'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Change Tier Confirmation Modal */}
          {showChangeTierConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {showChangeTierConfirm === 'PRO' ? 'Upgrade to Pro?' : 'Downgrade to Basic?'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {showChangeTierConfirm === 'PRO' 
                    ? 'You\'ll be charged the prorated difference immediately. Your subscription will be upgraded to Pro Plan with access to 100 rules and automatic scheduling.'
                    : 'You\'ll be credited for the remaining time. Your subscription will be downgraded to Basic Plan with a limit of 5 rules and no automatic scheduling. Make sure you have 5 or fewer rules before downgrading.'
                  }
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowChangeTierConfirm(null)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => changeTier.mutate(showChangeTierConfirm as 'BASIC' | 'PRO')}
                    disabled={changeTier.isLoading}
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {changeTier.isLoading ? 'Processing...' : 'Confirm Change'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

