/**
 * Check if an API error indicates that re-authentication is required
 */
export function isReauthRequired(error: any): boolean {
  if (!error?.response?.data) return false;

  const data = error.response.data;
  const status = error.response.status;

  // 401: session expired or auth required
  if (status === 401 && (data.code === 'AUTH_REQUIRED' || data.code === 'KLAVIYO_RECONNECT' || data.requiresReauth === true)) {
    return true;
  }

  return false;
}

/**
 * Get the re-authentication error message
 */
export function getReauthMessage(error: any): string {
  if (!isReauthRequired(error)) return '';
  const code = error.response?.data?.code;
  if (code === 'KLAVIYO_RECONNECT') {
    return error.response?.data?.error || 'Your Klaviyo connection has expired. Please reconnect your account.';
  }
  return error.response?.data?.error || 'Your session has expired. Please sign in again.';
}

