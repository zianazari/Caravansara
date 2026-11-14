# Email code login (054)

Members can sign in with their existing password or a five-digit email code.
Administrators can also sign in by email on the separate admin host, where email
is the default method and password sign-in remains available. Neither flow creates accounts.

## API contract

- `POST /auth/email-code/request`: `{email, locale: "fa" | "en"}` returns
  `{challenge_id, expires_in: 300, resend_after: 60}`. The response is identical for
  existing, unknown and admin addresses. Only existing members receive a message.
- `POST /auth/email-code/verify`: `{challenge_id, code}` accepts exactly five ASCII
  digits, including leading zeros, and returns the normal access/refresh tokens.
  The web form normalizes Persian/Arabic digits before sending them. The code is
  displayed in five separate boxes, with native keyboard editing, click-to-replace,
  full-code paste and browser autofill. A single labelled input preserves screen-reader
  and password-manager support while the visual cells stay left-to-right in both languages.
- Codes expire after five minutes, can be used once, and are superseded by a new
  request. At most five failed checks per address in fifteen minutes, across all
  challenges; a resend does not reset this allowance. Requests have a sixty-second
  cooldown, three per address and ten per IP per fifteen minutes. Verification has
  a separate thirty-per-IP limit. Database locks serialize these checks.

### Administration

- `POST /admin/auth/email-code/request` accepts the same `{email, locale}` and
  returns the same generic challenge. Only enabled admin accounts receive mail;
  member, unknown and disabled addresses receive no message. The admin host guard
  applies before these routes, as it does to the rest of the panel API.
- `POST /admin/auth/email-code/verify` accepts `{challenge_id, code}` and returns
  `AdminTokenOut`: a fifteen-minute admin token, a rotating refresh token, and
  `session_expires_in` with the existing eight-hour session end.
- Codes and address digests are purpose-bound to admin/member sign-in. Codes
  cannot cross between the two flows. Resends and failed attempts are counted per
  purpose/address; IP limits are shared. The account kind and disabled state are
  checked again at verification. Consumption and session issuance are atomic.

Only a keyed HMAC of the code/challenge is stored, using the configured server
secret and a separate purpose prefix. Addresses in challenges and rate-limit keys
use a separate HMAC. Verification and session issuance commit atomically; concurrent
checks cannot redeem one code twice. No codes appear in HTTP responses or logs.

## Delivery and sessions

The API sends short-lived login messages as background tasks using the existing
`CARAVANSARA_SMTP_*` configuration and sender. Local compose uses Mailpit at
`http://localhost:8025`. This avoids both worker polling delays and storing a
plaintext login secret in the durable business-email outbox. Delivery starts after
the generic response; slow SMTP does not reveal whether an account exists.
SMTP errors are logged without addresses, bodies or codes. There is no durable
retry for these short-lived messages: guests can request another code after the
cooldown. Without SMTP configured, the endpoint returns 503 for every address.
The ordinary booking/moderation email outbox and retry policy are unchanged.

Same-origin `/session/email-code/*` handlers forward the visitor IP. Verification
stores refresh tokens in the existing HttpOnly cookie and gives the page only the
access token. The existing return-to rules, session rotation and sign-out apply.
Expired challenges are removed by the worker after a one-day retention period.

The panel uses same-origin `/admin-api/email-code/request` and `/verify` handlers.
Both admin tokens go into the existing HttpOnly, SameSite=Strict cookies scoped
to `/admin-api`; page scripts receive only the session lifetime. The five-cell
input, Persian/Arabic digits, cooldown, error messages and autofill are shared
with member login. No additional migration or SMTP settings are required.

Design reference: [OWASP guidance on emailed tokens, single use and rate limits](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
