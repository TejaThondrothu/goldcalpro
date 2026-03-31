import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Scale, Info, IndianRupee } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

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

const PurityCalculator: React.FC = () => {
  const { t } = useLanguage();
  const [weight, setWeight] = useState<number>(0);
  const [purity, setPurity] = useState<number>(91.6); // Default 22K
  const [pureGold, setPureGold] = useState<number>(0);
  const [goldRate24K, setGoldRate24K] = useState<number>(75000);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'gold_rates'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGoldRate24K(data.goldRate24K);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/gold_rates');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const result = (weight * purity) / 100;
    setPureGold(Number(result.toFixed(3)));
  }, [weight, purity]);

  const estimatedValue = (pureGold * (goldRate24K / 10));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-8">
        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl w-fit">
          <Scale className="text-amber-600 dark:text-amber-400 w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">{t('purity_calc')}</h2>
          <p className="text-neutral-500 text-xs md:text-sm">Calculate actual gold content from gross weight</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-white dark:bg-neutral-900 p-5 md:p-6 rounded-3xl border dark:border-neutral-800 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('weight')} (g)</label>
            <input 
              type="number" 
              inputMode="decimal"
              value={weight || ''} 
              onChange={(e) => setWeight(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg md:text-xl font-semibold focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('purity')} (%)</label>
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2 no-scrollbar">
              {[99.9, 91.6, 75.0, 58.5].map((val) => (
                <button
                  key={val}
                  onClick={() => setPurity(val)}
                  className={`px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${
                    purity === val 
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {val === 99.9 ? '24K (99.9%)' : val === 91.6 ? '22K (91.6%)' : val === 75.0 ? '18K (75%)' : '14K (58.5%)'}
                </button>
              ))}
            </div>
            <input 
              type="number" 
              inputMode="decimal"
              value={purity || ''} 
              onChange={(e) => setPurity(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg md:text-xl font-semibold focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>

        <div className="bg-amber-500 text-white p-6 md:p-8 rounded-[2.5rem] flex flex-col justify-center items-center text-center shadow-xl shadow-amber-500/20 relative overflow-hidden">
          <div className="relative z-10 w-full">
            <span className="text-amber-100 text-[10px] md:text-xs font-bold mb-2 uppercase tracking-widest block">{t('pure_gold')}</span>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl md:text-6xl font-black tracking-tighter truncate max-w-full">{pureGold}</span>
              <span className="text-xl md:text-2xl font-bold opacity-80">g</span>
            </div>
            
            {/* Gold Bar Visualization */}
            <div className="mt-8 w-full max-w-[200px] mx-auto space-y-2">
              <div className="h-12 w-full bg-amber-900/20 rounded-xl border border-white/20 relative overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${purity}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.5)]"
                />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-amber-900/50">
                  {purity}% Pure
                </div>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-amber-100 uppercase tracking-tighter">
                <span>Alloy</span>
                <span>Pure Gold</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white/10 rounded-2xl backdrop-blur-sm flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Estimated Value</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold opacity-80">₹</span>
                <span className="text-2xl font-black tracking-tighter">{Math.round(estimatedValue).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white/10 rounded-2xl backdrop-blur-sm flex items-start gap-3 text-left max-w-xs">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed opacity-90">
                This is the actual amount of 24K gold present in your {weight}g of {purity}% purity gold.
              </p>
            </div>
          </div>
          
          {/* Decorative background elements */}
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl" />
        </div>
      </div>
    </motion.div>
  );
};

export default PurityCalculator;
