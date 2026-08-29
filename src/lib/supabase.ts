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
  console.error("[Supabase] Missing environment variables");
}

export const supabase = supabaseInstance as ReturnType<typeof createClient>;
