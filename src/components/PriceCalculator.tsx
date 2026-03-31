import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { Calculator, IndianRupee, Percent, Info, TrendingUp, AlertCircle, FileText, Save, Scale, MessageCircle, User as UserIcon, Gem } from 'lucide-react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, addDoc, serverTimestamp, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { logAction } from '../lib/logger';
import { saveLocalCalculation } from '../lib/db';

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

const PriceCalculator: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [ornamentName, setOrnamentName] = useState<string>('');
  const [shopDetails, setShopDetails] = useState({
    name: 'GoldCalc Pro Shop',
    owner: 'Admin User',
    address: '123 Jewelry Street, Gold City',
    contact: '+91 9876543210'
  });
  
  // Inputs
  const [weight, setWeight] = useState<number>(10);
  const [purity, setPurity] = useState<number>(91.6);
  const [isManualPurity, setIsManualPurity] = useState<boolean>(false);
  const [goldRate24K, setGoldRate24K] = useState<number>(75000); // per 10g
  const [rateUnit, setRateUnit] = useState<'1g' | '10g'>('10g');

  // Convert rate when unit changes
  const handleRateUnitChange = (newUnit: '1g' | '10g') => {
    if (newUnit === rateUnit) return;
    if (newUnit === '1g') {
      setGoldRate24K(prev => Number((prev / 10).toFixed(2)));
    } else {
      setGoldRate24K(prev => Number((prev * 10).toFixed(2)));
    }
    setRateUnit(newUnit);
  };

  const [makingChargeType, setMakingChargeType] = useState<'fixed' | 'percent'>('percent');
  const [makingChargeValue, setMakingChargeValue] = useState<number>(10);
  const [wastagePercent, setWastagePercent] = useState<number>(2);
  const [kdmCharges, setKdmCharges] = useState<number>(500);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'gold_rates'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGoldRate24K(data.goldRate24K);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/gold_rates');
    });

    const unsubscribeShop = onSnapshot(doc(db, 'config', 'shop_details'), (doc) => {
      if (doc.exists()) {
        setShopDetails(doc.data() as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/shop_details');
    });

    return () => {
      unsubscribe();
      unsubscribeShop();
    };
  }, []);

  // Outputs
  const [results, setResults] = useState({
    pureGold: 0,
    goldPrice: 0,
    makingCharges: 0,
    wastagePrice: 0,
    totalBeforeTax: 0,
    gst: 0,
    finalBill: 0,
    effectiveRate: 0
  });

  useEffect(() => {
    const ratePerGram = rateUnit === '10g' ? goldRate24K / 10 : goldRate24K;
    const purityFactor = purity / 100;
    const effectiveRate = ratePerGram * purityFactor;
    
    const goldPrice = weight * effectiveRate;
    const wastagePrice = (weight * (wastagePercent / 100)) * effectiveRate;
    
    let makingCharges = 0;
    if (makingChargeType === 'percent') {
      makingCharges = goldPrice * (makingChargeValue / 100);
    } else {
      makingCharges = makingChargeValue;
    }

    const totalBeforeTax = goldPrice + wastagePrice + makingCharges + kdmCharges;
    const gst = totalBeforeTax * 0.03;
    const finalBill = totalBeforeTax + gst;

    setResults({
      pureGold: Number((weight * purityFactor).toFixed(3)),
      goldPrice: Math.round(goldPrice),
      makingCharges: Math.round(makingCharges),
      wastagePrice: Math.round(wastagePrice),
      totalBeforeTax: Math.round(totalBeforeTax),
      gst: Math.round(gst),
      finalBill: Math.round(finalBill),
      effectiveRate: Number(effectiveRate.toFixed(2))
    });
  }, [weight, purity, goldRate24K, makingChargeType, makingChargeValue, wastagePercent, kdmCharges, rateUnit]);

  const chartData = [
    { name: 'Gold Price', value: results.goldPrice, color: '#f59e0b' },
    { name: 'Making Charges', value: results.makingCharges, color: '#3b82f6' },
    { name: 'Wastage', value: results.wastagePrice, color: '#ef4444' },
    { name: 'KDM & GST', value: results.kdmCharges + results.gst, color: '#10b981' },
  ];

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    const calcData = {
      customerName,
      ornamentName,
      weight,
      purity,
      goldPrice: goldRate24K,
      makingChargeType,
      makingChargeValue,
      wastagePercent,
      kdmCharges,
      goldPriceAmt: results.goldPrice,
      makingChargesAmt: results.makingCharges,
      wastagePrice: results.wastagePrice,
      gstAmt: results.gst,
      totalPrice: results.finalBill,
      effectiveRate: results.effectiveRate,
      userId: user.uid
    };

    try {
      // Always save to IndexedDB for offline access
      const localId = crypto.randomUUID();
      await saveLocalCalculation({
        ...calcData,
        id: localId,
        createdAt: Date.now(),
        synced: navigator.onLine
      });

      if (navigator.onLine) {
        await addDoc(collection(db, 'calculations'), {
          ...calcData,
          createdAt: serverTimestamp(),
        });
        await logAction(user.displayName || 'User', `Saved new gold calculation: ₹${results.finalBill.toLocaleString()}`);
      }
      
      alert(navigator.onLine ? 'Calculation saved successfully!' : 'Saved locally (Offline). Will sync when online.');
    } catch (error) {
      console.error("Save failed:", error);
      alert('Failed to save calculation.');
    } finally {
      setIsSaving(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Shop Header
    doc.setFontSize(22);
    doc.setTextColor(245, 158, 11); // Amber-500
    doc.text(shopDetails.name, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(shopDetails.address, 14, 30);
    doc.text(`Owner: ${shopDetails.owner} | Contact: ${shopDetails.contact}`, 14, 35);
    
    doc.setDrawColor(245, 158, 11);
    doc.line(14, 40, 196, 40);

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Gold Jewellery Estimation", 14, 52);
    
    doc.setFontSize(10);
    doc.text(`Customer: ${customerName || 'Valued Customer'}`, 14, 60);
    doc.text(`Ornament: ${ornamentName || 'N/A'}`, 14, 65);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 70);

    const tableData = [
      ["Gold Item", `${weight}g`, `Rs. ${results.effectiveRate.toLocaleString()}`, `Rs. ${results.goldPrice.toLocaleString()}`],
      ["Making Charges", makingChargeType === 'percent' ? `${makingChargeValue}%` : "Fixed", "-", `Rs. ${results.makingCharges.toLocaleString()}`],
      ["Wastage", `${wastagePercent}%`, "-", `Rs. ${results.wastagePrice.toLocaleString()}`],
      ["KDM Charges", "-", "-", `Rs. ${kdmCharges.toLocaleString()}`],
    ];

    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Weight/Qty', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 10, cellPadding: 3 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    // Total Summary on the right
    const summaryX = 140;
    doc.setFontSize(10);
    doc.text("Subtotal:", summaryX, finalY + 10);
    doc.text(`Rs. ${results.totalBeforeTax.toLocaleString()}`, 196, finalY + 10, { align: 'right' });
    
    doc.text("GST (3%):", summaryX, finalY + 16);
    doc.text(`Rs. ${results.gst.toLocaleString()}`, 196, finalY + 16, { align: 'right' });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total Amount:", summaryX, finalY + 24);
    doc.text(`Rs. ${results.finalBill.toLocaleString()}`, 196, finalY + 24, { align: 'right' });

    // Footer
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business!", 14, finalY + 40);
    doc.text("This is a computer-generated estimation.", 14, finalY + 45);

    doc.save(`gold_estimation_${customerName || 'customer'}_${Date.now()}.pdf`);
  };

  const shareWhatsApp = () => {
    const text = `*Gold Estimation from ${shopDetails.name}*\n\n` +
      `*Customer:* ${customerName || 'Valued Customer'}\n` +
      `*Ornament:* ${ornamentName || 'N/A'}\n` +
      `*Date:* ${new Date().toLocaleDateString()}\n\n` +
      `*Details:*\n` +
      `- Weight: ${weight}g\n` +
      `- Purity: ${purity}%\n` +
      `- Gold Rate (24K/10g): ₹${goldRate24K.toLocaleString()}\n` +
      `- Making Charges: ${makingChargeType === 'percent' ? makingChargeValue + '%' : '₹' + makingChargeValue.toLocaleString()}\n` +
      `- Wastage: ${wastagePercent}%\n\n` +
      `*Total Bill: ₹${results.finalBill.toLocaleString()}*\n\n` +
      `_Contact us: ${shopDetails.contact}_`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl">
            <Calculator className="text-amber-600 dark:text-amber-400 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">{t('price_calc')}</h2>
            <p className="text-neutral-500 text-xs md:text-sm">Comprehensive jewellery price estimation</p>
          </div>
        </div>
        <div className="grid grid-cols-3 md:flex gap-2">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 p-3 md:px-6 md:py-3 bg-amber-500 text-white rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span className="text-[10px] md:text-sm">{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
          <button 
            onClick={shareWhatsApp}
            className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 p-3 md:px-6 md:py-3 bg-emerald-500 text-white rounded-2xl font-semibold hover:opacity-90 transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px] md:text-sm">Share</span>
          </button>
          <button 
            onClick={exportPDF}
            className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 p-3 md:px-6 md:py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-2xl font-semibold hover:opacity-90 transition-all"
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] md:text-sm">Invoice</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border dark:border-neutral-800 shadow-sm space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Customer Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input 
                    type="text" 
                    placeholder="Enter customer name"
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Ornament Name</label>
                <div className="relative">
                  <Gem className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input 
                    type="text" 
                    placeholder="e.g. Necklace, Ring"
                    value={ornamentName} 
                    onChange={(e) => setOrnamentName(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('weight')} (g)</label>
                <div className="relative">
                  <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input 
                    type="number" 
                    inputMode="decimal"
                    value={weight || ''} 
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('gold_rate')} (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input 
                    type="number" 
                    inputMode="decimal"
                    value={goldRate24K || ''} 
                    onChange={(e) => setGoldRate24K(Number(e.target.value))}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border dark:border-neutral-800 shadow-sm grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('weight')} (g)</label>
              <div className="relative">
                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input 
                  type="number" 
                  inputMode="decimal"
                  value={weight || ''} 
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('gold_rate')} (₹)</label>
                <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button 
                    onClick={() => handleRateUnitChange('1g')}
                    className={cn("px-2 py-1 text-[10px] rounded-md transition-all", rateUnit === '1g' ? "bg-white dark:bg-neutral-700 shadow-sm" : "opacity-50")}
                  >
                    1g
                  </button>
                  <button 
                    onClick={() => handleRateUnitChange('10g')}
                    className={cn("px-2 py-1 text-[10px] rounded-md transition-all", rateUnit === '10g' ? "bg-white dark:bg-neutral-700 shadow-sm" : "opacity-50")}
                  >
                    10g
                  </button>
                </div>
              </div>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input 
                  type="number" 
                  inputMode="decimal"
                  value={goldRate24K || ''} 
                  onChange={(e) => setGoldRate24K(Number(e.target.value))}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">/ {rateUnit}</span>
              </div>
              <p className="text-[10px] font-bold text-amber-500">Current Rate: ₹{results.effectiveRate}/g ({purity}%)</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('purity')} (%)</label>
                <button 
                  onClick={() => setIsManualPurity(!isManualPurity)}
                  className="text-[10px] font-bold text-amber-500 uppercase tracking-widest hover:underline"
                >
                  {isManualPurity ? 'Select' : 'Manual'}
                </button>
              </div>
              {isManualPurity ? (
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input 
                    type="number" 
                    inputMode="decimal"
                    value={purity || ''} 
                    onChange={(e) => setPurity(Number(e.target.value))}
                    placeholder="Purity %"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ) : (
                <select 
                  value={purity}
                  onChange={(e) => setPurity(Number(e.target.value))}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                >
                  <option value={99.9}>24K (99.9%)</option>
                  <option value={91.6}>22K (91.6%)</option>
                  <option value={75.0}>18K (75%)</option>
                  <option value={58.5}>14K (58.5%)</option>
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('wastage')} (%)</label>
              <div className="relative">
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input 
                  type="number" 
                  inputMode="decimal"
                  value={wastagePercent || ''} 
                  onChange={(e) => setWastagePercent(Number(e.target.value))}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('making_charges')}</label>
                <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button 
                    onClick={() => setMakingChargeType('percent')}
                    className={cn("px-2 py-1 text-[10px] rounded-md transition-all", makingChargeType === 'percent' ? "bg-white dark:bg-neutral-700 shadow-sm" : "opacity-50")}
                  >
                    %
                  </button>
                  <button 
                    onClick={() => setMakingChargeType('fixed')}
                    className={cn("px-2 py-1 text-[10px] rounded-md transition-all", makingChargeType === 'fixed' ? "bg-white dark:bg-neutral-700 shadow-sm" : "opacity-50")}
                  >
                    ₹
                  </button>
                </div>
              </div>
              <input 
                type="number" 
                inputMode="decimal"
                value={makingChargeValue || ''} 
                onChange={(e) => setMakingChargeValue(Number(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{t('kdm_charges')} (₹)</label>
              <input 
                type="number" 
                inputMode="decimal"
                value={kdmCharges || ''} 
                onChange={(e) => setKdmCharges(Number(e.target.value))}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-lg font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Fraud Alert Banner */}
          {wastagePercent > 12 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl flex gap-3 items-start">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-red-800 dark:text-red-300 font-bold text-sm">High Wastage Alert!</h4>
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                  Wastage above 12% is considered high for standard jewellery. You might be overpaying.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="space-y-6">
          <div className="bg-amber-500 text-white p-8 rounded-[2.5rem] shadow-xl shadow-amber-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp className="w-32 h-32" />
            </div>
            <span className="text-amber-100 text-xs font-bold uppercase tracking-widest block mb-1">{t('final_bill')}</span>
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-sm font-bold opacity-80">₹</span>
              <span className="text-5xl font-black tracking-tighter">{results.finalBill.toLocaleString()}</span>
            </div>

            <div className="space-y-4 pt-6 border-t border-white/20">
              <div className="flex justify-between text-sm">
                <span className="opacity-70">1g Rate ({purity}%)</span>
                <span className="font-bold">₹{results.effectiveRate.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Gold Price</span>
                <span className="font-bold">₹{results.goldPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Making + Wastage</span>
                <span className="font-bold">₹{(results.makingCharges + results.wastagePrice).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">GST (3%)</span>
                <span className="font-bold">₹{results.gst.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border dark:border-neutral-800 shadow-sm h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#171717', 
                    border: 'none', 
                    borderRadius: '12px',
                    color: '#fff'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PriceCalculator;
