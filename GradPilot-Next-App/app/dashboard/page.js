"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCampaignStore } from "@/lib/store";
import { toast } from "react-hot-toast";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Scatter, ScatterChart
} from "recharts";
import {
  ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp,
  CreditCard, Activity, Users, ShoppingCart, Wallet, Target,
  PiggyBank, TrendingDown, Sparkles, Rocket,
  FolderOpen, Clock, Trash2, ExternalLink, Workflow
} from "lucide-react";

const CHART_COLORS = {
  light: {
    primary: "#10b981",    // emerald-500
    secondary: "#3b82f6",  // blue-500
    tertiary: "#f59e0b",   // amber-500
    quaternary: "#8b5cf6", // violet-500
    profit: "#10b981",
    revenue: "#3b82f6",
    expenses: "#ef4444",
    portfolio: "#8b5cf6",
    target: "#94a3b8",
  },
  dark: {
    primary: "#34d399",    // emerald-400
    secondary: "#60a5fa",  // blue-400
    tertiary: "#fbbf24",   // amber-400
    quaternary: "#a78bfa", // violet-400
    profit: "#34d399",
    revenue: "#60a5fa",
    expenses: "#f87171",
    portfolio: "#a78bfa",
    target: "#64748b",
  }
};

// Backend base URL (deployed FastAPI). Prefer env override if present.
const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "https://lamaq-gradpilot.hf.space";

