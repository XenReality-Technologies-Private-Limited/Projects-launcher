import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import pb from '../lib/pocketbase';

const POC_SLUG = 'sulthan';

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

// Xen Employees/Partners have no poc; a customer account does, and it must
// match this project — otherwise a valid login for a DIFFERENT customer's
// project would silently open this one's dashboard too.
function isAllowedPoc(poc: string | undefined) {
  return !poc || poc === POC_SLUG;
}

function toAuthUser(model: any): AuthUser {
  return { id: model.id, email: model.email, username: model.username, name: model.name, role: model.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from PocketBase authStore (persisted in localStorage) —
    // but only if it's allowed here; a stored session from signing into a
    // different project's dashboard sends the person there instead.
    if (pb.authStore.isValid && pb.authStore.model) {
      if (isAllowedPoc(pb.authStore.model.poc)) {
        setUser(toAuthUser(pb.authStore.model));
      } else {
        window.location.replace('/' + pb.authStore.model.poc + '/');
        return;
      }
    }
    setIsLoading(false);

    // Keep in sync if token refreshed or cleared externally
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid && pb.authStore.model && isAllowedPoc(pb.authStore.model.poc)) {
        setUser(toAuthUser(pb.authStore.model));
      } else {
        setUser(null);
      }
    });
    return unsub;
  }, []);

  async function login(usernameOrEmail: string, password: string) {
    const authData = await pb.collection('xr_employees').authWithPassword(usernameOrEmail, password);
    if (!isAllowedPoc(authData.record.poc)) {
      // Right credentials, wrong project's login page — take them to their
      // own dashboard instead of rejecting a perfectly valid login.
      window.location.replace('/' + authData.record.poc + '/');
      return;
    }
    setUser(toAuthUser(authData.record));
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
