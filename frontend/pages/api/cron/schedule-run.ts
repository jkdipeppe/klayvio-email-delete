import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * Vercel Cron Job Handler
 * This endpoint is called by Vercel Cron on the schedule defined in vercel.json
 * It calls the backend API to process all accounts due for cleanup
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Vercel Cron sends a special header - verify it's a cron request
  // In production, Vercel automatically adds this header
  // For local testing, you can bypass this check
  const isVercelCron = req.headers['user-agent']?.includes('vercel-cron') || 
                       req.headers['x-vercel-cron'] === '1' ||
                       process.env.NODE_ENV === 'development';
  
  if (!isVercelCron && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return res.status(500).json({ error: 'BACKEND_URL not configured' });
  }

  const cronApiKey = process.env.CRON_API_KEY;
  if (!cronApiKey) {
    return res.status(500).json({ error: 'CRON_API_KEY not configured' });
  }

  try {
    // Call backend API to process all due accounts
    const response = await axios.post(
      `${backendUrl}/api/schedule/run`,
      {},
      {
        headers: {
          'X-API-Key': cronApiKey,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Scheduled cleanup executed',
      result: response.data,
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data,
    });
  }
}

