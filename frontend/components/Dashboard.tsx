import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useRouter } from 'next/router';
import axios from 'axios';

type RuleType = 'PREFIX' | 'SUFFIX' | 'DOMAIN' | 'CONTAINS';

interface Rule {
  id: string;
  type: RuleType;
  pattern: string;
  isActive: boolean;
}

interface ScanResult {
  email: string;
  profileId: string;
  matchedRule: string;
}

interface Schedule {
  isEnabled: boolean;
  frequencyDays: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export default function Dashboard({ accountId }: { accountId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newRule, setNewRule] = useState({ type: 'PREFIX' as RuleType, pattern: '' });
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());

  // Fetch subscription status
  const { data: subscription, isLoading: subscriptionLoading } = useQuery(
    ['subscription', accountId],
    () => axios.get(`/api/subscription/${accountId}`).then(res => res.data),
    { enabled: !!accountId }
  );

  // Fetch rules
  const { data: rulesData, isLoading: rulesLoading } = useQuery(
    ['rules', accountId],
    () => axios.get(`/api/rules/${accountId}`).then(res => res.data),
    { enabled: !!accountId }
  );

  const rules = rulesData?.rules || rulesData || []; // Handle both old and new response format
  const ruleLimits = rulesData?.limits || { current: rules.length, max: 5, canCreateMore: true };

