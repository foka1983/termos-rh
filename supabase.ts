import { createClient } from "@supabase/supabase-js";

// Valores públicos do projeto (a chave "publishable" é segura no navegador: o acesso
// real é controlado pelas políticas de Row Level Security). O fallback evita que o
// sistema quebre caso as variáveis de ambiente não cheguem ao build.
const FALLBACK_URL = "https://ywlbpwqoemexdxzcpbal.supabase.co";
const FALLBACK_KEY = "sb_publishable_06VQW6ZCVJDnkugb3SHyoQ_slUkBimT";

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || FALLBACK_URL;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || FALLBACK_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn("VITE_SUPABASE_* ausentes no build; usando valores padrão do projeto.");
}

export const supabase = createClient(SUPABASE_URL, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
