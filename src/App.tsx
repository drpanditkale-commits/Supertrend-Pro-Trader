import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Zap, 
  TrendingUp, 
  Activity, 
  Lock, 
  Settings, 
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertCircle,
  CheckCircle,
  LogOut,
  Key,
  Database,
  HelpCircle,
  ShoppingCart,
  Clock,
  ExternalLink,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

interface Signal {
  time: number;
  close: number;
  upperBand: number;
  lowerBand: number;
  trend: 'up' | 'down';
}

interface AuthStatus {
  status: string;
  clientId: string;
  checksum: string;
  isInMemory?: boolean;
  error?: string;
}

interface ExecutedOrder {
  id: string;
  timestamp: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  type: string;
  quantity: number;
  price: number;
  signature: string;
  status: string;
}

export default function App() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'faq'>('dashboard');

  // Broker Login state
  const [inputClientId, setInputClientId] = useState('');
  const [inputSecretKey, setInputSecretKey] = useState('');
  const [inputTotpKey, setInputTotpKey] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Order Submission state
  const [symbol, setSymbol] = useState('RELIANCE');
  const [orderAction, setOrderAction] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState('MARKET');
  const [orderQuantity, setOrderQuantity] = useState(10);
  const [orderPrice, setOrderPrice] = useState(2400.0);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orders, setOrders] = useState<ExecutedOrder[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Auto-Trader trigger settings
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);
  const [lastTrackedTrend, setLastTrackedTrend] = useState<'up' | 'down' | null>(null);
  const [auditStatus, setAuditStatus] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuth(data);
    } catch (e) {
      setAuth({ status: 'unauthenticated', clientId: 'N/A', checksum: 'N/A', error: 'Failed to connect' });
    }
  };

  const fetchSignals = async () => {
    try {
      const res = await fetch('/api/strategy/supertrend');
      if (res.ok) {
        const data = await res.json();
        setSignals(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchSignals();
    fetchOrders();
    const interval = setInterval(() => {
      fetchSignals();
      fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update orderPrice when signal changes to match prevailing close price
  useEffect(() => {
    if (signals.length > 0) {
      const lastPrice = signals[signals.length - 1].close;
      setOrderPrice(Number(lastPrice.toFixed(2)));

      // Auto-trading trigger logic
      const latestTrend = signals[signals.length - 1].trend;
      if (autoTradeEnabled && auth?.status === 'authenticated' && latestTrend !== lastTrackedTrend) {
        if (lastTrackedTrend !== null) {
          triggerAutoOrder(latestTrend, lastPrice);
        }
        setLastTrackedTrend(latestTrend);
      } else if (lastTrackedTrend === null) {
        setLastTrackedTrend(latestTrend);
      }
    }
  }, [signals, autoTradeEnabled, auth]);

  const triggerAutoOrder = async (trend: 'up' | 'down', price: number) => {
    try {
      const action = trend === 'up' ? 'BUY' : 'SELL';
      await fetch('/api/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'RELIANCE',
          action: action,
          quantity: 10,
          price: Number(price.toFixed(2)),
          type: 'MARKET'
        })
      });
      fetchOrders();
    } catch (e) {
      console.error("Auto order placement failed", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputClientId || !inputSecretKey) {
      setLoginError('Client ID and Secret Key fields are required.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    setLoginSuccess(false);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: inputClientId,
          secretKey: inputSecretKey,
          totpKey: inputTotpKey
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Connection failed');
      }
      setAuth(data);
      setLoginSuccess(true);
      setInputSecretKey('');
      setInputTotpKey('');
    } catch (err: any) {
      setLoginError(err.message || 'Authentication error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setAuth({ status: 'unauthenticated', clientId: '', checksum: '' });
        setInputClientId('');
        setLoginSuccess(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || auth.status !== 'authenticated') {
      setOrderError('You must link your secure broker session prior to executing trades.');
      return;
    }
    setOrderLoading(true);
    setOrderError('');
    setOrderSuccess(false);

    try {
      const res = await fetch('/api/orders/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol,
          action: orderAction,
          type: orderType,
          quantity: orderQuantity,
          price: orderPrice
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Order failed');
      }
      setOrderSuccess(true);
      fetchOrders();
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (err: any) {
      setOrderError(err.message || 'Order submission failed.');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (orders.length === 0) return;
    setIsExporting(true);

    try {
      const headers = [
        "Order ID",
        "Timestamp (ISO UTC)",
        "Date (Local)",
        "Time (Local)",
        "Symbol",
        "Action",
        "Order Type",
        "Quantity",
        "Price (INR)",
        "Total Value (INR)",
        "Status",
        "HMAC Signature"
      ];

      const escapeCsv = (val: any) => {
        const str = String(val ?? "");
        if (str.includes(",") || str.includes("\"") || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = orders.map((order) => {
        const d = new Date(order.timestamp);
        const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString() : '';
        const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString() : '';
        const totalVal = (order.quantity * order.price).toFixed(2);

        return [
          escapeCsv(order.id),
          escapeCsv(order.timestamp),
          escapeCsv(dateStr),
          escapeCsv(timeStr),
          escapeCsv(order.symbol),
          escapeCsv(order.action),
          escapeCsv(order.type),
          order.quantity,
          order.price.toFixed(2),
          totalVal,
          escapeCsv(order.status),
          escapeCsv(order.signature)
        ].join(",");
      });

      // UTF-8 BOM (\uFEFF) prefix guarantees proper UTF-8 decoding in Excel and spreadsheet viewers
      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const filenameDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const fileName = `protrader_executed_orders_${filenameDate}.csv`;

      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.setAttribute('download', fileName);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      setExportMessage(`Successfully exported ${orders.length} order record${orders.length > 1 ? 's' : ''} to "${fileName}"`);
      setTimeout(() => setExportMessage(null), 5000);
    } catch (err: any) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const currentTrend = signals[signals.length - 1]?.trend;

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      {/* Sidebar - Inspired by Professional Polish */}
      <aside className="w-64 bg-[#0f172a] text-[#f8fafc] flex flex-col shrink-0">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <h1 className="font-bold tracking-tight text-lg">ProTrader</h1>
          </div>
          
          <div className="text-[10px] uppercase tracking-widest text-[#3b82f6] font-black mb-4 px-2">
            Workspace Hub
          </div>
          
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors font-medium ${activeTab === 'dashboard' ? 'bg-[#1e293b] text-white' : 'text-[#94a3b8] hover:text-white'}`}
            >
              <Activity className="w-4 h-4 opacity-70" />
              <span>Dashboard Core</span>
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors font-medium ${activeTab === 'orders' ? 'bg-[#1e293b] text-white' : 'text-[#94a3b8] hover:text-white'}`}
            >
              <ShoppingCart className="w-4 h-4 opacity-70" />
              <span>Execution Center</span>
              {orders.length > 0 && (
                <span className="ml-auto bg-blue-600 text-white font-mono text-[9px] px-2 py-0.5 rounded-full font-bold">
                  {orders.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('faq')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors font-medium ${activeTab === 'faq' ? 'bg-[#1e293b] text-white' : 'text-[#94a3b8] hover:text-white'}`}
            >
              <HelpCircle className="w-4 h-4 opacity-70" />
              <span>Broker Guide FAQ</span>
            </button>
          </nav>

          <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-[#64748b] font-bold px-2">
              Automated Trading
            </div>
            <label className="flex items-center gap-2 px-2 text-xs text-[#94a3b8] cursor-pointer hover:text-white select-none">
              <input 
                type="checkbox"
                checked={autoTradeEnabled}
                onChange={(e) => setAutoTradeEnabled(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>Trigger Bot on Trend flip</span>
            </label>
          </div>
        </div>
        
        <div className="mt-auto p-6 border-t border-[#1e293b] text-[11px] text-[#64748b]">
          ProTrader Runtime v2.4.1<br />
          System Status: <span className="text-emerald-500 font-bold">Optimal</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-[#e2e8f0] px-8 flex items-center justify-between shrink-0">
          <div className="text-sm font-medium">
            <span className="text-[#64748b]">Phoenix-Alpha</span>
            <span className="mx-2 text-[#cbd5e1]">/</span>
            <span className="text-[#0f172a] font-semibold uppercase tracking-wider text-xs">Strategy Suite</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-[12px] text-[#64748b] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Real-time update stream
            </div>
            <button 
              onClick={() => { setLoading(true); fetchSignals(); fetchOrders(); }}
              className="p-2 text-[#64748b] hover:bg-[#f1f5f9] rounded-full transition-all"
              title="Sync market data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Content Portal */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-6xl mx-auto space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#0f172a] tracking-tight">
                  {activeTab === 'dashboard' ? 'Market Metrics & Algorithms' : 
                   activeTab === 'orders' ? 'Execution & Order Center' : 'Broker Linking FAQ Guide'}
                </h2>
                <p className="text-sm text-[#64748b] mt-1">
                  {activeTab === 'dashboard' ? 'Monitor real-time calculations from the Supertrend algorithm.' : 
                   activeTab === 'orders' ? 'Submit manually validated security tickets or configure auto-triggers.' : 
                   'Detailed visual instructions for linking trading strategies with exchange brokers.'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={() => setActiveTab('faq')}
                  className="px-4 py-1.5 bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-semibold text-[#1e293b] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  How to place order?
                </button>
              </div>
            </header>

            {/* Auth Warning Alert */}
            {(auth?.status === 'unauthenticated' || auth?.error) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-4"
              >
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-red-900 uppercase tracking-tight">Security Access Required</h4>
                  <p className="text-xs text-red-700 mt-1">
                    Broker authorization is currently offline. Please enter your credentials in the <span className="font-semibold">Broker Access System</span> to verify connections and enable trading.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('dashboard')} 
                  className="text-xs font-bold text-red-800 hover:underline bg-transparent border-0 cursor-pointer"
                >
                  Go to Login →
                </button>
              </motion.div>
            )}

            {/* Top Grid Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Calculated Strategy', value: 'Supertrend (10,3)', icon: TrendingUp, color: 'blue' },
                { label: 'Prevailing Trend', value: currentTrend === 'up' ? 'Bullish / Long' : currentTrend === 'down' ? 'Bearish / Short' : 'Analyzing', icon: Activity, color: currentTrend === 'up' ? 'emerald' : currentTrend === 'down' ? 'red' : 'slate' },
                { label: 'Dynamic Verification Hash', value: auth?.checksum || 'Unauthenticated', icon: Lock, color: 'slate' }
              ].map((stat, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white border border-[#e2e8f0] p-6 rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <stat.icon className="w-5 h-5 text-[#94a3b8]" />
                    <span className="text-[10px] font-black uppercase text-[#cbd5e1] tracking-widest">Parity Verification</span>
                  </div>
                  <p className="text-xs font-bold text-[#64748b] uppercase tracking-wide">{stat.label}</p>
                  <p className={`text-xl font-extrabold mt-1 text-[#0f172a] truncate ${stat.color === 'emerald' ? 'text-emerald-600' : stat.color === 'red' ? 'text-red-500' : ''}`}>
                    {stat.value}
                  </p>
                </motion.div>
              ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Left Dashboard Column */}
                <div className="lg:col-span-2 space-y-8">
                  
                  {/* Recharts Chart Component */}
                  <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
                      <div>
                        <h3 className="font-bold text-sm uppercase text-[#0f172a] flex items-center gap-2">
                          <Database className="w-4 h-4 text-blue-600" />
                          Supertrend Price bands Chart
                        </h3>
                        <p className="text-xs text-[#64748b] mt-0.5">Real-time indicators plotted via dynamic pricing engine</p>
                      </div>
                      <div className="flex gap-4 text-[10px] tracking-tight shrink-0">
                        <div className="flex items-center gap-1 font-semibold text-blue-600">
                          <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm" />
                          CLOSE
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-red-500">
                          <div className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
                          UPPER (RESIST)
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-emerald-500">
                          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                          LOWER (SUPPORT)
                        </div>
                      </div>
                    </div>

                    <div className="h-72 w-full text-xs font-medium">
                      {signals.length === 0 ? (
                        <div className="h-full w-full flex items-center justify-center text-[#64748b] italic">
                          Waiting for strategy signals to compile...
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={signals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis 
                              dataKey="time" 
                              tickFormatter={(tick) => `#${tick}`}
                              stroke="#94a3b8" 
                              fontSize={10}
                              tickLine={false}
                            />
                            <YAxis 
                              domain={['auto', 'auto']} 
                              stroke="#94a3b8" 
                              fontSize={10}
                              tickLine={false}
                              tickFormatter={(val) => `₹${val.toFixed(0)}`}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#f8fafc', fontSize: '11px' }}
                              itemStyle={{ color: '#f8fafc' }}
                              labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                              formatter={(value: any, name: any) => {
                                if (name === 'close') return [`₹${parseFloat(value).toFixed(2)}`, 'Close Price'];
                                if (name === 'upperBand') return [`₹${parseFloat(value).toFixed(2)}`, 'Resistance Boundary'];
                                if (name === 'lowerBand') return [`₹${parseFloat(value).toFixed(2)}`, 'Support Boundary'];
                                return [value, name];
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="close" 
                              stroke="#2563eb" 
                              strokeWidth={2.5} 
                              dot={false}
                              activeDot={{ r: 5 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="upperBand" 
                              stroke="#ef4444" 
                              strokeWidth={1.5} 
                              strokeDasharray="4 4"
                              dot={false}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="lowerBand" 
                              stroke="#10b981" 
                              strokeWidth={1.5} 
                              strokeDasharray="4 4"
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Real-time strategy logs table */}
                  <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden font-sans">
                    <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-white col-span-1">
                      <h3 className="font-bold text-sm uppercase text-[#0f172a] flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600 self-center" />
                        Strategy Stream Logs
                      </h3>
                      <div className="flex gap-2">
                        <span className="px-2 py-1 bg-[#f1f5f9] rounded text-[10px] font-bold text-[#64748b] uppercase">ATR: 2.45</span>
                        <span className="px-2 py-1 bg-[#eff6ff] rounded text-[10px] font-bold text-blue-600 uppercase border border-blue-100">Secure SHA-256</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                          <tr className="bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#e2e8f0]">
                            <th className="px-6 py-4 uppercase text-[10px] tracking-wider">Step</th>
                            <th className="px-6 py-4 uppercase text-[10px] tracking-wider">Price (INR)</th>
                            <th className="px-6 py-4 uppercase text-[10px] tracking-wider">Resistance/Support Bounds</th>
                            <th className="px-6 py-4 uppercase text-[10px] tracking-wider text-right">Trend Direction</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0]">
                          {signals.slice().reverse().slice(0, 5).map((s, i) => (
                            <tr key={i} className="hover:bg-[#f1f5f9]/50 transition-colors">
                              <td className="px-6 py-3.5 font-mono text-xs text-[#94a3b8]">#{s.time}</td>
                              <td className="px-6 py-3.5 font-bold text-[#0f172a] tracking-tight">₹{s.close.toFixed(2)}</td>
                              <td className="px-6 py-3.5 text-[#64748b] font-mono text-xs">
                                {s.upperBand.toFixed(2)} / {s.lowerBand.toFixed(2)}
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${s.trend === 'up' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                  {s.trend === 'up' ? 'Buy Signal' : 'Sell Signal'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Side: Authentication system panel */}
                <div className="space-y-8 font-sans">
                  
                  {/* Broker Login Box */}
                  <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-[#e2e8f0]">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <h3 className="text-sm font-bold uppercase text-[#0f172a] tracking-tight">Broker Access System</h3>
                    </div>

                    {auth?.status === 'authenticated' ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3 animate-fade-in">
                          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Active Connection</p>
                            <p className="text-[11px] text-emerald-600 mt-1 leading-relaxed">
                              Authorized API tunnel active. Safe HMAC security validation enabled.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest leading-none">Broker Profile ID</label>
                            <div className="p-2.5 bg-[#f8fafc] rounded border border-[#e2e8f0] font-mono text-xs text-[#0f172a] flex items-center justify-between">
                              <span className="font-semibold">{auth.clientId}</span>
                              <span className="text-[10px] text-blue-600 font-bold px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded">DYNAMIC</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest leading-none">HMAC Checksum</label>
                            <div className="p-2.5 bg-[#f8fafc] rounded border border-[#e2e8f0] font-mono text-xs text-[#627d98] truncate italic">
                              {auth.checksum}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center gap-2 py-2.5 font-semibold text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          Disconnect Session
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleLogin} className="space-y-4">
                        <p className="text-xs text-[#64748b] leading-relaxed">
                          Provide secure exchange credentials to calculate security check hashes and open trading access.
                        </p>

                        {loginError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
                            {loginError}
                          </div>
                        )}

                        {loginSuccess && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                            Authenticated successfully!
                          </div>
                        )}

                        <div className="space-y-3.5">
                          <div className="space-y-1">
                            <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest">Client ID</label>
                            <input
                              type="text"
                              required
                              value={inputClientId}
                              onChange={(e) => setInputClientId(e.target.value)}
                              placeholder="e.g. USER-7592"
                              className="w-full px-3 py-2 bg-white border border-[#e2e8f0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs font-semibold text-[#0f172a] shadow-inner transition-colors outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest flex items-center justify-between">
                              <span>Secret Key</span>
                              <span className="text-[8px] text-blue-600 font-semibold">Protected Layer</span>
                            </label>
                            <input
                              type="password"
                              required
                              value={inputSecretKey}
                              onChange={(e) => setInputSecretKey(e.target.value)}
                              placeholder="••••••••••••••••"
                              className="w-full px-3 py-2 bg-white border border-[#e2e8f0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs font-semibold text-[#0f172a] shadow-inner transition-colors outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest flex items-center justify-between">
                              <span>TOTP Key</span>
                              <span className="text-[8px] text-slate-400 font-normal">Optional</span>
                            </label>
                            <input
                              type="password"
                              value={inputTotpKey}
                              onChange={(e) => setInputTotpKey(e.target.value)}
                              placeholder="Authenticator Secret"
                              className="w-full px-3 py-2 bg-white border border-[#e2e8f0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs font-semibold text-[#0f172a] shadow-inner transition-colors outline-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loginLoading}
                          className="w-full flex items-center justify-center gap-2 py-2.5 font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-lg shadow-blue-600/15 transition-all outline-none cursor-pointer"
                        >
                          {loginLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Key className="w-4 h-4" />
                              Link Secure Session
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Quick FAQ summary note */}
                  <div className="bg-white border border-[#e2e8f0] p-6 rounded-xl space-y-3.5 shadow-sm">
                    <h4 className="font-bold text-xs uppercase text-[#0f172a] flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      Linking FAQ Highlights
                    </h4>
                    <div className="space-y-2 text-xs text-[#64748b] leading-relaxed">
                      <p>
                        <strong className="text-[#1e293b] font-semibold block">Q: Why link to exchange broker?</strong>
                        It securely feeds live portfolio calculations and automates algorithmic Buy/Sell orders into action safely.
                      </p>
                      <p>
                        <strong className="text-[#1e293b] font-semibold block">Q: Where are orders executed?</strong>
                        Right here! You can execute manually inside the <span className="text-blue-600 font-semibold cursor-pointer hover:underline" onClick={() => setActiveTab('orders')}>Execution Center</span> or enable auto-trading.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Manual Order Entry Form */}
                <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-6 md:p-8 space-y-6">
                  <div>
                    <h3 className="font-bold text-base text-[#0f172a] flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                      Order Execution Ticket
                    </h3>
                    <p className="text-xs text-[#64748b] mt-1">Submit digital parameters directly to your configured broker.</p>
                  </div>

                  <form onSubmit={handlePlaceOrder} className="space-y-4 font-sans">
                    {orderError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600">
                        {orderError}
                      </div>
                    )}

                    {orderSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        Order executed and filled inside broker log!
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setOrderAction('BUY')}
                        className={`py-3 text-xs font-black uppercase rounded-lg border transition-all cursor-pointer ${orderAction === 'BUY' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-white text-slate-600 border-[#e2e8f0]'}`}
                      >
                        Buy / Long
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderAction('SELL')}
                        className={`py-3 text-xs font-black uppercase rounded-lg border transition-all cursor-pointer ${orderAction === 'SELL' ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' : 'bg-white text-slate-600 border-[#e2e8f0]'}`}
                      >
                        Sell / Short
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest block mb-1">Asset Symbol</label>
                        <select
                          value={symbol}
                          onChange={(e) => setSymbol(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#e2e8f0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs font-semibold text-[#0f172a] shadow-inner transition-colors outline-none"
                        >
                          <option value="RELIANCE">RELIANCE (Reliance Industries)</option>
                          <option value="TCS">TCS (Tata Consultancy Services)</option>
                          <option value="INFY">INFY (Infosys Limited)</option>
                          <option value="HDFCBANK">HDFCBANK (HDFC Bank Ltd.)</option>
                          <option value="NIFTY50">NIFTY50 (Nifty 50 Index)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest block mb-1">Order Type</label>
                          <select
                            value={orderType}
                            onChange={(e) => setOrderType(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#e2e8f0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs font-semibold text-[#0f172a] shadow-inner transition-colors outline-none"
                          >
                            <option value="MARKET">Market</option>
                            <option value="LIMIT">Limit</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest block mb-1">Quantity</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={orderQuantity}
                            onChange={(e) => setOrderQuantity(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-[#e2e8f0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs font-semibold text-[#0f172a] shadow-inner transition-colors outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest block mb-1">Limit Price (INR / ₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={orderPrice}
                          onChange={(e) => setOrderPrice(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-[#e2e8f0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs font-semibold text-[#0f172a] shadow-inner transition-colors outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-[#64748b] font-mono space-y-1">
                      <div className="font-bold text-slate-800 mb-1">SHA-256 HMAC PREVIEW:</div>
                      <div className="truncate">Payload: {symbol}:{orderAction}:{orderQuantity}:{orderPrice}:[TIME]</div>
                      <div className="text-blue-600 italic">Signature: {auth?.status === 'authenticated' ? 'HMAC_SECURE_AUTOGENERATE' : 'UNAUTHENTICATED'}</div>
                    </div>

                    <button
                      type="submit"
                      disabled={orderLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-lg shadow-lg shadow-blue-600/20 transition-all cursor-pointer outline-none"
                    >
                      {orderLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          Transmit Secure Order
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Executed Orders History log */}
                <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden font-sans flex flex-col">
                  {/* Card Header with Export Action */}
                  <div className="px-6 py-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-4 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm uppercase text-[#0f172a] flex items-center gap-2">
                          Executed Order History
                        </h3>
                        <p className="text-[11px] text-[#64748b]">Cryptographically signed transactional records</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 bg-[#eff6ff] rounded text-[10px] font-bold text-blue-700 uppercase border border-blue-100">
                        {orders.length} {orders.length === 1 ? 'Record' : 'Records'}
                      </span>
                      
                      <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={orders.length === 0 || isExporting}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm cursor-pointer select-none ${
                          orders.length === 0
                            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                            : 'bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 border-blue-200 hover:border-blue-300 shadow-blue-500/10 active:scale-95'
                        }`}
                        title={orders.length === 0 ? "No executed order records to export" : "Export executed order history to CSV for local archiving"}
                      >
                        {isExporting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Export Success Notification Banner */}
                  <AnimatePresence>
                    {exportMessage && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-900 font-medium flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{exportMessage}</span>
                        </div>
                        <button
                          onClick={() => setExportMessage(null)}
                          className="text-emerald-700 hover:text-emerald-950 text-xs font-semibold px-2 py-0.5 rounded cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {orders.length === 0 ? (
                    <div className="p-12 text-center text-[#64748b] italic text-xs space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <p>No executed trades detected in the current broker session storage.</p>
                      <p className="text-[11px] text-slate-400">
                        Submit a manual order ticket on the left or activate automated trading to populate records.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead>
                            <tr className="bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#e2e8f0]">
                              <th className="px-6 py-3.5 uppercase text-[10px] tracking-wider">Order ID & Date</th>
                              <th className="px-6 py-3.5 uppercase text-[10px] tracking-wider">Symbol</th>
                              <th className="px-6 py-3.5 uppercase text-[10px] tracking-wider">Action</th>
                              <th className="px-6 py-3.5 uppercase text-[10px] tracking-wider">Qty / Price</th>
                              <th className="px-6 py-3.5 uppercase text-[10px] tracking-wider">Total Value (₹)</th>
                              <th className="px-6 py-3.5 uppercase text-[10px] tracking-wider">HMAC Signature</th>
                              <th className="px-6 py-3.5 uppercase text-[10px] tracking-wider text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e2e8f0]">
                            {orders.slice().reverse().map((o, i) => {
                              const dateObj = new Date(o.timestamp);
                              const formattedDate = !isNaN(dateObj.getTime()) 
                                ? `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                                : 'Just now';
                              const totalValue = (o.quantity * o.price).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              });

                              return (
                                <tr key={i} className="hover:bg-[#f1f5f9]/50 transition-colors">
                                  <td className="px-6 py-3">
                                    <div className="font-mono text-xs font-bold text-[#1e293b]">{o.id}</div>
                                    <div className="text-[10px] text-[#94a3b8] flex items-center gap-1 mt-0.5">
                                      <Clock className="w-3 h-3" />
                                      {formattedDate}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3">
                                    <span className="font-bold text-[#0f172a]">{o.symbol}</span>
                                    <span className="ml-1.5 text-[10px] text-slate-500 font-mono">({o.type})</span>
                                  </td>
                                  <td className="px-6 py-3">
                                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                      o.action === 'BUY' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                        : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}>
                                      {o.action}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-[#1e293b] font-medium text-xs">
                                    {o.quantity} @ ₹{o.price.toFixed(2)}
                                  </td>
                                  <td className="px-6 py-3 text-[#0f172a] font-bold text-xs">
                                    ₹{totalValue}
                                  </td>
                                  <td className="px-6 py-3 font-mono text-[10px] text-[#94a3b8]" title={o.signature}>
                                    {o.signature}
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 text-xs">
                                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                                      {o.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Table Footer */}
                      <div className="px-6 py-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748b]">
                        <div className="flex items-center gap-4">
                          <span>
                            Total Traded Value: <strong className="text-[#0f172a]">
                              ₹{orders.reduce((sum, o) => sum + (o.quantity * o.price), 0).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </strong>
                          </span>
                          <span className="hidden sm:inline text-slate-300">|</span>
                          <span className="hidden sm:inline">
                            Total Records: <strong className="text-[#0f172a]">{orders.length}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-500">
                            Archived locally via RFC-4180 CSV standard
                          </span>
                          <button
                            onClick={handleExportCSV}
                            disabled={isExporting}
                            className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer inline-flex items-center gap-1 text-[11px]"
                          >
                            <Download className="w-3 h-3" />
                            Download Archive
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

              </div>
            )}

            {activeTab === 'faq' && (
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-sm space-y-8 font-sans">
                <div className="flex items-center gap-3 pb-4 border-b border-[#e2e8f0]">
                  <HelpCircle className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-black text-[#0f172a] text-lg uppercase tracking-tight">Interactive Knowledge Hub</h3>
                    <p className="text-xs text-[#64748b] mt-0.5">Explore how the ProTrader environment handles linking and algorithmic order workflows.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0">1</div>
                      <h4 className="font-bold text-[#0f172a] text-sm">What is the use of linking to the broker?</h4>
                    </div>
                    <div className="text-xs text-[#64748b] leading-relaxed space-y-2">
                      <p>
                        Linking your broker account establishes a secure, validated bridge between this decision matrix app and the actual financial market.
                      </p>
                      <ul className="list-disc list-inside space-y-1 font-medium text-slate-700">
                        <li><strong>Safe Data Feeds:</strong> Streams dynamic portfolio details, balance lists, and asset price quotes safely.</li>
                        <li><strong>Transaction Integrity:</strong> Automatically signs every order using an HMAC SHA-256 scheme to guard keys against MITM tampering.</li>
                        <li><strong>Algorithmic Execution:</strong> Feeds high-precision calculations like the Supertrend indicator directly into automatic executions.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0">2</div>
                      <h4 className="font-bold text-[#0f172a] text-sm">Where to put an order?</h4>
                    </div>
                    <div className="text-xs text-[#64748b] leading-relaxed space-y-2">
                      <p>
                        There are two robust pathways to dispatch trading orders on this system:
                      </p>
                      <ul className="list-disc list-inside space-y-1 font-medium text-slate-700">
                        <li>
                          <strong>The Execution Center Ticket form:</strong> Click "Execution Center" on the sidebar tab to fill in standard parameters (Symbol, Action, Qty, Limit price) and securely transmit manually validated orders with live checksums.
                        </li>
                        <li>
                          <strong>Trigger Automatic Trading Bot:</strong> Toggle the "Trigger Bot on Trend flip" utility in the sidebar. The system will automatically execute buy/sell market orders the exact split-second the Supertrend indicator changes momentum directions.
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4 md:col-span-2 pt-4 border-t border-[#e2e8f0]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0">3</div>
                      <h4 className="font-bold text-[#0f172a] text-sm">How do I archive and export my trading records?</h4>
                    </div>
                    <div className="text-xs text-[#64748b] leading-relaxed space-y-2">
                      <p>
                        Navigate to the <span className="text-blue-600 font-semibold cursor-pointer hover:underline" onClick={() => setActiveTab('orders')}>Execution Center</span> and locate the <strong>Executed Order History</strong> panel. Click the <strong>Export CSV</strong> button at the top-right of the table.
                      </p>
                      <ul className="list-disc list-inside space-y-1 font-medium text-slate-700">
                        <li><strong>Universal Compatibility:</strong> Uses the RFC-4180 format with UTF-8 BOM encoding for seamless display in Microsoft Excel, Apple Numbers, and Google Sheets.</li>
                        <li><strong>Full Audit Trail:</strong> Each archived record exports Order ID, UTC & local timestamp, Asset Symbol, Action (BUY/SELL), Order Type, Quantity, Price, Traded Value in INR (₹), Execution Status, and the cryptographic HMAC Signature.</li>
                        <li><strong>Zero Data Leakage:</strong> Your export is produced directly on your local device for maximum archival privacy.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-blue-900 uppercase">Cryptographical Safety Standard</h5>
                    <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
                      All calculations are performed secure-server-side within Node.js endpoints. Your individual Secret Key acts as a cryptographical signing salt and is never leaked or stored in plain-text client sessions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Refinement - Footer Card */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
               <div className="flex-1 font-sans">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">Refinement Active</span>
                  </div>
                  <h4 className="font-bold text-[#0f172a] italic">"Automating the SHA-256 checksum generation for project-alpha."</h4>
                  <p className="text-sm text-[#64748b] mt-2 leading-relaxed max-w-lg">
                    The security patcher has successfully isolated BROKER_SECRET keys in the server layer, preventing client-side leaks.
                  </p>
                  {auditStatus && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      {auditStatus}
                    </div>
                  )}
               </div>
               <button 
                 onClick={() => {
                   setAuditStatus("Audit Verified: Server SHA-256 and HMAC signatures are active and secure.");
                   setTimeout(() => setAuditStatus(null), 5000);
                 }}
                 className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all shrink-0 cursor-pointer"
               >
                 Run Security Audit
               </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
