import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";

// Security: Safe in-memory credentials session store for dynamic inputs on preview UI
let activeBrokerCreds: { clientId: string; secretKey: string; totpKey?: string } | null = null;
let executedOrders: {
  id: string;
  timestamp: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  type: string;
  quantity: number;
  price: number;
  signature: string;
  status: string;
}[] = [
  {
    id: "ORD-942180",
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    symbol: "RELIANCE",
    action: "BUY",
    type: "MARKET",
    quantity: 15,
    price: 2420.50,
    signature: "7f4c9a812e3b8901...",
    status: "FILLED"
  },
  {
    id: "ORD-942181",
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    symbol: "TCS",
    action: "SELL",
    type: "LIMIT",
    quantity: 8,
    price: 3480.00,
    signature: "9b3e1f044d712fa9...",
    status: "FILLED"
  },
  {
    id: "ORD-942182",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    symbol: "INFY",
    action: "BUY",
    type: "MARKET",
    quantity: 25,
    price: 1512.25,
    signature: "1a8d4c720e556ca2...",
    status: "FILLED"
  }
];

function getBrokerCreds() {
    if (activeBrokerCreds) {
        return activeBrokerCreds;
    }
    const clientId = process.env.BROKER_CLIENT_ID;
    const secretKey = process.env.BROKER_SECRET_KEY;
    if (!clientId || !secretKey) {
        throw new Error("Missing credentials. Please submit the interactive Broker Login form or configure environment variables.");
    }
    return { clientId, secretKey };
}

// Logic from auth.py: SHA-256 Checksum generation
function generateChecksum(clientId: string, apiKey: string) {
    const rawString = `${clientId}${apiKey}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
}

// Calculates dynamic HMAC SHA-256 signatures for securing API requests to broker endpoints
function generateHMACSignature(payload: string, secretKey: string) {
    return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
}

// Logic from main.py: Supertrend Strategy Calculation
// Formula: (High + Low) / 2 +/- Multiplier * ATR
function calculateSupertrend(data: { high: number, low: number, close: number }[], period = 10, multiplier = 3) {
    if (data.length < period) return [];

    let atr = 0;
    // Simple ATR implementation for demo
    for (let i = 1; i < period; i++) {
        atr += Math.abs(data[i].high - data[i].low);
    }
    atr /= period;

    const results = data.map((d, i) => {
        const hl2 = (d.high + d.low) / 2;
        const up = hl2 + (multiplier * atr);
        const dn = hl2 - (multiplier * atr);
        return {
            time: i,
            close: d.close,
            upperBand: up,
            lowerBand: dn,
            trend: d.close > up ? 'up' : 'down'
        };
    });

    return results;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/auth/status", (req, res) => {
    try {
      const { clientId, secretKey } = getBrokerCreds();
      const checksum = generateChecksum(clientId, secretKey);
      res.json({ 
        status: "authenticated", 
        clientId: clientId.length > 4 ? (clientId.substring(0, 4) + "****") : "****",
        checksum: checksum.substring(0, 8) + "...",
        isInMemory: activeBrokerCreds !== null
      });
    } catch (error: any) {
      res.status(401).json({ status: "unauthenticated", error: error.message });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { clientId, secretKey, totpKey } = req.body;
      if (!clientId || !secretKey) {
        return res.status(400).json({ error: "Client ID and Secret Key are required." });
      }
      activeBrokerCreds = { clientId, secretKey, totpKey };
      const checksum = generateChecksum(clientId, secretKey);
      res.json({
        status: "authenticated",
        clientId: clientId.length > 4 ? (clientId.substring(0, 4) + "****") : "****",
        checksum: checksum.substring(0, 8) + "...",
        isInMemory: true
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    activeBrokerCreds = null;
    res.json({ status: "logged_out" });
  });

  app.get("/api/strategy/supertrend", (req, res) => {
    // Simulated market data for demonstration representing RELIANCE (INR)
    const mockData = Array.from({ length: 50 }, (_, i) => {
      const base = 2400 + Math.sin(i / 5) * 80 + (i * 2); // trending structure
      return {
        high: base + 15 + Math.random() * 12,
        low: base - 15 - Math.random() * 12,
        close: base + (Math.random() - 0.5) * 15
      };
    });

    const signals = calculateSupertrend(mockData);
    res.json(signals);
  });

  app.get("/api/orders", (req, res) => {
    res.json(executedOrders);
  });

  app.get("/api/orders/export.csv", (req, res) => {
    const headers = [
      "Order ID",
      "Timestamp (UTC)",
      "Symbol",
      "Action",
      "Type",
      "Quantity",
      "Price (INR)",
      "Total Value (INR)",
      "Status",
      "Signature"
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = executedOrders.map(order => [
      escapeCsv(order.id),
      escapeCsv(order.timestamp),
      escapeCsv(order.symbol),
      escapeCsv(order.action),
      escapeCsv(order.type),
      order.quantity,
      order.price.toFixed(2),
      (order.quantity * order.price).toFixed(2),
      escapeCsv(order.status),
      escapeCsv(order.signature)
    ].join(","));

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const filename = `protrader_executed_orders_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  });

  app.post("/api/orders/place", (req, res) => {
    try {
      const { symbol, action, quantity, price, type } = req.body;
      if (!symbol || !action || !quantity || !price || !type) {
        return res.status(400).json({ error: "Missing required order parameters." });
      }

      // Check broker connection
      const { clientId, secretKey } = getBrokerCreds();

      // Create raw string to sign
      const timestamp = new Date().toISOString();
      const payloadToSign = `${symbol}:${action}:${quantity}:${price}:${timestamp}`;

      // Simulate HMAC dynamic signature verification logic commonly used by brokers
      const signature = generateHMACSignature(payloadToSign, secretKey);

      const newOrder = {
        id: "ORD-" + Math.floor(Math.random() * 900000 + 100000),
        timestamp,
        symbol: symbol.toUpperCase(),
        action: action.toUpperCase() as 'BUY' | 'SELL',
        type: type.toUpperCase(),
        quantity: Number(quantity),
        price: Number(price),
        signature: signature.substring(0, 16) + "...",
        status: "FILLED"
      };

      executedOrders.push(newOrder);
      res.json({ success: true, order: newOrder });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  // Vite middleware setup
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
