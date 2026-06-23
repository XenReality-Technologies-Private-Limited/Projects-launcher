import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import pb from '../lib/pocketbase';

interface AuthUser {
  id: string;
  email: string;
  username?: string;
  name?: string;
  role?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from PocketBase authStore (persisted in localStorage)
    if (pb.authStore.isValid && pb.authStore.model) {
      const model = pb.authStore.model;
      setUser({ id: model.id, email: model.email, username: model.username, name: model.name, role: model.role });
    }
    setIsLoading(false);

    // Keep in sync if token refreshed or cleared externally
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid && pb.authStore.model) {
        const model = pb.authStore.model;
        setUser({ id: model.id, email: model.email, username: model.username, name: model.name, role: model.role });
      } else {
        setUser(null);
      }
    });
    return unsub;
  }, []);

  async function login(usernameOrEmail: string, password: string) {
    const authData = await pb.collection('sulthan_users').authWithPassword(usernameOrEmail, password);
    setUser({
      id: authData.record.id,
      email: authData.record.email,
      username: authData.record.username,
      name: authData.record.name,
      role: authData.record.role,
    });
  }

  function logout() {
    pb.authStore.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
