const JWT_KEY = 'klaviyo_cleaner_jwt';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(JWT_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(JWT_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(JWT_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** Start Klaviyo OAuth by POSTing the session token to the backend (token is not sent in the URL). */
export function submitKlaviyoConnectForm(): void {
  const token = getToken();
  if (!token) return;
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/auth/klaviyo';
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'token';
  input.value = token;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}
