PRESERVED GENERATION — PHONE + SUPABASE VERSION 6

This version is designed for an iPhone using Spck Editor. It does NOT require:
- Node.js
- npm install
- npm start
- server.js
- SQLite

The website uses Supabase for authentication, PostgreSQL database, storage and secure
database functions.

WHAT IS PRESERVED FROM THE AGREED SITE
- Homepage copy, including the Bible verse (Hebrews 10:23 NLT).
- Community guidelines section.
- About section.
- Events section.
- Gallery / memories section.
- Purple/lavender visual theme.
- Mobile navigation toggle with About, Events, Gallery, Community and Admin.
- Password-protected Admin dashboard.
- Admin event creation/edit/archive/restore/delete.
- Registration records tied to each event.
- Bank transfer: UBA / 2245627970 / Salako Oluwakemi.
- Ticket codes + Code 128 barcodes.
- Tickets permanently stored in Supabase.
- One-time event-day ticket scanning.
- Bank-transfer registrations stay pending until Admin verifies payment.
- Archived events keep their registrations.
- Gallery upload for images/videos, title, description and date.
- Manual ticket-code entry if camera scanning is unavailable.

TICKET STORAGE / EMAIL
Every ticket is stored in the Supabase database with an unguessable ticket link token.
This is the permanent source of truth, so losing an email/browser page does not lose
the ticket. The success page also has an Email Ticket button that opens the user's
mail app with the ticket details. Automatic email delivery can be connected later
through the included Supabase Edge Function using an email provider such as Resend.

IMPORTANT SECURITY
- Only use the Supabase ANON/PUBLISHABLE key in config.js.
- NEVER paste a service_role/secret key into config.js or the website.
- Admin access uses Supabase Auth email + password plus an admin_users allow-list.

PHONE SETUP
1. Create your Supabase project.
2. Open supabase/schema.sql in Spck.
3. In Supabase Dashboard > SQL Editor, paste the entire schema.sql and run it.
4. In Supabase Dashboard > Authentication > Users, create your Admin user with email/password.
5. Copy that user's UUID.
6. In Supabase SQL Editor, run:
   insert into public.admin_users(user_id) values ('YOUR-USER-UUID') on conflict do nothing;
7. In Supabase Dashboard > Project Settings > API, copy:
   - Project URL
   - ANON/PUBLISHABLE key
8. Put them in config.js:
   SUPABASE_URL: "..."
   SUPABASE_ANON_KEY: "..."
   ADMIN_EMAIL: "your-admin-email@example.com"
9. Open the project in Spck and use its Preview.
10. The public homepage and admin dashboard will use Supabase directly.

CAMERA SCANNER
Camera access requires HTTPS or a browser's secure localhost context. When you publish
the site on an HTTPS host, Safari can request camera permission. If camera access is
blocked, use the manual ticket code.

PAYMENT
Payoneer is not claimed to be connected. Bank transfer is the active payment method:
UBA
2245627970
Salako Oluwakemi

For paid events, registrations are pending until Admin verifies the transfer.

ARCHIVING
Archiving an event hides it from public upcoming events but keeps the event and all
registrations/tickets in the database. This is the recommended way to close an event.

EMAIL FUNCTION
supabase/functions/send-ticket-email/index.ts is optional. It requires an email
provider API key and deployment as a Supabase Edge Function. The database/ticket system
does NOT depend on email delivery.

TROUBLESHOOTING
If the homepage says Supabase is not connected, check config.js.
If Admin says the account is not authorised, create the Auth user and add its UUID to
public.admin_users.
If an event cannot be deleted, archive it instead; existing registrations are protected.
