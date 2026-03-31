import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider, useUser } from './context/UserContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PriceCalculator from './components/PriceCalculator';
import PurityCalculator from './components/PurityCalculator';
import KaratConverter from './components/KaratConverter';
import FraudDetection from './components/FraudDetection';
import History from './components/History';
import AdminPanel from './components/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { Calculator, ShieldCheck, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const { login, user, loading } = useUser();

  if (loading) return null;
  if (user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100"
      >
        <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Calculator className="w-10 h-10 text-amber-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">GoldCalc</h1>
        <p className="text-slate-500 mb-8">
          Professional jewellery calculator with purity conversion and history tracking.
        </p>
        <button 
          onClick={login}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-800 transition-colors"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
          Continue with Google
        </button>
        <div className="mt-8 flex items-center justify-center gap-6 text-slate-400 text-sm">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Secure
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> Real-time
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useUser();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useUser();
  if (loading) return null;
  if (!user || !isAdmin) return <Navigate to="/" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <UserProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="price" element={<PriceCalculator />} />
                  <Route path="purity" element={<PurityCalculator />} />
                  <Route path="karat" element={<KaratConverter />} />
                  <Route path="fraud" element={<FraudDetection />} />
                  <Route path="history" element={<History />} />
                  <Route path="admin" element={
                    <AdminRoute>
                      <AdminPanel />
                    </AdminRoute>
                  } />
                </Route>
              </Routes>
            </Router>
          </UserProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
