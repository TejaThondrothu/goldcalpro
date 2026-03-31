import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { AlertTriangle, ShieldCheck, Info, TrendingUp, DollarSign, Percent } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
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

const FraudDetection: React.FC = () => {
  const { t } = useLanguage();
  
  const [weight, setWeight] = useState<number>(10);
  const [quotedPrice, setQuotedPrice] = useState<number>(85000);
  const [goldRate24K, setGoldRate24K] = useState<number>(75000);
  const [purity, setPurity] = useState<number>(91.6);

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

  const calculateFraud = () => {
    const ratePerGram = goldRate24K / 10;
    const purityFactor = purity / 100;
    const actualGoldValue = weight * ratePerGram * purityFactor;
    
    // Standard making + wastage (approx 12% total)
    const standardOverhead = actualGoldValue * 0.12;
    const standardGst = (actualGoldValue + standardOverhead) * 0.03;
    const fairPrice = actualGoldValue + standardOverhead + standardGst;
    
    const hiddenCharges = quotedPrice - fairPrice;
    const profitEst = quotedPrice - actualGoldValue - (quotedPrice * 0.03); // Price - Gold Value - GST
    
    return {
      actualGoldValue: Math.round(actualGoldValue),
      fairPrice: Math.round(fairPrice),
      hiddenCharges: Math.round(hiddenCharges),
      profitEst: Math.round(profitEst),
      profitPercent: Number(((profitEst / actualGoldValue) * 100).toFixed(1))
    };
  };

  const results = calculateFraud();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl">
          <AlertTriangle className="text-red-600 dark:text-red-400 w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('fraud_detect')}</h2>
          <p className="text-neutral-500 text-sm">Analyze your quote for hidden charges and excessive profits</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border dark:border-neutral-800 shadow-sm space-y-6">
          <h3 className="font-bold text-lg mb-4">Enter Quote Details</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('weight')} (g)</label>
              <input 
                type="number" 
                value={weight || ''} 
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Quoted Final Price (₹)</label>
              <input 
                type="number" 
                value={quotedPrice || ''} 
                onChange={(e) => setQuotedPrice(Number(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('gold_rate')} (₹)</label>
              <input 
                type="number" 
                value={goldRate24K || ''} 
                onChange={(e) => setGoldRate24K(Number(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('purity')} (%)</label>
              <select 
                value={purity}
                onChange={(e) => setPurity(Number(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-red-500"
              >
                <option value={99.9}>24K (99.9%)</option>
                <option value={91.6}>22K (91.6%)</option>
                <option value={75.0}>18K (75%)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={cn(
            "p-8 rounded-[2.5rem] shadow-xl transition-all duration-500",
            results.hiddenCharges > 2000 
              ? "bg-red-500 text-white shadow-red-500/20" 
              : "bg-emerald-500 text-white shadow-emerald-500/20"
          )}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-white/70 text-xs font-bold uppercase tracking-widest block mb-1">Hidden Charges Est.</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold opacity-80">₹</span>
                  <span className="text-5xl font-black tracking-tighter">{results.hiddenCharges.toLocaleString()}</span>
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                {results.hiddenCharges > 2000 ? <AlertTriangle className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-white/20">
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Actual Gold Value</span>
                <span className="font-bold">₹{results.actualGoldValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Fair Market Price</span>
                <span className="font-bold">₹{results.fairPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border dark:border-neutral-800 shadow-sm space-y-6">
            <h4 className="font-bold text-neutral-500 text-sm uppercase tracking-wider">Shop Profit Analysis</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                <div className="flex items-center gap-2 text-neutral-400 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">Total Profit</span>
                </div>
                <span className="text-xl font-black">₹{results.profitEst.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                <div className="flex items-center gap-2 text-neutral-400 mb-1">
                  <Percent className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">Profit %</span>
                </div>
                <span className="text-xl font-black">{results.profitPercent}%</span>
              </div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex gap-3 items-start">
              <Info className="text-amber-600 shrink-0 mt-0.5 w-4 h-4" />
              <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Profit estimation includes making charges, wastage, and any hidden markups. A standard profit margin is usually between 8-15%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default FraudDetection;
