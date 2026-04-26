import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_URL ||
  "";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

let browserSupabaseClient = null;

export function hasSupabaseBrowserConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabaseBrowserClient() {
  if (!hasSupabaseBrowserConfig()) {
    throw new Error(
      "Supabase browser client requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  if (!browserSupabaseClient) {
    browserSupabaseClient = createClient(supabaseUrl, supabasePublishableKey);
  }

  return browserSupabaseClient;
}
