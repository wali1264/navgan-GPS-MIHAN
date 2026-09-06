export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    service: 'Fleet GPS Telemetry & Monitoring API (Vercel Serverless)',
    message: 'سرور تله‌متری و پایش ناوگان آماده دریافت بسته‌های موقعیت مکانی است.',
    timestamp: new Date().toISOString(),
  });
}
