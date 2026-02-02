import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import Head from 'next/head';
import Dashboard from '@/components/Dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const { accountId } = router.query;

  useEffect(() => {
    // Wait for router to be ready before checking
    if (!router.isReady) {
      console.log('Router not ready yet...');
      return;
    }
    
    console.log('Dashboard page - accountId:', accountId, 'Full query:', router.query);
    
    if (!accountId) {
      console.log('No accountId found, redirecting to home');
      router.push('/');
    }
  }, [accountId, router.isReady, router]);

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
        <meta name="description" content="Manage your spam profile cleanup rules and scheduled cleanups" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/SpamProfileCleanerIcon.png" />
        <link rel="apple-touch-icon" href="/SpamProfileCleanerIcon.png" />
        <meta name="theme-color" content="#4F46E5" />
      </Head>
      <Dashboard accountId={accountId as string} />
    </>
  );
}