  // Create rule mutation
  const createRule = useMutation(
    (rule: { type: RuleType; pattern: string }) =>
      axios.post(`/api/rules/${accountId}`, rule),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rules', accountId]);
        setNewRule({ type: 'PREFIX', pattern: '' });
      },
    }
  );

  // Delete rule mutation
  const deleteRule = useMutation(
    (ruleId: string) => axios.delete(`/api/rules/${ruleId}`),
    {
      onSuccess: () => queryClient.invalidateQueries(['rules', accountId]),
    }
  );

  // Preview scan
  const previewScan = useMutation(
    () => axios.get(`/api/scan/${accountId}/preview`),
    {
      onSuccess: (res) => {
        setScanResults(res.data.matches);
        setSelectedProfiles(new Set(res.data.matches.map((m: ScanResult) => m.profileId)));
      },
    }
  );

  // Execute deletion
  const executeDeletion = useMutation(
    () => axios.post(`/api/scan/${accountId}/execute`, {
      profileIds: Array.from(selectedProfiles),
    }),
    {
      onSuccess: (res) => {
        alert(`Deleted: ${res.data.deleted}, Failed: ${res.data.failed}`);
        setScanResults([]);
        setSelectedProfiles(new Set());
        queryClient.invalidateQueries(['rules', accountId]);
      },
    }
  );

  // Fetch schedule
  const { data: schedule, isLoading: scheduleLoading } = useQuery<Schedule>(
    ['schedule', accountId],
    () => axios.get(`/api/schedule/${accountId}`).then(res => res.data),
    { enabled: !!accountId }
  );

  // Update schedule mutation
  const updateSchedule = useMutation(
    (data: { isEnabled: boolean; frequencyDays: number }) =>
      axios.post(`/api/schedule/${accountId}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['schedule', accountId]);
        queryClient.invalidateQueries(['schedule-history', accountId]);
      },
      onError: (error: any) => {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to update schedule';
        alert(`Error: ${errorMessage}`);
        console.error('Schedule update error:', error);
      },
    }
  );

  // Manual run mutation
  const manualRun = useMutation(
    () => axios.post(`/api/schedule/${accountId}/run`),
    {
      onSuccess: (res) => {
        alert(`Cleanup completed!\nFound: ${res.data.profilesFound}\nDeleted: ${res.data.profilesDeleted}\nFailed: ${res.data.profilesFailed}`);
        queryClient.invalidateQueries(['schedule', accountId]);
        queryClient.invalidateQueries(['schedule-history', accountId]);
      },
      onError: (error: any) => {
        alert(`Cleanup failed: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getNextRunText = () => {
    if (!schedule?.isEnabled) return 'Not scheduled';
    if (!schedule.nextRunAt) return 'Calculating...';
    const nextRun = new Date(schedule.nextRunAt);
    const now = new Date();
    const diffMs = nextRun.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return 'Due now';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Spam Profile Cleaner</h1>
                <p className="text-sm text-gray-500">Dashboard</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure Connection</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Subscription Status Banner */}
        {subscription && (
          <div className={`mb-6 rounded-xl p-4 border-2 ${
            subscription.tier === 'PRO' 
              ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300' 
              : subscription.tier === 'BASIC'
              ? 'bg-blue-50 border-blue-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  subscription.tier === 'PRO' ? 'bg-indigo-600' : subscription.tier === 'BASIC' ? 'bg-blue-600' : 'bg-yellow-600'
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {subscription.tier === 'PRO' ? 'Pro Plan' : subscription.tier === 'BASIC' ? 'Basic Plan' : 'Free Plan'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {subscription.tier === 'PRO' ? '$7/month' : subscription.tier === 'BASIC' ? '$5/month' : 'No subscription'}
                    {subscription.subscription?.cancelAtPeriodEnd && subscription.subscription?.currentPeriodEnd && (
                      <span className="block text-xs text-yellow-700 mt-1">
                        Canceling on {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {subscription.tier && (
                  <button
                    onClick={() => router.push(`/subscription?accountId=${accountId}`)}
                    className="px-4 py-2 bg-white text-indigo-600 border border-indigo-300 rounded-lg font-semibold hover:bg-indigo-50 transition-colors text-sm"
                  >
                    Manage
                  </button>
                )}
                {(!subscription.tier || subscription.tier !== 'PRO') && (
                  <button
                    onClick={() => router.push(`/pricing?accountId=${accountId}`)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm"
                  >
                    {subscription.tier ? 'Upgrade' : 'Subscribe'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Rules</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                  {rulesLoading ? '...' : rules?.length || 0}
                  {ruleLimits.max && (
                    <span className="text-lg text-gray-500 font-normal"> / {ruleLimits.max}</span>
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Profiles Found</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                  {scanResults.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Auto Cleanup</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                  {schedule?.isEnabled ? 'ON' : 'OFF'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Add Rule Section */}
        <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add Cleanup Rule</h2>
              <p className="text-sm text-gray-500 mt-1">Create rules to automatically identify spam profiles</p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-3 font-medium">Rule Types:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex items-center">
                <span className="font-semibold text-gray-900 mr-2">PREFIX:</span>
                <span>Email starts with (e.g., "noreply")</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold text-gray-900 mr-2">SUFFIX:</span>
                <span>Email ends with (e.g., "@tempmail.com")</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold text-gray-900 mr-2">DOMAIN:</span>
                <span>Domain equals (e.g., "spam.com")</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold text-gray-900 mr-2">CONTAINS:</span>
                <span>Email contains (e.g., "test")</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <select
              value={newRule.type}
              onChange={(e) => setNewRule({ ...newRule, type: e.target.value as RuleType })}
              className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
            >
              <option value="PREFIX">Email starts with</option>
              <option value="SUFFIX">Email ends with</option>
              <option value="DOMAIN">Domain equals</option>
              <option value="CONTAINS">Email contains</option>
            </select>
            <input
              type="text"
              value={newRule.pattern}
              onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
              placeholder="e.g., noreply or @tempmail.com"
              className="border border-gray-300 rounded-lg px-4 py-2.5 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {ruleLimits.canCreateMore === false && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Rule limit reached!</strong> You have {ruleLimits.current}/{ruleLimits.max} rules. 
                  {subscription?.tier !== 'PRO' && (
                    <span> <a href={`/pricing?accountId=${accountId}`} className="underline font-semibold">Upgrade to Pro</a> for up to 100 rules.</span>
                  )}
                </p>
              </div>
            )}
            <button
              onClick={() => createRule.mutate(newRule)}
              disabled={!newRule.pattern || createRule.isLoading || !ruleLimits.canCreateMore}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {createRule.isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Rule
                </>
              )}
            </button>
          </div>
        </section>

        {/* Active Rules */}
        <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Active Rules</h2>
                <p className="text-sm text-gray-500 mt-1">Rules currently identifying spam profiles</p>
              </div>
            </div>
            {rules && rules.length > 0 && (
              <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
              </span>
            )}
          </div>
          
          {rulesLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : rules?.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No rules configured</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding your first cleanup rule above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules?.map((rule: Rule) => (
                <div key={rule.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-indigo-600">{rule.type.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{rule.type}:</span>
                        <span className="text-sm text-gray-700 break-all">{rule.pattern}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Remove rule "${rule.type}: ${rule.pattern}"?`)) {
                        deleteRule.mutate(rule.id);
                      }
                    }}
                    disabled={deleteRule.isLoading}
                    className="flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Scan Section */}
        <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Scan & Clean</h2>
              <p className="text-sm text-gray-500 mt-1">Preview and delete matching spam profiles</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
            <button
              onClick={() => previewScan.mutate()}
              disabled={previewScan.isLoading || rules?.length === 0}
              className="flex items-center justify-center gap-2 bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {previewScan.isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Preview Matches
                </>
              )}
            </button>
            {scanResults.length > 0 && (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${selectedProfiles.size} profile${selectedProfiles.size !== 1 ? 's' : ''}? This action cannot be undone.`)) {
                    executeDeletion.mutate();
                  }
                }}
                disabled={executeDeletion.isLoading || selectedProfiles.size === 0}
                className="flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {executeDeletion.isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete {selectedProfiles.size} Profile{selectedProfiles.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Scan Results */}
          {previewScan.isLoading && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 font-medium">Scanning your Klaviyo profiles...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </div>
          )}
          
          {scanResults.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-gray-900">
                      Found {scanResults.length} matching profile{scanResults.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={selectedProfiles.size === scanResults.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProfiles(new Set(scanResults.map(r => r.profileId)));
                        } else {
                          setSelectedProfiles(new Set());
                        }
                      }}
                      className="cursor-pointer w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span>Select all</span>
                  </div>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto bg-white">
                {scanResults.map((result, index) => (
                  <div
                    key={result.profileId}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${index === 0 ? '' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedProfiles.has(result.profileId)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedProfiles);
                          if (e.target.checked) {
                            newSelected.add(result.profileId);
                          } else {
                            newSelected.delete(result.profileId);
                          }
                          setSelectedProfiles(newSelected);
                        }}
                        className="cursor-pointer w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-900 font-medium break-all">{result.email}</div>
                        <div className="text-xs text-gray-500 mt-1">Matched: {result.matchedRule}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!previewScan.isLoading && scanResults.length === 0 && rules && rules.length > 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No matches found</h3>
              <p className="mt-1 text-sm text-gray-500">Your Klaviyo account is clean! No profiles match your rules.</p>
            </div>
          )}
        </section>

        {/* Scheduled Cleanup Section */}
        <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Scheduled Cleanup</h2>
              <p className="text-sm text-gray-500 mt-1">Automate profile removal on a schedule</p>
            </div>
          </div>
          
          {scheduleLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="enableSchedule"
                  checked={schedule?.isEnabled || false}
                  onChange={(e) => {
                    if (e.target.checked && !subscription?.canSchedule) {
                      alert('Automatic scheduling is only available on the Pro plan ($7/month). Please upgrade to enable this feature.');
                      return;
                    }
                    updateSchedule.mutate({
                      isEnabled: e.target.checked,
                      frequencyDays: schedule?.frequencyDays || 7,
                    });
                  }}
                  disabled={updateSchedule.isLoading || !subscription?.canSchedule}
                  className="w-5 h-5 cursor-pointer text-indigo-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <label htmlFor="enableSchedule" className="text-gray-900 font-semibold cursor-pointer flex-1">
                  Enable automatic cleanup
                  {!subscription?.canSchedule && (
                    <span className="block text-xs text-gray-500 mt-1 font-normal">Pro plan required</span>
                  )}
                </label>
                {schedule?.isEnabled && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Active
                  </span>
                )}
              </div>
              {!subscription?.canSchedule && (
                <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="text-sm text-indigo-800 mb-2">
                    <strong>Upgrade to Pro</strong> to enable automatic scheduling
                  </p>
                  <button
                    onClick={() => router.push(`/pricing?accountId=${accountId}`)}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 underline"
                  >
                    View Pro Plan →
                  </button>
                </div>
              )}

              {/* Frequency Selection */}
              {schedule?.isEnabled && (
                <div className="space-y-6 pl-2 sm:pl-4">
                  <div className="bg-indigo-50 rounded-lg p-4 sm:p-6 border border-indigo-100">
                    <label className="block text-sm font-semibold text-gray-900 mb-4">
                      Run cleanup every:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        schedule?.frequencyDays === 1 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      } ${updateSchedule.isLoading ? 'opacity-50' : ''}`}>
                        <input
                          type="radio"
                          name="frequency"
                          value="1"
                          checked={schedule?.frequencyDays === 1}
                          onChange={(e) => {
                            e.preventDefault();
                            const frequencyDays = parseInt(e.target.value, 10);
                            updateSchedule.mutate({ 
                              isEnabled: schedule?.isEnabled !== false, 
                              frequencyDays 
                            });
                          }}
                          disabled={updateSchedule.isLoading}
                          className="cursor-pointer w-4 h-4 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">24 hours</div>
                          <div className="text-xs text-gray-500">Daily cleanup</div>
                        </div>
                        {updateSchedule.isLoading && schedule?.frequencyDays === 1 && (
                          <svg className="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                      </label>
                      <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        schedule?.frequencyDays === 7 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      } ${updateSchedule.isLoading ? 'opacity-50' : ''}`}>
                        <input
                          type="radio"
                          name="frequency"
                          value="7"
                          checked={schedule?.frequencyDays === 7}
                          onChange={(e) => {
                            e.preventDefault();
                            const frequencyDays = parseInt(e.target.value, 10);
                            updateSchedule.mutate({ 
                              isEnabled: schedule?.isEnabled !== false, 
                              frequencyDays 
                            });
                          }}
                          disabled={updateSchedule.isLoading}
                          className="cursor-pointer w-4 h-4 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">7 days</div>
                          <div className="text-xs text-gray-500">Weekly cleanup</div>
                        </div>
                        {updateSchedule.isLoading && schedule?.frequencyDays === 7 && (
                          <svg className="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Schedule Info */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 sm:p-6 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Schedule Status</h3>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Last run:
                        </div>
                        <span className="text-sm font-medium text-gray-900">{formatDate(schedule?.lastRunAt || null)}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          Next run:
                        </div>
                        <span className="text-sm font-bold text-indigo-600">{getNextRunText()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Manual Run Button */}
                  <div>
                    <button
                      onClick={() => {
                        if (confirm('Run cleanup now? This will delete all profiles matching your active rules.')) {
                          manualRun.mutate();
                        }
                      }}
                      disabled={manualRun.isLoading || rules?.length === 0}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {manualRun.isLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Running...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Run Cleanup Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {!schedule?.isEnabled && (
                <div className="bg-gray-50 rounded-lg p-6 border-2 border-dashed border-gray-300 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-600">
                    Enable automatic cleanup to have spam profiles deleted automatically based on your rules.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>Klaviyo Spam Profile Cleaner - Keep your account clean automatically</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

