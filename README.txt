Foster's Media web starter

This is an initial responsive web shell, not a finished production app.

Included:
- Mobile-friendly sign-in screen
- Admin email/password sign-in using Supabase Auth
- Influencer phone OTP sign-in scaffold (requires SMS provider + phone auth enabled in Supabase)
- Profile lookup from public.profiles

Not yet included:
- Campaign/client/influencer CRUD
- Assignment creation
- Visit booking and rescheduling
- Story screenshot upload/review
- Payment management
- WhatsApp notifications
- Production security review and end-to-end testing

Setup:
1. Extract this ZIP.
2. Host the folder on a static hosting provider (we will do this step-by-step).
3. Open the website and tap Setup.
4. Enter your Supabase Project URL and publishable key.
5. Admin signs in with the existing Supabase email/password account.

Important:
- Only use the Supabase publishable key in the browser.
- Never enter or share a service_role/secret key, database password, or OTP.
- The app expects public.profiles.id to match auth.users.id and a role column.
- Review RLS policies and database schema before inviting real influencers.
