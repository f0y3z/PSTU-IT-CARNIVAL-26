import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [incomingCount, setIncomingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      try {
        const incoming = await api.pendingIncoming();
        if (!cancelled) setIncomingCount(incoming.length);
      } catch (e) {
        // silent — badge just won't update
      }
    }
    loadCount();
    const interval = setInterval(loadCount, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="mark">L</span>
        Ledger
      </div>
      <nav>
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Dashboard
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
          History
        </NavLink>
        <NavLink to="/requests" className={({ isActive }) => (isActive ? 'active' : '')}>
          Requests
          {incomingCount > 0 && <span className="badge">{incomingCount}</span>}
        </NavLink>
        <button onClick={handleLogout}>Log out</button>
      </nav>
    </header>
  );
}
