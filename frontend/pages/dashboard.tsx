import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import axios from "axios";
import Dashboard from "@/components/Dashboard";
import { getToken } from "@/utils/auth";

const ACCOUNT_ID_KEY = "klaviyo_cleaner_account_id";

export default function DashboardPage() {
  const router = useRouter();
  const { accountId: urlAccountId } = router.query;
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    if (!getToken()) {
      router.replace("/");
      return;
    }

    const resolveAccountId = async () => {
      if (urlAccountId && typeof urlAccountId === "string") {
        setAccountId(urlAccountId);
        localStorage.setItem(ACCOUNT_ID_KEY, urlAccountId);
        return;
      }
      try {
        const res = await axios.get("/api/me");
        const meAccountId = res.data?.accountId;
        if (meAccountId) {
          setAccountId(meAccountId);
          localStorage.setItem(ACCOUNT_ID_KEY, meAccountId);
          return;
        }
      } catch {
        // 401 will redirect to / via interceptor
        return;
      }
      const savedAccountId = localStorage.getItem(ACCOUNT_ID_KEY);
      if (savedAccountId) {
        setAccountId(savedAccountId);
      } else {
        router.replace("/");
      }
    };

    resolveAccountId();
  }, [urlAccountId, router.isReady, router]);

  // Show loading while router is initializing or accountId is not available
  if (!router.isReady || !accountId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard - Klaviyo Spam Profile Cleaner</title>
        <meta
          name="description"
          content="Manage your spam profile cleanup rules"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/SpamProfileCleanerIcon.png" />
        <link rel="apple-touch-icon" href="/SpamProfileCleanerIcon.png" />
        <meta name="theme-color" content="#4F46E5" />
      </Head>
      <Dashboard accountId={accountId as string} />
    </>
  );
}
