/**
 * Side-effect module: load the app's env files into `process.env` for the
 * standalone mock server (tsx doesn't auto-load `.env*` the way Next does). Imported
 * first so AUTH_SECRET is present before the mock signs any JWTs. Best-effort.
 */
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file not present — ignore
  }
}
