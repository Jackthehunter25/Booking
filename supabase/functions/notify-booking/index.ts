import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SVC_LABEL: Record<string, string> = {
  detail:   'Car Detailing',
  trash:    'Trash Can Cleaning',
  pressure: 'Driveway Pressure Washing',
  window:   'Window Cleaning',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { booking, booking_id } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
    const OWNER_EMAIL    = Deno.env.get('OWNER_EMAIL') || 'jackson.thehuffmans@gmail.com';

    const service   = SVC_LABEL[booking.service as string] || booking.service;
    const pkg       = booking.details?.package ? ` — ${booking.details.package}` : '';
    const bookingId = `KSE-${(booking_id as string)?.slice(0, 8).toUpperCase()}`;

    const rawRows: ([string, string] | null)[] = [
      ['Service',    `${service}${pkg}`],
      ['Date',       booking.date],
      ['Time',       booking.time],
      ['Customer',   booking.name],
      ['Phone',      booking.phone],
      ['Email',      booking.email],
      ['Address',    booking.address],
      booking.price_estimate ? ['Est. Price', booking.price_estimate] : null,
      booking.gate_code      ? ['Gate Code',  booking.gate_code]      : null,
      booking.notes          ? ['Notes',      booking.notes]          : null,
    ];

    const detailRows = rawRows
      .filter((r): r is [string, string] => r !== null)
      .map(([label, value]) => `
        <tr>
          <td style="padding:10px 16px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;white-space:nowrap">${label}</td>
          <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #e5e7eb">${value}</td>
        </tr>`)
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)">
    <div style="background:#1a3d2b;padding:24px 32px">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6ee7b7">New Booking</p>
      <h1 style="margin:4px 0 0;font-size:22px;color:#fff">Kennesaw Standard</h1>
    </div>
    <div style="padding:24px 32px 8px">
      <p style="margin:0 0 16px;font-size:15px;color:#374151">You have a new booking request. Log in to the <a href="https://kennesaw-standard.com/admin" style="color:#1a3d2b;font-weight:600">admin dashboard</a> to confirm.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:14px">
        ${detailRows}
      </table>
    </div>
    <div style="padding:20px 32px 28px">
      <p style="margin:0;font-size:12px;color:#9ca3af">Booking ID: ${bookingId}</p>
    </div>
  </div>
</body>
</html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'Kennesaw Standard <bookings@kennesaw-standard.com>',
        to:      [OWNER_EMAIL, 'KennesawStandardExterior@gmail.com'],
        subject: `New Booking — ${service} (${bookingId})`,
        html,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error('Resend error:', emailData);
      return new Response(JSON.stringify({ success: false, error: emailData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Email sent. ID:', emailData.id);

    // Optional Twilio SMS — only fires if secrets are set
    const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_FROM  = Deno.env.get('TWILIO_FROM');
    const OWNER_PHONE  = Deno.env.get('OWNER_PHONE');

    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && OWNER_PHONE) {
      const smsBody = [
        `New booking — ${service}${pkg}`,
        `${booking.date} at ${booking.time}`,
        `${booking.name} | ${booking.phone}`,
        `${booking.address}`,
        bookingId,
      ].join('\n');

      const formData = new URLSearchParams();
      formData.append('To',   OWNER_PHONE);
      formData.append('From', TWILIO_FROM);
      formData.append('Body', smsBody);

      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method:  'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
            'Content-Type':  'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        }
      );
      const smsData = await smsRes.json();
      if (!smsRes.ok) console.error('Twilio error (non-fatal):', smsData);
      else console.log('SMS sent. SID:', smsData.sid);
    }

    return new Response(JSON.stringify({ success: true, email_id: emailData.id }), {
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
