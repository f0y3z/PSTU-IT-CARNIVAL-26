import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import PendingRequests from './pages/PendingRequests';
import TransactionDetail from './pages/TransactionDetail';
import { USING_MOCK } from './api';

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          {USING_MOCK && (
            <div
              style={{
                background: '#1B2430',
                color: '#F6F4EF',
                fontSize: 12,
                textAlign: 'center',
                padding: '6px 12px',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              Mock API active — demo users: alice / bob (password: password123). Set REACT_APP_USE_MOCK=false to use the real backend.
            </div>
          )}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <Layout>
                    <History />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PendingRequests />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TransactionDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
