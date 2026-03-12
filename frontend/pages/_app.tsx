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
        {/* App identity */}
        <meta name="application-name" content="Klaviyo Spam Profile Cleaner" />
        <meta name="apple-mobile-web-app-title" content="Klaviyo Cleaner" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#4F46E5" />
        <link rel="manifest" href="/manifest.json" />

        {/* Default Open Graph (overridden per-page) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Klaviyo Spam Profile Cleaner" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:image" content="/SpamProfileCleanerIcon.png" />

        {/* Default Twitter Card (overridden per-page) */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:image" content="/SpamProfileCleanerIcon.png" />

        {/* Global SEO signals */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Klaviyo Spam Profile Cleaner" />
        <meta name="keywords" content="klaviyo spam profiles, klaviyo profile cleaner, remove spam emails klaviyo, klaviyo list hygiene, email list cleaning, klaviyo disposable emails" />

        {/* JSON-LD: SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Klaviyo Spam Profile Cleaner",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "Automatically identify and remove spam profiles from your Klaviyo account using customizable email patterns, prefixes, and suffixes. Keep your email list clean and improve deliverability.",
              "offers": [
                {
                  "@type": "Offer",
                  "name": "Free",
                  "price": "0",
                  "priceCurrency": "USD",
                  "description": "1 deletion rule, 3 profiles per deletion, unlimited manual runs"
                },
                {
                  "@type": "Offer",
                  "name": "Basic",
                  "price": "5",
                  "priceCurrency": "USD",
                  "priceSpecification": {
                    "@type": "UnitPriceSpecification",
                    "price": "5",
                    "priceCurrency": "USD",
                    "unitCode": "MON"
                  },
                  "description": "Up to 5 deletion rules, unlimited profiles per deletion, unlimited manual runs"
                },
                {
                  "@type": "Offer",
                  "name": "Pro",
                  "price": "7",
                  "priceCurrency": "USD",
                  "priceSpecification": {
                    "@type": "UnitPriceSpecification",
                    "price": "7",
                    "priceCurrency": "USD",
                    "unitCode": "MON"
                  },
                  "description": "Up to 100 deletion rules, unlimited profiles per deletion, unlimited manual runs"
                }
              ],
              "featureList": [
                "Email prefix pattern matching",
                "Email suffix/domain pattern matching",
                "Preview profiles before deletion",
                "Secure Klaviyo OAuth integration",
                "Manual on-demand cleanup runs",
                "Deletion history and audit logs"
              ],
              "url": "https://klaviyocleaner.com"
            })
          }}
        />

        {/* JSON-LD: Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Klaviyo Spam Profile Cleaner",
              "url": "https://klaviyocleaner.com",
              "logo": "https://klaviyocleaner.com/SpamProfileCleanerIcon.png",
              "contactPoint": {
                "@type": "ContactPoint",
                "email": "antibotbuilders@gmail.com",
                "contactType": "customer support"
              }
            })
          }}
        />
      </Head>
      <Component {...pageProps} />
    </QueryClientProvider>
  )
}

