import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('mm_token'));
  const [user, setUser] = useState(null); // { username, balance }
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!localStorage.getItem('mm_token')) {
      setUser(null);
      return;
    }
    try {
      const me = await api.me();
      localStorage.setItem('mm_username', me.username);
      setUser(me);
    } catch (e) {
      // token invalid/expired
      localStorage.removeItem('mm_token');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem('mm_token', res.token);
    setToken(res.token);
    setUser({ username: res.username, balance: res.balance });
    return res;
  };

  const register = async (username, password) => {
    const res = await api.register(username, password);
    localStorage.setItem('mm_token', res.token);
    setToken(res.token);
    setUser({ username: res.username, balance: res.balance });
    return res;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore — log out locally regardless
    }
    localStorage.removeItem('mm_token');
    localStorage.removeItem('mm_username');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, setUser, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
