import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
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
  const queryClient = useQueryClient();
  const [newRule, setNewRule] = useState({ type: 'PREFIX' as RuleType, pattern: '' });
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());

  // Fetch rules
  const { data: rules, isLoading: rulesLoading } = useQuery<Rule[]>(
    ['rules', accountId],
    () => axios.get(`/api/rules/${accountId}`).then(res => res.data),
    { enabled: !!accountId }
  );

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Spam Profile Cleaner</h1>

        {/* Add Rule Section */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Cleanup Rule</h2>
          <div className="flex gap-4">
            <select
              value={newRule.type}
              onChange={(e) => setNewRule({ ...newRule, type: e.target.value as RuleType })}
              className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              placeholder="e.g., noreply or tempmail.com"
              className="border rounded px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => createRule.mutate(newRule)}
              disabled={!newRule.pattern || createRule.isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createRule.isLoading ? 'Adding...' : 'Add Rule'}
            </button>
          </div>
        </section>

        {/* Active Rules */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Active Rules</h2>
          {rulesLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : rules?.length === 0 ? (
            <p className="text-gray-500">No rules configured yet.</p>
          ) : (
            <ul className="space-y-2">
              {rules?.map((rule) => (
                <li key={rule.id} className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-700">
                    <strong className="text-gray-900">{rule.type}:</strong> {rule.pattern}
                  </span>
                  <button
                    onClick={() => deleteRule.mutate(rule.id)}
                    disabled={deleteRule.isLoading}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Scan Section */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Scan & Clean</h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => previewScan.mutate()}
              disabled={previewScan.isLoading || rules?.length === 0}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewScan.isLoading ? 'Scanning...' : 'Preview Matches'}
            </button>
            {scanResults.length > 0 && (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${selectedProfiles.size} profiles?`)) {
                    executeDeletion.mutate();
                  }
                }}
                disabled={executeDeletion.isLoading || selectedProfiles.size === 0}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executeDeletion.isLoading 
                  ? 'Deleting...' 
                  : `Delete ${selectedProfiles.size} Profiles`}
              </button>
            )}
          </div>

          {/* Scan Results */}
          {previewScan.isLoading && (
            <div className="text-center py-8">
              <p className="text-gray-600">Scanning profiles...</p>
            </div>
          )}
          
          {scanResults.length > 0 && (
            <div className="border rounded">
              <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-800">
                Found {scanResults.length} matching profiles
              </div>
              <div className="max-h-64 overflow-y-auto">
                {scanResults.map((result) => (
                  <div
                    key={result.profileId}
                    className="flex items-center gap-3 px-4 py-2 border-t hover:bg-gray-50"
                  >
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
                      className="cursor-pointer"
                    />
                    <span className="flex-1 text-gray-700">{result.email}</span>
                    <span className="text-sm text-gray-500">{result.matchedRule}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Scheduled Cleanup Section */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Scheduled Cleanup</h2>
          
          {scheduleLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <div className="space-y-4">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enableSchedule"
                  checked={schedule?.isEnabled || false}
                  onChange={(e) => {
                    updateSchedule.mutate({
                      isEnabled: e.target.checked,
                      frequencyDays: schedule?.frequencyDays || 7,
                    });
                  }}
                  disabled={updateSchedule.isLoading}
                  className="w-5 h-5 cursor-pointer"
                />
                <label htmlFor="enableSchedule" className="text-gray-700 font-medium cursor-pointer">
                  Enable automatic cleanup
                </label>
              </div>

              {/* Frequency Selection */}
              {schedule?.isEnabled && (
                <div className="pl-8 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Run every:
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="frequency"
                          value="1"
                          checked={schedule?.frequencyDays === 1}
                          onChange={() => updateSchedule.mutate({ isEnabled: true, frequencyDays: 1 })}
                          disabled={updateSchedule.isLoading}
                          className="cursor-pointer"
                        />
                        <span className="text-gray-700">24 hours</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="frequency"
                          value="7"
                          checked={schedule?.frequencyDays === 7}
                          onChange={() => updateSchedule.mutate({ isEnabled: true, frequencyDays: 7 })}
                          disabled={updateSchedule.isLoading}
                          className="cursor-pointer"
                        />
                        <span className="text-gray-700">7 days</span>
                      </label>
                    </div>
                  </div>

                  {/* Schedule Info */}
                  <div className="bg-gray-50 rounded p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last run:</span>
                      <span className="text-gray-900">{formatDate(schedule?.lastRunAt || null)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Next run:</span>
                      <span className="text-gray-900 font-medium">{getNextRunText()}</span>
                    </div>
                  </div>

                  {/* Manual Run Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        if (confirm('Run cleanup now? This will delete all profiles matching your rules.')) {
                          manualRun.mutate();
                        }
                      }}
                      disabled={manualRun.isLoading || rules?.length === 0}
                      className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {manualRun.isLoading ? 'Running...' : 'Run Cleanup Now'}
                    </button>
                  </div>
                </div>
              )}

              {!schedule?.isEnabled && (
                <p className="text-sm text-gray-500 pl-8">
                  Enable automatic cleanup to have spam profiles deleted automatically based on your rules.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

