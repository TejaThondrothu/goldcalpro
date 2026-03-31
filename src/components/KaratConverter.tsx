import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { RefreshCw, ArrowRightLeft, IndianRupee } from 'lucide-react';
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

const KaratConverter: React.FC = () => {
  const { t } = useLanguage();
  const [inputWeight, setInputWeight] = useState<number>(0);
  const [fromKarat, setFromKarat] = useState<number>(22);
  const [toKarat, setToKarat] = useState<number>(24);
  const [manualFromKarat, setManualFromKarat] = useState<number>(22);
  const [manualToKarat, setManualToKarat] = useState<number>(24);
  const [isManualFrom, setIsManualFrom] = useState<boolean>(false);
  const [isManualTo, setIsManualTo] = useState<boolean>(false);
  const [result, setResult] = useState<number>(0);
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

  const karatToPurity = (k: number) => (k / 24) * 100;

  useEffect(() => {
    const fromK = isManualFrom ? manualFromKarat : fromKarat;
    const toK = isManualTo ? manualToKarat : toKarat;
    const fromPurity = karatToPurity(fromK);
    const toPurity = karatToPurity(toK);
    const pure = (inputWeight * fromPurity) / 100;
    const converted = toPurity > 0 ? (pure * 100) / toPurity : 0;
    setResult(Number(converted.toFixed(3)));
  }, [inputWeight, fromKarat, toKarat, manualFromKarat, manualToKarat, isManualFrom, isManualTo]);

  const estimatedValue = (inputWeight * ((isManualFrom ? manualFromKarat : fromKarat) / 24) * (goldRate24K / 10));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
          <RefreshCw className="text-blue-600 dark:text-blue-400 w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('karat_conv')}</h2>
          <p className="text-neutral-500 text-sm">Convert weight between different gold karats</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white dark:bg-neutral-900 p-8 rounded-3xl border dark:border-neutral-800 shadow-sm space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-500">{t('weight')}</label>
            <input 
              type="number" 
              value={inputWeight || ''} 
              onChange={(e) => setInputWeight(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-xl font-semibold focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-neutral-500">From Karat</label>
                <button 
                  onClick={() => setIsManualFrom(!isManualFrom)}
                  className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:underline"
                >
                  {isManualFrom ? 'Select' : 'Manual'}
                </button>
              </div>
              {isManualFrom ? (
                <div className="relative">
                  <input 
                    type="number" 
                    value={manualFromKarat || ''} 
                    onChange={(e) => setManualFromKarat(Number(e.target.value))}
                    placeholder="Karat (e.g. 22)"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">K</span>
                </div>
              ) : (
                <select 
                  value={fromKarat}
                  onChange={(e) => setFromKarat(Number(e.target.value))}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {[24, 22, 20, 18, 14, 10].map(k => (
                    <option key={k} value={k}>{k}K ({karatToPurity(k).toFixed(1)}%)</option>
                  ))}
                </select>
              )}
            </div>

            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full mt-6">
              <ArrowRightLeft className="w-5 h-5 text-neutral-400" />
            </div>

            <div className="flex-1 w-full space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-neutral-500">To Karat</label>
                <button 
                  onClick={() => setIsManualTo(!isManualTo)}
                  className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:underline"
                >
                  {isManualTo ? 'Select' : 'Manual'}
                </button>
              </div>
              {isManualTo ? (
                <div className="relative">
                  <input 
                    type="number" 
                    value={manualToKarat || ''} 
                    onChange={(e) => setManualToKarat(Number(e.target.value))}
                    placeholder="Karat (e.g. 24)"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">K</span>
                </div>
              ) : (
                <select 
                  value={toKarat}
                  onChange={(e) => setToKarat(Number(e.target.value))}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {[24, 22, 20, 18, 14, 10].map(k => (
                    <option key={k} value={k}>{k}K ({karatToPurity(k).toFixed(1)}%)</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="pt-8 border-t dark:border-neutral-800 flex flex-col items-center text-center">
            <span className="text-neutral-500 text-sm mb-2 uppercase tracking-widest">Equivalent Weight</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter text-blue-600 dark:text-blue-400">{result}</span>
              <span className="text-xl font-bold text-neutral-400">g</span>
            </div>
            <p className="mt-4 text-sm text-neutral-400 max-w-xs">
              {inputWeight}g of {fromKarat}K gold is equivalent to {result}g of {toKarat}K gold.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-600/20 flex flex-col justify-center items-center text-center">
            <span className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-2">Estimated Market Value</span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold opacity-80">₹</span>
              <span className="text-4xl font-black tracking-tighter">{Math.round(estimatedValue).toLocaleString()}</span>
            </div>
            <div className="mt-6 p-4 bg-white/10 rounded-2xl backdrop-blur-sm flex items-center gap-3">
              <IndianRupee className="w-5 h-5 text-blue-100" />
              <p className="text-[10px] text-left leading-tight opacity-90">
                Based on current 24K rate of ₹{goldRate24K.toLocaleString()} per 10g.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border dark:border-neutral-800 shadow-sm">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Purity Reference</h4>
            <div className="space-y-3">
              {[24, 22, 18].map(k => (
                <div key={k} className="flex justify-between items-center text-sm">
                  <span className="font-bold">{k}K Gold</span>
                  <span className="text-neutral-500">{karatToPurity(k).toFixed(1)}% Pure</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default KaratConverter;
