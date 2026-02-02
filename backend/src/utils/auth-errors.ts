/**
 * Custom error class for authentication/decryption failures
 * This allows us to identify when a user needs to re-authenticate
 */
export class AuthenticationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

/**
 * Check if an error is an authentication/decryption error that requires re-authentication
 */
export function isAuthenticationRequiredError(error: any): boolean {
  return (
    error instanceof AuthenticationRequiredError ||
    (error?.message && (
      error.message.includes('Decryption failed') ||
      error.message.includes('re-authenticate') ||
      error.message.includes('Token decryption failed')
    ))
  );
}

