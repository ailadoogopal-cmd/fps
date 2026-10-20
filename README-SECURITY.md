# Security notes before publishing

- The Gemini API key was removed from `backend/server.py`. Configure `GEMINI_API_KEY` as a server-side environment variable in your hosting provider.
- Never put API keys in frontend HTML/JavaScript or commit `.env` files.
- A key that was committed or pushed should be revoked/rotated in Google Cloud AI Studio / Google Cloud Console. Removing it from the latest file does not remove it from Git history.
- `backend/krishi.db` and Python bytecode caches are excluded from this source ZIP. The app's database initialization code can create/migrate the local SQLite database.
- This is a source-level secret cleanup, not a complete production security audit. Review authentication, password hashing, demo credentials, payment/escrow simulation, CORS, and deployment configuration before handling real users or payments.
