import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import Head from 'next/head'
import axios from 'axios'
import { getToken, clearToken } from '@/utils/auth'

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err.response?.status;
        const code = err.response?.data?.code;
        // Clear Google session only when full re-auth required; never on Klaviyo reconnect (user stays logged in)
        if (status === 401 && code !== 'KLAVIYO_RECONNECT' && (code === 'AUTH_REQUIRED' || !code)) {
          clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
        return Promise.reject(err);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <meta name="application-name" content="Klaviyo Spam Profile Cleaner" />
        <meta name="apple-mobile-web-app-title" content="Spam Cleaner" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </Head>
      <Component {...pageProps} />
    </QueryClientProvider>
  )
}

