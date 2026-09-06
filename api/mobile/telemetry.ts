import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://yujovpmltigdtelftvdz.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1am92cG1sdGlnZHRlbGZ0dmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODE4NzksImV4cCI6MjEwMzY1Nzg3OX0.YAyi-QEJA4QKL4GePA4S5lH9Pi5TqsYCnehUf795kAI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  // Setup Global CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      endpoint: '/api/mobile/telemetry',
      service: 'Vercel Serverless Mobile Telemetry Receiver',
      message: 'این اندپوینت آماده دریافت اطلاعات زنده از اپلیکیشن ردیاب موبایل است.',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use raw body
      }
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, error: 'پیکربندی بادی ارسالی نامعتبر است' });
    }

    const imei = String(body.imei || body.device_imei || '').trim();
    if (!imei) {
      return res.status(400).json({ success: false, error: 'شناسه دستگاه (IMEI) الزامی است' });
    }

    let lat = Number(body.lat ?? body.latitude);
    let lng = Number(body.lng ?? body.longitude);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      lat = 32.3709;
      lng = 62.1157;
    }

    const speed = Math.round(Number(body.speed || 0));
    const heading = Math.round(Number(body.heading || body.course || 0));
    const altitude = Math.round(Number(body.altitude || 0));
    const batteryLevel = Math.round(Number(body.battery_level ?? body.battery ?? 100));
    const satellites = Math.round(Number(body.satellites || 12));
    const recordedAt = body.recorded_at || new Date().toISOString();

    // 1. Auto-provision or update device status in 'devices' table
    let deviceId: string | undefined;
    try {
      const { data: existingDevice } = await supabase
        .from('devices')
        .select('id, imei, status')
        .eq('imei', imei)
        .maybeSingle();

      if (!existingDevice) {
        const { data: createdDev } = await supabase
          .from('devices')
          .insert({
            imei: imei,
            model_name: 'گوشی هوشمند ردیاب (Smartphone Agent)',
            protocol: 'SMARTPHONE_AGENT',
            device_type: 'smartphone_agent',
            status: 'online',
            sim_number: '',
            sim_operator: 'Mobile Network',
            last_online: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createdDev) {
          deviceId = createdDev.id;
        }
      } else {
        deviceId = existingDevice.id;
        await supabase
          .from('devices')
          .update({
            status: 'online',
            last_online: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('imei', imei);
      }

      // 2. Ensure an associated vehicle exists in 'vehicles' table
      if (deviceId) {
        const { data: existingVeh } = await supabase
          .from('vehicles')
          .select('id, device_id')
          .or(`device_id.eq.${deviceId},device_id.eq.${imei}`)
          .maybeSingle();

        if (!existingVeh) {
          await supabase.from('vehicles').insert({
            device_id: deviceId,
            name: `موبایل هوشمند ${imei.slice(-6)}`,
            plate_number: `MOB-${imei.slice(-6)}`,
            vehicle_type: 'car',
            is_active: true,
            max_speed_limit: 120,
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (provisionErr: any) {
      console.warn('[Vercel Telemetry] Provision warning:', provisionErr.message);
    }

    // 3. Insert record into gps_telemetry table
    let saved = false;
    try {
      const { error: insertErr } = await supabase.from('gps_telemetry').insert({
        device_imei: imei,
        lat: lat,
        lng: lng,
        speed: speed,
        heading: heading,
        altitude: altitude,
        satellites: satellites,
        gsm_signal: 100,
        ignition: true,
        battery_level: batteryLevel,
        recorded_at: recordedAt,
      });

      if (!insertErr) {
        saved = true;
      } else {
        console.warn('[Vercel Telemetry] Primary insert failed, trying minimal payload:', insertErr.message);
        // Fallback with minimal columns
        const { error: fallbackErr } = await supabase.from('gps_telemetry').insert({
          device_imei: imei,
          lat: lat,
          lng: lng,
          speed: speed,
          recorded_at: recordedAt,
        });
        saved = !fallbackErr;
      }
    } catch (saveErr: any) {
      console.error('[Vercel Telemetry] Insert exception:', saveErr.message);
    }

    // 4. Return success response to the smartphone
    return res.status(200).json({
      success: true,
      imei: imei,
      coordinates: { lat, lng },
      speed: speed,
      battery: batteryLevel,
      saved_to_supabase: saved,
      status: 'online',
      message: 'موقعیت با موفقیت در ورسل و سوپابیس ثبت گردید',
      timestamp: new Date().toISOString(),
    });
  } catch (globalErr: any) {
    console.error('[Vercel Telemetry Fatal]:', globalErr);
    return res.status(500).json({
      success: false,
      error: globalErr.message || 'خطای داخلی سرور ورسل',
    });
  }
}
