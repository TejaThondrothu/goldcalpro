import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/gold-price", async (req, res) => {
    try {
      // Fetching from a public data source (GoldPrice.org's public JSON)
      const response = await fetch('https://data-asg.goldprice.org/db77/GoldPrice.json');
      if (!response.ok) throw new Error('Failed to fetch from source');
      const data = await response.json();
      
      // The source returns prices in USD/oz. We need to convert to INR/10g.
      // We'll also fetch current USD/INR rate for accuracy.
      const fxResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fxData = await fxResponse.json();
      const inrRate = fxData.rates.INR;

      // 1 Troy Ounce = 31.1035 grams
      // Price per gram = Price per Oz / 31.1035
      // Price per 10g = (Price per Oz / 31.1035) * 10
      const goldPriceOz = data.items[0].xauPrice;
      const rate24K = Math.round((goldPriceOz / 31.1035) * 10 * inrRate);
      const rate22K = Math.round(rate24K * 0.916); // Standard 22K ratio

      res.json({
        rate24K,
        rate22K,
        source: 'Global Market (Live)',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Gold price proxy error:', error);
      res.status(500).json({ error: 'Failed to fetch gold price' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
