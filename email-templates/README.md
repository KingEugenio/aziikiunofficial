# Supabase Auth email templates

These two emails — account confirmation and password reset — are sent directly by **Supabase Auth**, not by Aziiki's own server code. That means I can't edit them from the codebase; they have to be pasted into the **Supabase Dashboard**.

## Where to put them

1. Go to your Supabase project → **Authentication** → **Email Templates**.
2. Click **Confirm signup** → paste the contents of `confirm-signup.html` into the body → set the subject to something like `Confirm your Aziiki account`.
3. Click **Reset Password** → paste the contents of `reset-password.html` into the body → set the subject to something like `Reset your Aziiki password`.
4. Save each one.

Do this for both the "Confirm signup" and "Reset Password" templates — magic link and OTP sign-in use their own separate templates in the same list if you want those styled to match too (not included here since they weren't asked for, but they follow the exact same pattern).

## Why these variables matter

Supabase's template engine replaces `{{ .ConfirmationURL }}` with the real, working link when it actually sends the email — don't edit or remove that part, just the surrounding text/design.

## Same branding as the rest of Aziiki's emails

These match the visual style now used by every other Aziiki email (payment/overdue/notification emails sent via Resend) — same header color, same shell — so a user who gets a few different Aziiki emails sees one consistent product, not several different-looking senders.
