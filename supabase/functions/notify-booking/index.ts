// supabase/functions/notify-booking/index.ts
//
// This Edge Function runs server-side on Supabase's infrastructure.
// Your Twilio credentials are stored as encrypted environment variables —
// they are NEVER exposed to the browser or frontend code.
//
// Deploy with:  supabase functions deploy notify-booking
// Set secrets:  supabase secrets set TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx TWILIO_FROM=+1xxx OWNER_PHONE=+1xxx

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { booking, booking_id } = await req.json();

    // Pull secrets from Supabase environment (set via `supabase secrets set`)
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const TWILIO_FROM        = Deno.env.get('TWILIO_FROM')!;   // your Twilio number, e.g. +17705550199
    const OWNER_PHONE        = Deno.env.get('OWNER_PHONE')!;   // your personal number, e.g. +17705550100

    // Build the SMS message
    const svcLabel: Record<string, string> = {
      detail:   'Car Detailing',
      trash:    'Trash Can Cleaning',
      pressure: 'Driveway Pressure Washing',
      window:   'Window Cleaning',
    };

    const service = svcLabel[booking.service] || booking.service;
    const pkg     = booking.details?.package ? ` (${booking.details.package})` : '';

    const message = [
      `🔔 NEW BOOKING — Kennesaw Standard`,
      ``,
      `Service: ${service}${pkg}`,
      `Date: ${booking.date}`,
      `Time: ${booking.time}`,
      ``,
      `Customer: ${booking.name}`,
      `Phone: ${booking.phone}`,
      `Email: ${booking.email}`,
      `Address: ${booking.address}`,
      booking.price_estimate ? `Est. Price: ${booking.price_estimate}` : '',
      booking.addons?.length  ? `Add-ons: ${booking.addons.join(', ')}` : '',
      booking.gate_code       ? `Gate Code: ${booking.gate_code}` : '',
      ``,
      `Booking ID: KSE-${booking_id?.slice(0, 8).toUpperCase()}`,
    ].filter(line => line !== null && line !== undefined).join('\n');

    // Send SMS via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('To',   OWNER_PHONE);
    formData.append('From', TWILIO_FROM);
    formData.append('Body', message);

    const twilioRes = await fetch(twilioUrl, {
      method:  'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('Twilio error:', twilioData);
      return new Response(JSON.stringify({ success: false, error: twilioData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('SMS sent successfully. SID:', twilioData.sid);

    return new Response(JSON.stringify({ success: true, sid: twilioData.sid }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
