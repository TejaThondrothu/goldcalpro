import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  Calculator, 
  Scale, 
  RefreshCw, 
  AlertTriangle, 
  LayoutDashboard, 
  Settings, 
  Moon, 
  Sun, 
  Languages,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  History as HistoryIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { cn } from '../lib/utils';

const Layout: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { user, profile, logout, isAdmin } = useUser();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/price', icon: Calculator, label: t('price_calc') },
    { path: '/purity', icon: Scale, label: t('purity_calc') },
    { path: '/karat', icon: RefreshCw, label: t('karat_conv') },
    { path: '/fraud', icon: AlertTriangle, label: t('fraud_detect') },
    { path: '/history', icon: HistoryIcon, label: t('history') },
    ...(isAdmin ? [{ path: '/admin', icon: ShieldCheck, label: t('admin_panel') }] : []),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
      {/* Sidebar / Bottom Nav */}
      <aside className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-t dark:border-neutral-800 md:top-0 md:bottom-0 md:w-64 md:border-t-0 md:border-r md:bg-white md:dark:bg-neutral-900">
        <div className="flex flex-col h-full">
          <div className="hidden md:flex items-center gap-2 p-6 border-b dark:border-neutral-800">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Scale className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">{t('app_title')}</h1>
          </div>

          <nav className="flex md:flex-col items-center justify-around md:justify-start p-1 md:p-4 gap-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col md:flex-row items-center gap-1 md:gap-3 p-2 md:p-3 rounded-xl transition-all min-w-[64px] md:w-full",
                  location.pathname === item.path 
                    ? "text-amber-600 dark:text-amber-400 font-bold md:bg-amber-100 md:dark:bg-amber-900/30" 
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                  item.path === '/admin' && "md:mt-6 border md:border-amber-500/30 md:bg-amber-50/50 md:dark:bg-amber-950/10"
                )}
              >
                <item.icon className={cn("w-6 h-6 md:w-5 md:h-5", item.path === '/admin' && "text-amber-500")} />
                <span className="text-[9px] md:text-sm whitespace-nowrap">{item.label}</span>
                {location.pathname === item.path && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute -top-1 w-1 h-1 bg-amber-500 rounded-full md:hidden"
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="mt-auto hidden md:flex flex-col gap-2 p-4 border-t dark:border-neutral-800">
            <div className="flex items-center gap-3 p-3 mb-2">
              <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" /> : <UserIcon className="w-5 h-5 text-neutral-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{profile?.displayName || user?.displayName}</p>
                <p className="text-[10px] text-neutral-400 truncate capitalize">{profile?.role || 'User'}</p>
              </div>
              <button onClick={logout} className="p-2 text-neutral-400 hover:text-red-500 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={toggleDarkMode}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{t('dark_mode')}</span>
            </button>
            <button 
              onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              <Languages className="w-5 h-5" />
              <span>{language === 'en' ? 'తెలుగు' : 'English'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pb-24 md:pb-0 md:pl-64 min-h-screen">
        <header className="md:hidden flex items-center justify-between p-4 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b dark:border-neutral-800 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center">
              <Scale className="text-white w-4 h-4" />
            </div>
            <h1 className="font-bold text-base tracking-tight">{t('app_title')}</h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleDarkMode} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setLanguage(language === 'en' ? 'te' : 'en')} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <Languages className="w-5 h-5" />
            </button>
            <button onClick={logout} className="p-2 rounded-xl text-neutral-400 hover:text-red-500 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          <Outlet />
        </div>

        {/* Footer */}
        <footer className="p-8 border-t dark:border-neutral-800 bg-white dark:bg-neutral-900 mt-auto">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center">
                <Scale className="text-white w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight">{t('app_title')}</span>
            </div>
            <p className="text-xs text-neutral-400">
              © {new Date().getFullYear()} GoldCalc Pro. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-neutral-400">
              <a href="#" className="hover:text-amber-500 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-amber-500 transition-colors">Terms of Service</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Layout;
