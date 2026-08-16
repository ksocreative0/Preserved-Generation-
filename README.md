OPTIONAL AUTOMATIC TICKET EMAIL

This function is not required for ticket storage or scanning.

To use it later:
1. Deploy the function as send-ticket-email in Supabase.
2. Add these Supabase Edge Function secrets:
   RESEND_API_KEY
   TICKET_FROM_EMAIL
   SITE_URL
3. The admin page can be extended to call the function after payment verification.

For now, the ticket is permanently stored in the database and the success page has
an Email Ticket button that opens the user's email app.
