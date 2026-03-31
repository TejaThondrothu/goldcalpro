import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { 
  TrendingUp, 
  Scale, 
  Calculator, 
  RefreshCw, 
  AlertTriangle, 
  ArrowRight, 
  IndianRupee, 
  Clock 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import GoldPriceGraph from './GoldPriceGraph';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Calculation {
  id: string;
  totalPrice: number;
  weight: number;
  createdAt: Timestamp;
}

const Dashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user, profile } = useUser();
  const [recentCalcs, setRecentCalcs] = useState<Calculation[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'calculations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubscribeCalcs = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Calculation));
      setRecentCalcs(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calculations');
    });

    return () => {
      unsubscribeCalcs();
    };
  }, [user]);

  const quickActions = [
    { title: t('price_calc'), path: '/price', icon: Calculator, color: 'bg-amber-500', desc: 'Detailed bill estimation' },
    { title: t('purity_calc'), path: '/purity', icon: Scale, color: 'bg-blue-500', desc: 'Check pure gold content' },
    { title: t('karat_conv'), path: '/karat', icon: RefreshCw, color: 'bg-emerald-500', desc: 'Convert between karats' },
    { title: t('fraud_detect'), path: '/fraud', icon: AlertTriangle, color: 'bg-red-500', desc: 'Spot hidden charges' },
  ];

  return (
    <div className="space-y-6 md:space-y-8 w-full">
      <header className="space-y-1 md:space-y-2">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">Hello, {profile?.displayName || user?.displayName}</h2>
        <p className="text-sm md:text-base text-neutral-500">Welcome back to your gold intelligence dashboard.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6 w-full">
        {/* Gold Price Graph */}
        <div className="lg:col-span-2 overflow-hidden w-[285px] lg:w-full mx-auto lg:mx-0">
          <GoldPriceGraph />
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-neutral-900 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border dark:border-neutral-800 shadow-sm space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base md:text-lg">Recent Calcs</h3>
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-neutral-400" />
          </div>
          <div className="space-y-3 md:space-y-4">
            {recentCalcs.length > 0 ? (
              recentCalcs.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl md:rounded-2xl">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-bold truncate">₹{item.totalPrice.toLocaleString()}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{item.weight}g • {item.createdAt?.toDate().toLocaleDateString()}</p>
                  </div>
                  <Link to="/price" className="text-amber-500 shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-[10px] md:text-xs text-neutral-400 text-center py-6 md:py-8">No calculations yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {quickActions.map((action, i) => (
          <Link 
            key={i} 
            to={action.path}
            className="group bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border dark:border-neutral-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg", action.color)}>
              <action.icon className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-lg group-hover:text-amber-500 transition-colors">{action.title}</h4>
            <p className="text-xs text-neutral-400 mt-1">{action.desc}</p>
            <div className="mt-4 flex items-center gap-2 text-amber-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              Start <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
