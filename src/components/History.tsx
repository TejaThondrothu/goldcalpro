import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { 
  History as HistoryIcon, 
  Search, 
  Trash2, 
  FileText, 
  Calendar, 
  IndianRupee,
  ChevronRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { logAction } from '../lib/logger';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  customerName?: string;
  ornamentName?: string;
  totalPrice: number;
  weight: number;
  purity: number;
  goldPrice: number;
  makingChargeType?: 'fixed' | 'percent';
  makingChargeValue?: number;
  wastagePercent?: number;
  kdmCharges?: number;
  goldPriceAmt?: number;
  makingChargesAmt?: number;
  wastagePrice?: number;
  gstAmt?: number;
  gst?: number; // legacy
  effectiveRate?: number;
  createdAt: Timestamp;
  userId: string;
}

const History: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useUser();
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [shopDetails, setShopDetails] = useState({
    name: 'GoldCalc Pro Shop',
    owner: 'Admin User',
    address: '123 Jewelry Street, Gold City',
    contact: '+91 9876543210'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'calculations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Calculation));
      setCalculations(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calculations');
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
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this calculation?')) return;
    try {
      await deleteDoc(doc(db, 'calculations', id));
      await logAction(user?.displayName || 'User', `Deleted calculation record: ${id.slice(0, 8)}`);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const exportPDF = (calc: Calculation) => {
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
    doc.text(`Customer: ${calc.customerName || 'Valued Customer'}`, 14, 60);
    doc.text(`Ornament: ${calc.ornamentName || 'N/A'}`, 14, 65);
    doc.text(`Date: ${calc.createdAt.toDate().toLocaleString()}`, 14, 70);

    const effectiveRate = calc.effectiveRate || Number(((calc.goldPrice / 10) * (calc.purity / 100)).toFixed(2));

    const tableData = [
      ["Gold Item", `${calc.weight}g`, `Rs. ${effectiveRate.toLocaleString()}`, `Rs. ${calc.goldPriceAmt?.toLocaleString() || 'N/A'}`],
      ["Making Charges", calc.makingChargeType === 'percent' ? `${calc.makingChargeValue}%` : "Fixed", "-", `Rs. ${calc.makingChargesAmt?.toLocaleString() || 'N/A'}`],
      ["Wastage", `${calc.wastagePercent || 0}%`, "-", `Rs. ${calc.wastagePrice?.toLocaleString() || 0}`],
      ["KDM Charges", "-", "-", `Rs. ${calc.kdmCharges?.toLocaleString() || 0}`],
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
    const subtotal = (calc.goldPriceAmt || 0) + (calc.makingChargesAmt || 0) + (calc.wastagePrice || 0) + (calc.kdmCharges || 0);
    doc.text(`Rs. ${subtotal.toLocaleString()}`, 196, finalY + 10, { align: 'right' });
    
    doc.text("GST (3%):", summaryX, finalY + 16);
    doc.text(`Rs. ${(calc.gstAmt || calc.gst || 0).toLocaleString()}`, 196, finalY + 16, { align: 'right' });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total Amount:", summaryX, finalY + 24);
    doc.text(`Rs. ${calc.totalPrice.toLocaleString()}`, 196, finalY + 24, { align: 'right' });

    // Footer
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business!", 14, finalY + 40);
    doc.text("This is a computer-generated estimation.", 14, finalY + 45);

    doc.save(`GoldCalc_Invoice_${calc.customerName || 'customer'}_${calc.id.slice(0, 8)}.pdf`);
  };

  const filteredCalcs = calculations.filter(c => 
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ornamentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.totalPrice.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-500">
            <HistoryIcon className="w-5 h-5" />
            <h2 className="text-2xl font-black tracking-tight uppercase">{t('history')}</h2>
          </div>
          <p className="text-neutral-500 text-sm">Review and manage your past gold calculations.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text"
            placeholder="Search by Name, Ornament or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white dark:bg-neutral-900 border dark:border-neutral-800 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none w-full md:w-64"
          />
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      ) : filteredCalcs.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border dark:border-neutral-800 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
            <HistoryIcon className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">No calculations found</h3>
          <p className="text-neutral-500 max-w-xs mx-auto">Start by using the Price Calculator to save your first estimate.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredCalcs.map((calc) => (
              <motion.div
                key={calc.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group bg-white dark:bg-neutral-900 p-5 rounded-3xl border dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <IndianRupee className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-lg">₹{calc.totalPrice.toLocaleString()}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-500">
                        {calc.customerName || 'No Name'}
                      </span>
                      {calc.ornamentName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400">
                          {calc.ornamentName}
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-500">
                        ID: {calc.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {calc.createdAt?.toDate().toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <HistoryIcon className="w-3 h-3" />
                        {calc.weight}g ({calc.purity}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => exportPDF(calc)}
                    className="flex-1 md:flex-none px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    PDF
                  </button>
                  <button 
                    onClick={() => handleDelete(calc.id)}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="hidden md:block p-2 text-neutral-300 group-hover:text-amber-500 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default History;
