import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const DEMO_SESSION_KEY = 'codesentinel_demo_session_v1';

export const DEMO_USER = {
  name: 'Demo Engineer',
  email: 'demo@codesentinel.ai',
  role: 'Staff Developer (Demo)',
  organization: 'Acme Software Labs',
};

/**
 * Authentication & Demo Session Context.
 *
 * NOTE: Client-side demo navigation state is for product evaluation UX flow only
 * and does NOT represent a cryptographic or server-side security boundary.
 * Never stores passwords, tokens, or credentials in browser storage.
 */
export function AuthProvider({ children }) {
  const [isDemoSession, setIsDemoSession] = useState(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    try {
      return window.sessionStorage.getItem(DEMO_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [user, setUser] = useState(() => (isDemoSession ? DEMO_USER : null));

  const enterDemoSession = () => {
    setIsDemoSession(true);
    setUser(DEMO_USER);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(DEMO_SESSION_KEY, 'true');
      } catch (err) {
        console.warn('[CodeSentinel AI] Could not write demo session to sessionStorage:', err);
      }
    }
  };

  const logout = () => {
    setIsDemoSession(false);
    setUser(null);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(DEMO_SESSION_KEY, 'false');
      } catch (err) {
        console.warn('[CodeSentinel AI] Could not clear demo session in sessionStorage:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isDemoSession,
        user,
        enterDemoSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
