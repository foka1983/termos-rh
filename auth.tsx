import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { UsuarioPredio } from "./types";

interface AuthState {
  loading: boolean;
  session: Session | null;
  perfil: UsuarioPredio | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<UsuarioPredio | null>(null);

  async function loadPerfil(userId: string) {
    const { data, error } = await supabase
      .from("rh_usuarios_predios")
      .select("user_id, predio_id, nome, is_admin, must_change_password, ativo")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao carregar perfil rh_usuarios_predios:", error.message);
      setPerfil(null);
      return;
    }
    setPerfil(data as UsuarioPredio | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadPerfil(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        await loadPerfil(sess.user.id);
      } else {
        setPerfil(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshPerfil() {
    if (session?.user) await loadPerfil(session.user.id);
  }

  return (
    <AuthContext.Provider value={{ loading, session, perfil, signIn, signOut, refreshPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
