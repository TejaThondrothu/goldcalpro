import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'te';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    app_title: "GoldCalc Pro",
    purity_calc: "Purity Calculator",
    karat_conv: "Karat Converter",
    price_calc: "Price Calculator",
    fraud_detect: "Fraud Detection",
    admin_panel: "Admin Panel",
    dashboard: "Dashboard",
    weight: "Weight (grams)",
    purity: "Purity (%)",
    pure_gold: "Pure Gold",
    convert: "Convert",
    calculate: "Calculate",
    gold_rate: "Gold Rate (24K/10g)",
    making_charges: "Making Charges",
    wastage: "Wastage (%)",
    kdm_charges: "KDM Charges",
    total_cost: "Total Cost",
    gst: "GST (3%)",
    final_bill: "Final Bill",
    rounding_loss: "Rounding Loss",
    hidden_charges: "Hidden Charges",
    shop_profit: "Shop Profit Est.",
    settings: "Settings",
    dark_mode: "Dark Mode",
    language: "Language",
    english: "English",
    telugu: "Telugu",
    update_rates: "Update Rates",
    reports: "Reports",
    export_pdf: "Export PDF",
    history: "History",
  },
  te: {
    app_title: "గోల్డ్ క్యాలిక్యులేటర్ ప్రో",
    purity_calc: "ప్యూరిటీ క్యాలిక్యులేటర్",
    karat_conv: "కారట్ కన్వర్టర్",
    price_calc: "ధర క్యాలిక్యులేటర్",
    fraud_detect: "మోసం గుర్తింపు",
    admin_panel: "అడ్మిన్ ప్యానెల్",
    dashboard: "డ్యాష్‌బోర్డ్",
    weight: "బరువు (గ్రాములు)",
    purity: "ప్యూరిటీ (%)",
    pure_gold: "స్వచ్ఛమైన బంగారం",
    convert: "మార్చు",
    calculate: "లెక్కించు",
    gold_rate: "బంగారం ధర (24K/10g)",
    making_charges: "తయారీ ఖర్చులు",
    wastage: "తరుగు (%)",
    kdm_charges: "KDM ఖర్చులు",
    total_cost: "మొత్తం ధర",
    gst: "GST (3%)",
    final_bill: "తుది బిల్లు",
    rounding_loss: "రౌండింగ్ నష్టం",
    hidden_charges: "దాచిన ఖర్చులు",
    shop_profit: "షాప్ లాభం అంచనా",
    settings: "సెట్టింగులు",
    dark_mode: "డార్క్ మోడ్",
    language: "భాష",
    english: "ఇంగ్లీష్",
    telugu: "తెలుగు",
    update_rates: "ధరలను నవీకరించండి",
    reports: "నివేదికలు",
    export_pdf: "PDF ఎగుమతి",
    history: "చరిత్ర",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('lang') as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
