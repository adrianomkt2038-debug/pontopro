import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { full_name: string; email: string; avatar_url: string | null; matricula: string | null } | null;
  roles: AppRole[];
  isAdmin: boolean;
  isGestor: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  roles: [],
  isAdmin: false,
  isGestor: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer fetching to avoid deadlock
        setTimeout(() => {
          fetchProfile(session.user.id);
          fetchRoles(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRoles(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email, avatar_url, matricula")
      .eq("user_id", userId)
      .single();
    if (data) setProfile(data);
  };

  // Listen for profile changes in real-time to update avatar etc.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const d = payload.new as any;
          setProfile({ full_name: d.full_name, email: d.email, avatar_url: d.avatar_url, matricula: d.matricula });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (data) setRoles(data.map((r) => r.role));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = roles.includes("admin");
  const isGestor = roles.includes("gestor");

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, roles, isAdmin, isGestor, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
