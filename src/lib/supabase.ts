import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let supabaseInstance: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabasePublishableKey) {
  supabaseInstance = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
    },
  });
} else {
  console.error(
    "[Supabase] Missing environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Photo uploads will fail until these are set.",
  );
}

/**
 * Returns the Supabase client. Throws a descriptive error if the client is
 * not initialised (missing env vars) so the caller gets a clear message
 * instead of a cryptic "Cannot read properties of null".
 */
function getSupabaseClient(): ReturnType<typeof createClient> {
  if (!supabaseInstance) {
    throw new Error(
      "Supabase is not initialised. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY " +
        "are set in your environment (Vercel → Settings → Environment Variables).",
    );
  }
  return supabaseInstance;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getSupabaseClient() as any)[prop];
  },
});
