import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://yujovpmltigdtelftvdz.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1am92cG1sdGlnZHRlbGZ0dmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODE4NzksImV4cCI6MjEwMzY1Nzg3OX0.YAyi-QEJA4QKL4GePA4S5lH9Pi5TqsYCnehUf795kAI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        if (!data || data.trim().length === 0) {
          resolve({});
        } else {
          resolve(JSON.parse(data));
        }
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => {
      resolve(null);
    });
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseRequestBody(req);
    const imei = String(body?.imei || '');
    const eventType = String(body?.event_type || 'SECURITY_ALERT');

    console.log(`[Security Alert Vercel] Device ${imei}: ${eventType}`, body);

    // Save alert to database
    await supabase.from('alerts').insert({
      device_imei: imei,
      alert_type: eventType,
      severity: 'critical',
      message: `هشدار امنیتی دستگاه ${imei}: ${eventType}`,
      details: body,
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: 'هشدار امنیتی ثبت شد' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
