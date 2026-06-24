const SUPABASE_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

export function getRuntimeConfigStatus() {
  const missingSupabase = SUPABASE_ENV_KEYS.filter((key) => !process.env[key]);
  const hasSupabase = missingSupabase.length === 0;

  return {
    hasSupabase,
    hasCourtListenerToken: Boolean(process.env.COURTLISTENER_API_TOKEN),
    missingSupabase,
    storageMode: hasSupabase ? "supabase" : "local-fallback",
    defaultCourtListenerQuery: process.env.COURTLISTENER_QUERY || "Kalshi",
    defaultNewsQuery: process.env.NEWS_RSS_QUERY || "Kalshi",
  };
}

export function assertSupabaseConfig() {
  const status = getRuntimeConfigStatus();

  if (!status.hasSupabase) {
    throw new Error(`Supabase is not configured. Missing: ${status.missingSupabase.join(", ")}`);
  }
}
