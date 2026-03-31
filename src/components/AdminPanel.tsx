import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, TrendingUp, Users, FileText, Settings, ArrowUpRight, Save, Clock, Zap, Loader2, IndianRupee } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { doc, getDoc, setDoc, onSnapshot, collection, query, getCountFromServer, serverTimestamp, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { logAction } from '../lib/logger';
import { useUser } from '../context/UserContext';
import { GoogleGenAI, Type } from "@google/genai";

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

interface Log {
  id: string;
  user: string;
  action: string;
  createdAt: Timestamp;
}

const AdminPanel: React.FC = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useUser();
  const [goldRate24K, setGoldRate24K] = useState<number>(75000);
  const [goldRate22K, setGoldRate22K] = useState<number>(68750);
  const [shopDetails, setShopDetails] = useState({
    name: 'GoldCalc Pro Shop',
    owner: 'Admin User',
    address: '123 Jewelry Street, Gold City',
    contact: '+91 9876543210'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState([
    { label: 'Total Users', value: '...', icon: Users, color: 'text-blue-500' },
    { label: 'Total Calculations', value: '...', icon: TrendingUp, color: 'text-emerald-500' },
    { label: '24K (1g)', value: '...', icon: IndianRupee, color: 'text-amber-500' },
    { label: '22K (1g)', value: '...', icon: IndianRupee, color: 'text-amber-600' },
  ]);

  useEffect(() => {
    // Fetch Rates
    const unsubscribeRates = onSnapshot(doc(db, 'config', 'gold_rates'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGoldRate24K(data.goldRate24K);
        setGoldRate22K(data.goldRate22K);
        
        setStats(prev => prev.map(s => {
          if (s.label === '24K (1g)') return { ...s, value: `₹${(data.goldRate24K / 10).toFixed(2)}` };
          if (s.label === '22K (1g)') return { ...s, value: `₹${(data.goldRate22K / 10).toFixed(2)}` };
          return s;
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/gold_rates');
    });

    // Fetch Shop Details
    const unsubscribeShop = onSnapshot(doc(db, 'config', 'shop_details'), (doc) => {
      if (doc.exists()) {
        setShopDetails(doc.data() as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/shop_details');
    });

    // Fetch Logs
    const qLogs = query(collection(db, 'logs'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Log));
      setLogs(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    // Fetch Stats
    const fetchStats = async () => {
      try {
        const usersCount = await getCountFromServer(collection(db, 'users'));
        const calcsCount = await getCountFromServer(collection(db, 'calculations'));
        
        setStats(prev => prev.map(s => {
          if (s.label === 'Total Users') return { ...s, value: usersCount.data().count.toLocaleString() };
          if (s.label === 'Total Calculations') return { ...s, value: calcsCount.data().count.toLocaleString() };
          return s;
        }));
      } catch (error) {
        console.error("Stats fetch failed:", error);
        if (error instanceof Error && error.message.includes('insufficient permissions')) {
          handleFirestoreError(error, OperationType.LIST, 'users/calculations');
        }
      }
    };
    fetchStats();

    return () => {
      unsubscribeRates();
      unsubscribeShop();
      unsubscribeLogs();
    };
  }, []);

  const fetchLivePrice = async () => {
    setIsFetching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "What is the current gold rate in India today for 24K and 22K gold per 10 grams? Return only a JSON object with 'rate24K' and 'rate22K' as numbers.",
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rate24K: { type: Type.NUMBER },
              rate22K: { type: Type.NUMBER }
            },
            required: ["rate24K", "rate22K"]
          }
        }
      });

      const data = JSON.parse(response.text);
      if (data.rate24K && data.rate22K) {
        setGoldRate24K(data.rate24K);
        setGoldRate22K(data.rate22K);
        alert(`Fetched live rates: 24K: ₹${data.rate24K}, 22K: ₹${data.rate22K}`);
      }
    } catch (error) {
      console.error("Failed to fetch live price:", error);
      alert("Failed to fetch live price. Please try again or enter manually.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleSaveRates = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'config', 'gold_rates'), {
        goldRate24K,
        goldRate22K,
        updatedAt: serverTimestamp()
      });
      await logAction(currentUser?.displayName || 'Admin', `Updated gold rates. 24K: ₹${goldRate24K} (₹${(goldRate24K/10).toFixed(2)}/g), 22K: ₹${goldRate22K} (₹${(goldRate22K/10).toFixed(2)}/g)`);
      alert('Rates updated successfully!');
    } catch (error) {
      console.error("Update failed:", error);
      if (error instanceof Error && error.message.includes('insufficient permissions')) {
        handleFirestoreError(error, OperationType.WRITE, 'config/gold_rates');
      } else {
        alert('Failed to update rates.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveShopDetails = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'config', 'shop_details'), {
        ...shopDetails,
        updatedAt: serverTimestamp()
      });
      await logAction(currentUser?.displayName || 'Admin', `Updated shop details: ${shopDetails.name}`);
      alert('Shop details updated successfully!');
    } catch (error) {
      console.error("Update failed:", error);
      handleFirestoreError(error, OperationType.WRITE, 'config/shop_details');
    } finally {
      setIsSaving(false);
    }
  };
  const formatTime = (timestamp: Timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
            <ShieldCheck className="text-neutral-900 dark:text-neutral-100 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight uppercase">{t('admin_panel')}</h2>
            <p className="text-neutral-500 text-sm">Manage gold rates and view application analytics</p>
          </div>
        </div>
        <button 
          onClick={fetchLivePrice}
          disabled={isFetching}
          className="flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-2xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
        >
          {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          Fetch Live Price
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border dark:border-neutral-800 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                Live <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
            <h4 className="text-3xl font-black mt-1">{stat.value}</h4>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border dark:border-neutral-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Shop Details</h3>
            <FileText className="w-5 h-5 text-neutral-400" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Shop Name</label>
              <input 
                type="text" 
                value={shopDetails.name}
                onChange={(e) => setShopDetails({...shopDetails, name: e.target.value})}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Owner Name</label>
              <input 
                type="text" 
                value={shopDetails.owner}
                onChange={(e) => setShopDetails({...shopDetails, owner: e.target.value})}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Address</label>
              <textarea 
                value={shopDetails.address}
                onChange={(e) => setShopDetails({...shopDetails, address: e.target.value})}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500 h-20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Contact Number</label>
              <input 
                type="text" 
                value={shopDetails.contact}
                onChange={(e) => setShopDetails({...shopDetails, contact: e.target.value})}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-sm font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button 
              onClick={handleSaveShopDetails}
              disabled={isSaving}
              className="w-full py-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-2xl font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Update Shop Details'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border dark:border-neutral-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t('update_rates')}</h3>
            <Settings className="w-5 h-5 text-neutral-400" />
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">24K Gold Rate (per 10g)</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input 
                    type="number" 
                    value={goldRate24K}
                    onChange={(e) => setGoldRate24K(Number(e.target.value))}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">10g</span>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    value={Number((goldRate24K / 10).toFixed(2))}
                    onChange={(e) => setGoldRate24K(Number(e.target.value) * 10)}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">1g</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">22K Gold Rate (per 10g)</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input 
                    type="number" 
                    value={goldRate22K}
                    onChange={(e) => setGoldRate22K(Number(e.target.value))}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">10g</span>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    value={Number((goldRate22K / 10).toFixed(2))}
                    onChange={(e) => setGoldRate22K(Number(e.target.value) * 10)}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">1g</span>
                </div>
              </div>
            </div>
            <button 
              onClick={handleSaveRates}
              disabled={isSaving}
              className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Rates'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border dark:border-neutral-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">System Logs</h3>
            <Clock className="w-5 h-5 text-neutral-400" />
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-neutral-500 text-sm italic text-center py-8">No logs available yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border-b dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors rounded-xl">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-bold">{log.user}</p>
                    <p className="text-xs text-neutral-400 line-clamp-2">{log.action}</p>
                  </div>
                  <span className="text-[10px] text-neutral-400 whitespace-nowrap">{formatTime(log.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminPanel;
