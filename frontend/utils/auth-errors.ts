/**
 * Check if an API error indicates that re-authentication is required
 */
export function isReauthRequired(error: any): boolean {
  if (!error?.response?.data) return false;
  
  const data = error.response.data;
  return (
    error.response.status === 401 &&
    (data.code === 'AUTH_REQUIRED' || data.requiresReauth === true)
  );
}

/**
 * Get the re-authentication error message
 */
export function getReauthMessage(error: any): string {
  if (isReauthRequired(error)) {
    return error.response?.data?.error || 'Your Klaviyo connection has expired. Please reconnect your account.';
  }
  return '';
}