export default function Dashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [chartColors, setChartColors] = useState(CHART_COLORS.light);
  // Dynamic data state from FastAPI /analyze
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [forecastPayload, setForecastPayload] = useState(null); // full JSON response
  const [latestOnChain, setLatestOnChain] = useState(null);
  const [fileRef, setFileRef] = useState(null);
  const [formCols, setFormCols] = useState({ date_col: "", sales_col: "", id_col: "", category_col: "" });
  const [csvColumns, setCsvColumns] = useState([]);
  const [parseCsvLoading, setParseCsvLoading] = useState(false);
  // Parsed raw CSV (header + rows as arrays)
  const [parsedHeader, setParsedHeader] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  // Prepared data (after possible Revenue_Calculated addition)
  const [preparedHeader, setPreparedHeader] = useState([]);
  const [preparedRows, setPreparedRows] = useState([]);
  const [detectionResult, setDetectionResult] = useState(null);

  // Saved workflows
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const { setBrief: setStoreBrief, setStrategy, setWorkflow } = useCampaignStore();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/workflows/list');
        const json = await res.json();
        if (json.success) setSavedWorkflows(json.workflows || []);
      } catch {}
      setIsLoadingWorkflows(false);
    })();
  }, []);

  const handleLoadWorkflow = (wf) => {
    if (wf.brief) setStoreBrief(wf.brief);
    if (wf.strategyRationale) setStrategy({ rationale: wf.strategyRationale });
    setWorkflow(wf.nodes || [], wf.edges || []);
    toast.success('Workflow loaded');
    router.push('/campaign/canvas');
  };

  const handleDeleteWorkflow = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setSavedWorkflows(prev => prev.filter(w => String(w.id || w._id) !== String(id)));
        toast.success('Workflow deleted');
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete workflow');
    }
    setDeletingId(null);
  };

  /**
   * Detects sales column using the same 3-tier priority logic as backend
   * Priority 1: Direct revenue/amount/total columns
   * Priority 2: Calculate Revenue from Quantity × Price
   * Priority 3: Fallback to price/value columns
   */
  function detectSalesColumn(columns, dataPreview) {
    const lowerCols = columns.map(c => c.toLowerCase());

    // Helper: Check if column is numeric by sampling data
    const isNumericCol = (colName) => {
      const colIndex = columns.indexOf(colName);
      if (colIndex === -1) return false;

      const sample = dataPreview.slice(0, 10)
        .map(row => row[colIndex])
        .filter(val => val !== null && val !== undefined && val !== '');

      if (sample.length === 0) return false;
      return sample.every(val => !isNaN(parseFloat(val)) && isFinite(val));
    };

    let salesCol = null;
    let isCalculated = false;
    let qtyCol = null;
    let priceCol = null;

    // Priority 1: Explicit Revenue/Total columns
    const salesKeywords = ['revenue', 'amount', 'turnover', 'total', 'sales'];
    for (const kw of salesKeywords) {
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const lc = lowerCols[i];
        if (lc.includes(kw)) {
          if (lc.includes('channel') || lc.includes('region') || lc.includes('rep') || lc.includes('id') || lc.includes('status')) {
            continue;
          }
          if (isNumericCol(col)) {
            salesCol = col;
            break;
          }
        }
      }
      if (salesCol) break;
    }

    // Priority 2: Calculate Revenue from Quantity × Price
    if (!salesCol) {
      for (let i = 0; i < columns.length; i++) {
        if (lowerCols[i].includes('quantity') && isNumericCol(columns[i])) {
          qtyCol = columns[i];
          break;
        }
      }
      for (let i = 0; i < columns.length; i++) {
        if ((lowerCols[i].includes('price') || lowerCols[i].includes('unit_price')) && isNumericCol(columns[i])) {
          priceCol = columns[i];
          break;
        }
      }
      if (qtyCol && priceCol) {
        console.log(`Creating Revenue column from ${qtyCol} × ${priceCol}`);
        salesCol = 'Revenue_Calculated';
        isCalculated = true;
      }
    }

    // Priority 3: Fallback to Price/Value
    if (!salesCol) {
      const fallbackKeywords = ['price', 'value', 'close', 'adj close'];
      for (const kw of fallbackKeywords) {
        for (let i = 0; i < columns.length; i++) {
          if (lowerCols[i].includes(kw) && isNumericCol(columns[i])) {
            salesCol = columns[i];
            break;
          }
        }
        if (salesCol) break;
      }
    }

    return {
      salesColumn: salesCol,
      isCalculated: isCalculated,
      quantityColumn: qtyCol,
      priceColumn: priceCol
    };
  }

  /**
   * If revenue needs to be calculated, add it to the dataset before sending to API
   * dataRows are arrays; we append new column value at end.
   */
  function prepareDataForAPI(header, rows, detection) {
    if (!detection || !detection.isCalculated) {
      return { header, rows };
    }
    const qtyIdx = header.indexOf(detection.quantityColumn);
    const priceIdx = header.indexOf(detection.priceColumn);
    const newHeader = [...header, 'Revenue_Calculated'];
    const newRows = rows.map(r => {
      const qty = parseFloat(r[qtyIdx]) || 0;
      const price = parseFloat(r[priceIdx]) || 0;
      return [...r, qty * price];
    });
    return { header: newHeader, rows: newRows };
  }

  function generateCSVString(header, rows) {
    const escapeCell = (cell) => {
      if (cell == null) return '';
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const lines = [header.map(escapeCell).join(',')];
    rows.forEach(r => lines.push(r.map(escapeCell).join(',')));
    return lines.join('\n');
  }

  // Derived chart datasets
  const dynamicForecastSeries = (() => {
    if (!forecastPayload || !forecastPayload.forecast?.history || !forecastPayload.forecast?.prediction) return [];
    const history = forecastPayload.forecast.history.map(r => ({ ds: r.ds, actual: r.y, forecast: null }));
    const prediction = forecastPayload.forecast.prediction.map(r => ({ ds: r.ds, actual: null, forecast: r.forecast }));
    return [...history, ...prediction];
  })();

  const segmentationGroups = (() => {
    if (!forecastPayload || !forecastPayload.segmentation?.plot_data) return {};
    const bySeg = {};
    forecastPayload.segmentation.plot_data.forEach(row => {
      const label = row.Segment_Label || "Unknown";
      if (!bySeg[label]) bySeg[label] = [];
      bySeg[label].push(row);
    });
    return bySeg;
  })();

  const segmentColorPalette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]; // CSS variable driven

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFileRef(null);
      setCsvColumns([]);
      setParsedHeader([]);
      setParsedRows([]);
      setPreparedHeader([]);
      setPreparedRows([]);
      setDetectionResult(null);
      return;
    }
    setFileRef(file);
    setParseCsvLoading(true);
    setAnalyzeError(null);

    // Parse locally with Papa for detection logic
    Papa.parse(file, {
      complete: async (results) => {
        try {
          const raw = results.data.filter(r => Array.isArray(r) && r.length > 0);
          if (raw.length < 2) throw new Error('CSV has insufficient rows');
          const header = raw[0].map(h => String(h).trim());
          const rows = raw.slice(1).map(r => header.map((_, idx) => r[idx]));
          setParsedHeader(header);
          setParsedRows(rows);

          // Detection
          const detection = detectSalesColumn(header, rows);
          setDetectionResult(detection);
          let workingHeader = header;
          let workingRows = rows;
          if (detection.salesColumn) {
            setFormCols(c => ({ ...c, sales_col: detection.salesColumn }));
          }
          if (detection.isCalculated) {
            const prepared = prepareDataForAPI(header, rows, detection);
            workingHeader = prepared.header;
            workingRows = prepared.rows;
          }
          setPreparedHeader(workingHeader);
          setPreparedRows(workingRows);

          // Auto-detect date/id/category columns locally (skip backend call)
          const dateCol = workingHeader.find(c => /date|time|day/i.test(c)) || '';
          const idCol = workingHeader.find(c => /id|cust|customer/i.test(c)) || '';
          const catCol = workingHeader.find(c => /cat|category|prod|product|dept|department/i.test(c)) || '';
          setFormCols(c => ({ ...c, date_col: dateCol, id_col: idCol, category_col: catCol }));
          
          // Set csvColumns for dropdown display with sample values
          setCsvColumns(workingHeader.map((name, idx) => ({
            name,
            dtype: 'auto',
            samples: workingRows.slice(0, 3).map(row => row[idx]).filter(v => v != null && v !== '')
          })));
          setParseCsvLoading(false);
        } catch (err) {
          setAnalyzeError(err.message);
          setCsvColumns([]);
          setParseCsvLoading(false);
        }
      },
      error: (err) => {
        setAnalyzeError(err.message);
        setParseCsvLoading(false);
      }
    });
  };

  const handleAnalyze = async () => {
    if (!fileRef) {
      setAnalyzeError('Please select a CSV file first.');
      return;
    }
    if (!preparedHeader.length || !preparedRows.length) {
      setAnalyzeError('Parsed data unavailable. Re-upload CSV.');
      return;
    }
    setAnalyzeError(null);
    setAnalyzeLoading(true);
    try {
      // If revenue was calculated, preparedHeader includes Revenue_Calculated
      const csvString = generateCSVString(preparedHeader, preparedRows);
      const blob = new Blob([csvString], { type: 'text/csv' });
      const fd = new FormData();
      fd.append('file', blob, 'prepared.csv');
      
      // Add user email for MongoDB storage
      if (session?.user?.email) {
        fd.append('user_email', session.user.email);
      }
      
      // Ensure sales_col matches detection
      if (detectionResult?.salesColumn) {
        fd.append('sales_col', detectionResult.salesColumn);
      } else if (formCols.sales_col) {
        fd.append('sales_col', formCols.sales_col);
      }
      // Pass other columns
      ['date_col', 'id_col', 'category_col'].forEach(k => { if (formCols[k]) fd.append(k, formCols[k]); });
      
      console.log('Sending to backend:', {
        url: `${BACKEND_BASE}/analyze`,
        columns: Object.fromEntries(fd.entries())
      });
      
      const res = await fetch(`${BACKEND_BASE}/analyze`, { method: 'POST', body: fd });
      
      console.log('Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Backend error:', errorText);
        throw new Error(`Analyze failed (${res.status}): ${errorText.slice(0, 200)}`);
      }
      
      const json = await res.json();
      console.log('Analysis result:', json);
      setForecastPayload(json);
    } catch (e) {
      console.error('Analyze error:', e);
      setAnalyzeError(e.message || 'Failed to fetch analysis');
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const fetchLatestOnChain = async () => {
    try {
      const res = await fetch(`${BACKEND_BASE}/latest-on-chain`);
      if (!res.ok) throw new Error("Failed to fetch latest on-chain record");
      setLatestOnChain(await res.json());
    } catch (e) {
      setLatestOnChain({ error: e.message });
    }
  };

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
      setChartColors(isDark ? CHART_COLORS.dark : CHART_COLORS.light);
    };
    
    updateTheme();
    
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const PIE_COLORS = [
    chartColors.primary,
    chartColors.secondary,
    chartColors.tertiary,
    chartColors.quaternary,
  ];

  const StatCard = ({ title, value, change, icon: Icon, trend }) => (
    <Card className="overflow-hidden border-border/40 backdrop-blur-sm bg-card/50 hover:bg-card/70 transition-all duration-300 hover:scale-105 hover:shadow-lg group cursor-pointer">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground ivy-font group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
        <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500 transition-colors">
          <Icon className="h-4 w-4 text-emerald-500 group-hover:text-white transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground ivy-font">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          {trend === "up" ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className={trend === "up" ? "text-emerald-500" : "text-red-500"}>
            {change}
          </span>
          <span>from last month</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto p-6 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground ivy-font mb-2">
              Student Counselling & Lead Dashboard
            </h1>
            <p className="text-muted-foreground ivy-font">
              AI-powered student lead qualification and counselling analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1 ivy-font">
              November 2025
            </Badge>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white ivy-font">
              <Target className="h-4 w-4 mr-2" />
              Launch Follow-up
            </Button>
          </div>
        </div>

        {/* Dynamic Upload & Analyze Section */}
        <Card className="border-border/40 backdrop-blur-sm bg-card/50">
          <CardHeader>
            <CardTitle className="ivy-font">Upload Student Data (CSV)</CardTitle>
            <CardDescription className="ivy-font">Send data to FastAPI backend for lead scoring, segmentation & reporting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-3">
              <label className="text-sm font-medium ivy-font">Select CSV File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-md file:border file:border-border file:bg-muted/50 file:text-foreground hover:file:bg-muted/70 file:cursor-pointer cursor-pointer"
              />
              {parseCsvLoading && <p className="text-sm text-muted-foreground">Analyzing CSV columns...</p>}
            </div>

            {/* Column Mapping Dropdowns */}
            {csvColumns.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold ivy-font text-foreground">Map CSV Columns</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date Column */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium ivy-font text-muted-foreground">Date Column</label>
                    <select
                      value={formCols.date_col}
                      onChange={e => setFormCols(c => ({...c, date_col: e.target.value}))}
                      className="w-full px-3 py-2 rounded-md bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select Date Column --</option>
                      {csvColumns.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.samples.slice(0, 2).join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sales Column */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium ivy-font text-muted-foreground">Sales Column</label>
                    <select
                      value={formCols.sales_col}
                      onChange={e => setFormCols(c => ({...c, sales_col: e.target.value}))}
                      className="w-full px-3 py-2 rounded-md bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select Sales Column --</option>
                      {detectionResult?.isCalculated && (
                        <option value="Revenue_Calculated" className="bg-emerald-500/10 font-semibold">
                          Revenue_Calculated (Qty × Price) ⭐
                        </option>
                      )}
                      {csvColumns.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.samples.slice(0, 2).join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Student ID Column */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium ivy-font text-muted-foreground">Student ID Column (Optional)</label>
                    <select
                      value={formCols.id_col}
                      onChange={e => setFormCols(c => ({...c, id_col: e.target.value}))}
                      className="w-full px-3 py-2 rounded-md bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select ID Column --</option>
                      {csvColumns.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.samples.slice(0, 2).join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Column */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium ivy-font text-muted-foreground">Category Column (Optional)</label>
                    <select
                      value={formCols.category_col}
                      onChange={e => setFormCols(c => ({...c, category_col: e.target.value}))}
                      className="w-full px-3 py-2 rounded-md bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select Category Column --</option>
                      {csvColumns.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.samples.slice(0, 2).join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {detectionResult && (
                  <div className="mt-2 p-3 rounded-md border text-xs space-y-1 bg-muted/40 border-border/40">
                    {detectionResult.isCalculated ? (
                      <>
                        <p className="ivy-font"><span className="font-semibold text-emerald-600">Calculated Revenue Column Added:</span> Revenue_Calculated = {detectionResult.quantityColumn} × {detectionResult.priceColumn}</p>
                        <p className="ivy-font text-muted-foreground">This new column is physically appended and will be used as sales_col.</p>
                      </>
                    ) : (
                      <p className="ivy-font"><span className="font-semibold text-emerald-600">Detected Sales Column:</span> {detectionResult.salesColumn || 'None found'}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button 
                disabled={analyzeLoading || !fileRef || !csvColumns.length} 
                onClick={handleAnalyze} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {analyzeLoading ? "Analyzing..." : "Run Analysis"}
              </Button>
              <Button variant="outline" onClick={fetchLatestOnChain}>Latest On-Chain</Button>
            </div>

            {/* Error & Success Messages */}
            {analyzeError && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                <p className="text-red-500 text-sm">{analyzeError}</p>
              </div>
            )}
            {forecastPayload?.forecast?.blockchain_status && (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-sm">
                <p className="ivy-font font-medium text-emerald-600 dark:text-emerald-400">Blockchain Status: {forecastPayload.forecast.blockchain_status}</p>
                {forecastPayload.forecast.transaction_hash && (
                  <p className="break-all text-xs text-muted-foreground">Tx: {forecastPayload.forecast.transaction_hash}</p>
                )}
              </div>
            )}
            {latestOnChain && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold ivy-font mb-2">Latest On-Chain Record</h4>
                <pre className="p-3 rounded-md bg-muted/40 text-xs max-h-40 overflow-auto">{JSON.stringify(latestOnChain, null, 2)}</pre>
              </div>
            )}

            {/* Metrics Cards */}
            {forecastPayload?.forecast?.metrics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-border">
                <StatCard title="MAE" value={forecastPayload.forecast.metrics.mae.toFixed(2)} change="" icon={TrendingUp} trend="up" />
                <StatCard title="Avg Daily Sales" value={forecastPayload.forecast.metrics.daily_avg_sales.toFixed(2)} change="" icon={DollarSign} trend="up" />
                <StatCard title="Error %" value={forecastPayload.forecast.metrics.error_percentage.toFixed(2)+"%"} change="" icon={Activity} trend="up" />
                <StatCard title="28d Forecast Total" value={forecastPayload.forecast.metrics.total_predicted_sales_28d.toFixed(2)} change="" icon={Target} trend="up" />
              </div>
            )}
            {/* Dynamic Forecast Line Chart */}
            {dynamicForecastSeries.length > 0 && (
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dynamicForecastSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="ds" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{ fontSize: 12 }} />
                    <YAxis stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="actual" stroke="var(--chart-2)" dot={false} name="Actual" />
                    <Line type="monotone" dataKey="forecast" stroke="var(--chart-1)" strokeDasharray="5 5" dot={false} name="Forecast" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Dynamic Segmentation Scatter Chart */}
            {Object.keys(segmentationGroups).length > 0 && (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold ivy-font mb-2">Student Segmentation Clusters</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis type="number" dataKey="Recency" name="Recency" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{ fontSize: 12 }} />
                      <YAxis type="number" dataKey="Monetary" name="Monetary" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '8px' }} />
                      <Legend />
                      {Object.entries(segmentationGroups).map(([seg, rows], idx) => (
                        <Scatter key={seg} name={seg} data={rows} fill={segmentColorPalette[idx % segmentColorPalette.length]} />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                {/* Lead Qualification & Strategies - AI-Generated Recommendations */}
                <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                  <CardHeader>
                    <CardTitle className="ivy-font">AI-Powered Student Segment Strategies</CardTitle>
                    <CardDescription className="ivy-font">Dynamic recommendations generated by AI for each student segment with targeted follow-up insights</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(segmentationGroups).map(([segName, customers], idx) => {
                      // Find AI-generated recommendation for this segment from backend
                      const aiRec = forecastPayload?.segmentation?.recommendations?.find(
                        r => r.Segment === segName
                      );

                      // Map segment names to lead qualification levels for visual styling
                      const getRiskData = (name) => {
                        const nameLower = name.toLowerCase();
                        if (nameLower.includes('hot')) {
                          return { 
                            risk: 'Hot Lead', 
                            color: 'text-emerald-600', 
                            bgColor: 'bg-emerald-500/10 border-emerald-500/30',
                          };
                        } else if (nameLower.includes('warm')) {
                          return { 
                            risk: 'Warm Lead', 
                            color: 'text-amber-600', 
                            bgColor: 'bg-amber-500/10 border-amber-500/30',
                          };
                        } else if (nameLower.includes('cold')) {
                          return { 
                            risk: 'Cold Lead', 
                            color: 'text-red-600', 
                            bgColor: 'bg-red-500/10 border-red-500/30',
                          };
                        } else {
                          return { 
                            risk: 'Unscored', 
                            color: 'text-blue-600', 
                            bgColor: 'bg-blue-500/10 border-blue-500/30',
                          };
                        }
                      };

                      // Extract product/category data if available in customer data
                      const getProductInsights = (customerList) => {
                        // Check if Category column exists in data
                        const categories = customerList
                          .map(c => c.Category)
                          .filter(Boolean);
                        
                        if (categories.length === 0) return null;

                        // Count category frequencies
                        const categoryCounts = categories.reduce((acc, cat) => {
                          acc[cat] = (acc[cat] || 0) + 1;
                          return acc;
                        }, {});

                        const sortedCategories = Object.entries(categoryCounts)
                          .sort((a, b) => b[1] - a[1]);

                        const totalCustomers = customerList.length;
                        const topCategory = sortedCategories[0];
                        const lowCategory = sortedCategories[sortedCategories.length - 1];

                        return {
                          mostPopular: topCategory ? { name: topCategory[0], count: topCategory[1], pct: ((topCategory[1] / totalCustomers) * 100).toFixed(0) } : null,
                          leastPopular: lowCategory && sortedCategories.length > 1 ? { name: lowCategory[0], count: lowCategory[1], pct: ((lowCategory[1] / totalCustomers) * 100).toFixed(0) } : null
                        };
                      };

                      const riskData = getRiskData(segName);
                      const productInsights = getProductInsights(customers);
                      
                      return (
                        <div key={segName} className={`p-4 rounded-lg border ${riskData.bgColor}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: segmentColorPalette[idx % segmentColorPalette.length] }} />
                              <h4 className="font-semibold text-lg ivy-font text-foreground">{segName}</h4>
                            </div>
                            <Badge className={`${riskData.color} bg-transparent border-0 text-xs font-bold`}>
                              {riskData.risk}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <p className="ivy-font text-foreground">
                              <span className="font-semibold">Student Count:</span> {customers.length} students in this segment
                            </p>
                            
                            {aiRec && (
                              <>
                                <p className="ivy-font text-foreground">
                                  <span className="font-semibold">Top Category:</span> <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{aiRec['Top Category']}</span>
                                </p>
                                
                                <p className="ivy-font text-foreground bg-background/50 p-2 rounded border border-border/30">
                                  <span className="font-semibold">🤖 AI Strategy:</span> {aiRec['AI Recommendation']}
                                </p>
                              </>
                            )}

                            {productInsights && productInsights.mostPopular && (
                              <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
                                <p className="ivy-font text-foreground flex items-center gap-2">
                                  <span className="font-semibold">🔥 Top Interest Area:</span>
                                  <span className="px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                                    {productInsights.mostPopular.name}
                                  </span>
                                  <span className="text-muted-foreground">
                                    ({productInsights.mostPopular.count} students, {productInsights.mostPopular.pct}%)
                                  </span>
                                </p>
                                <p className="text-xs ivy-font text-muted-foreground ml-6">
                                  → Promote related programs and scholarships to this segment
                                </p>

                                {productInsights.leastPopular && (
                                  <>
                                    <p className="ivy-font text-foreground flex items-center gap-2 pt-1">
                                      <span className="font-semibold">💡 Low Interest Area (Target for Outreach):</span>
                                      <span className="px-2 py-0.5 rounded bg-amber-600/20 text-amber-600 dark:text-amber-400 font-semibold">
                                        {productInsights.leastPopular.name}
                                      </span>
                                      <span className="text-muted-foreground">
                                        ({productInsights.leastPopular.count} students, {productInsights.leastPopular.pct}%)
                                      </span>
                                    </p>
                                    <p className="text-xs ivy-font text-muted-foreground ml-6">
                                      → Share success stories and webinar invites to boost engagement
                                    </p>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Campaign Generation Button */}
                            {aiRec && (
                              <div className="mt-4 pt-3 border-t border-border/30">
                                <Button
                                  onClick={() => {
                                    let campaignBrief = `Create a targeted follow-up campaign for ${segName} student segment. Focus on ${aiRec['Top Category']} programs. Strategy: ${aiRec['AI Recommendation']} Target audience: ${customers.length} students in this ${riskData.risk.toLowerCase()} segment.`;
                                    // Sanitize: collapse whitespace & remove line breaks before encoding
                                    campaignBrief = campaignBrief.replace(/\s+/g,' ').trim();
                                    router.push(`/campaign?brief=${encodeURIComponent(campaignBrief)}`);
                                  }}
                                  className="w-full bg-linear-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all"
                                  size="sm"
                                >
                                  <Rocket className="w-4 h-4 mr-2" />
                                  Generate Follow-up for {segName}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Saved Campaign Workflows ─────────────────────────────── */}
        <Card className="border-border/40 backdrop-blur-sm bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-emerald-500" />
              <CardTitle className="text-lg font-semibold ivy-font">
                Saved Campaign Workflows
              </CardTitle>
              {savedWorkflows.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{savedWorkflows.length}</Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/campaign')}
              className="text-xs gap-1"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              New Workflow
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingWorkflows ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Loading workflows…
              </div>
            ) : savedWorkflows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Workflow className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No saved workflows yet</p>
                <p className="text-xs mt-1 opacity-70">Create a campaign workflow and save it to see it here.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => router.push('/campaign')}
                >
                  <FolderOpen className="w-4 h-4" />
                  Create Workflow
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedWorkflows.map((wf, i) => (
                  <div
                    key={wf.id ? String(wf.id) : wf._id ? String(wf._id) : `wf-${i}`}
                    className="rounded-xl border border-border/60 p-4 flex flex-col gap-3 transition-shadow hover:shadow-md hover:border-emerald-500/50 bg-muted/30"
                  >
                    {/* Brief */}
                    <p className="text-sm font-medium leading-snug line-clamp-3 flex-1 text-foreground">
                      {wf.brief || "Untitled workflow"}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {wf.createdAt
                          ? new Date(wf.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                        {wf.nodesCount ?? wf.nodes?.length ?? 0} nodes
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        onClick={() => handleLoadWorkflow(wf)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open in Canvas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 flex items-center justify-center border-red-500/40 text-red-500 hover:bg-red-500/10"
                        disabled={deletingId === String(wf.id || wf._id)}
                        onClick={() => handleDeleteWorkflow(String(wf.id || wf._id))}
                        title="Delete workflow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
