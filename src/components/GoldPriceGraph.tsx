import React, { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
import { Loader2, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface PricePoint {
  date: string;
  rate24K: number;
  rate22K: number;
  tola24K: number;
  tola22K: number;
}

const TOLA_WEIGHT = 11.6638;

const GoldPriceGraph: React.FC = () => {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'10g' | 'tola'>('tola');

  useEffect(() => {
    const fetchHistoricalData = async () => {
      // Check cache first
      const cachedData = localStorage.getItem('gold_historical_cache');
      const cacheTime = localStorage.getItem('gold_historical_cache_time');
      const ONE_HOUR = 60 * 60 * 1000;

      if (cachedData && cacheTime && (Date.now() - Number(cacheTime) < ONE_HOUR)) {
        setData(JSON.parse(cachedData));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("GEMINI_API_KEY is not set in environment variables.");
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Provide the historical gold rates in India for the last 7 days (including today) for 24K and 22K gold per 10 grams. 
          Return a JSON array of objects with 'date' (e.g., "Mar 25"), 'rate24K' (number), and 'rate22K' (number). 
          Ensure the data is accurate for the Indian market.`,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  rate24K: { type: Type.NUMBER },
                  rate22K: { type: Type.NUMBER }
                },
                required: ["date", "rate24K", "rate22K"]
              }
            }
          }
        });

        const rawData = JSON.parse(response.text);
        const processedData = rawData.map((item: any) => ({
          ...item,
          tola24K: Math.round(item.rate24K * (TOLA_WEIGHT / 10)),
          tola22K: Math.round(item.rate22K * (TOLA_WEIGHT / 10))
        }));
        
        setData(processedData);
        // Update cache
        localStorage.setItem('gold_historical_cache', JSON.stringify(processedData));
        localStorage.setItem('gold_historical_cache_time', Date.now().toString());
      } catch (err: any) {
        console.error("Failed to fetch historical gold data:", err);
        
        if (err.message?.includes('429') || err.status === 429) {
          setError("API Rate limit exceeded. Showing cached or estimated data.");
        } else {
          setError("Could not load historical data. Showing estimates.");
        }

        // Use cache even if expired if API fails
        if (cachedData) {
          setData(JSON.parse(cachedData));
        } else {
          // Fallback mock data if API fails and no cache
          const mockData = Array.from({ length: 7 }).map((_, i) => {
            const base24 = 75000 + Math.random() * 2000 - 1000;
            const base22 = base24 * 0.916;
            return {
              date: `Day ${i + 1}`,
              rate24K: Math.round(base24),
              rate22K: Math.round(base22),
              tola24K: Math.round(base24 * (TOLA_WEIGHT / 10)),
              tola22K: Math.round(base22 * (TOLA_WEIGHT / 10))
            };
          });
          setData(mockData);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, []);

  if (loading) {
    return (
      <div className="h-64 w-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-800/50 rounded-[2.5rem]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Fetching Market Data...</p>
        </div>
      </div>
    );
  }

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const isUp = latest && previous ? latest.rate24K >= previous.rate24K : true;

  return (
    <div className="w-full bg-white dark:bg-neutral-900 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border dark:border-neutral-800 shadow-sm relative overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-neutral-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">
              Gold Price Trend (Last 7 Days)
            </span>
            <div className="group relative">
              <Info className="w-3 h-3 text-neutral-300 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-900 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                1 Tola = 11.66 grams. Data fetched via live market search.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <h4 className="text-2xl md:text-4xl font-black tracking-tighter">
              ₹{viewMode === 'tola' ? latest.tola24K.toLocaleString() : latest.rate24K.toLocaleString()}
            </h4>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold ${
              isUp ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isUp ? '+' : '-'}{Math.abs(((latest.rate24K - previous.rate24K) / previous.rate24K) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl w-full md:w-auto">
          <button 
            onClick={() => setViewMode('tola')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all ${
              viewMode === 'tola' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            Per Tola
          </button>
          <button 
            onClick={() => setViewMode('10g')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all ${
              viewMode === '10g' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            Per 10g
          </button>
        </div>
      </div>

      <div className="h-48 md:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="color24K" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="color22K" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#888' }}
              dy={10}
            />
            <YAxis 
              hide 
              domain={['dataMin - 2000', 'dataMax + 2000']} 
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#171717', 
                border: 'none', 
                borderRadius: '16px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '12px'
              }}
              itemStyle={{ padding: '2px 0' }}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              iconType="circle"
              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '20px' }}
            />
            <Area 
              name="24K Gold"
              type="monotone" 
              dataKey={viewMode === 'tola' ? 'tola24K' : 'rate24K'} 
              stroke="#f59e0b" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#color24K)" 
            />
            <Area 
              name="22K Gold"
              type="monotone" 
              dataKey={viewMode === 'tola' ? 'tola22K' : 'rate22K'} 
              stroke="#3b82f6" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#color22K)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl flex items-center gap-2 text-[10px] text-neutral-400 font-bold uppercase">
          <Info className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
};

export default GoldPriceGraph;
