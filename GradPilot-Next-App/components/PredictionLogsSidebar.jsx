'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  DollarSign, 
  Copy, 
  CheckCircle2,
  Database,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import MerkleTreeVisualization from './MerkleTreeVisualization';
import Link from 'next/link';

export default function PredictionLogsSidebar() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);

  // Fetch predictions from API
  const fetchPredictions = async () => {
    if (!session?.user?.email) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/predictions?limit=20`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch predictions');
      }

      const data = await response.json();
      setPredictions(data.predictions || []);
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setError('Failed to load prediction logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, [session]);

  // Copy to clipboard with visual feedback
  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(type);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Toggle prediction card expansion
  const toggleExpand = (predictionId) => {
    setExpandedId(expandedId === predictionId ? null : predictionId);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Sidebar Container */}
      <div 
        className={`fixed top-0 left-0 h-screen bg-slate-900 border-r border-slate-700/50 transition-all duration-300 z-60 flex flex-col ${
          isOpen ? 'w-[450px]' : 'w-0'
        } overflow-hidden`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white flex items-center">
              <Database className="w-5 h-5 mr-2 text-emerald-400" />
              Blockchain Logs
            </h2>
            <button
              onClick={() => fetchPredictions()}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-slate-400">
            {predictions.length} session{predictions.length !== 1 ? 's' : ''} logged
          </p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400 flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!loading && !error && predictions.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No session logs yet</p>
              <p className="text-sm mt-1">Upload a CSV to create your first counselling session</p>
            </div>
          )}

          {!loading && !error && predictions.map((prediction) => (
            <PredictionCard
              key={prediction.predictionId}
              prediction={prediction}
              isExpanded={expandedId === prediction.predictionId}
              onToggle={() => toggleExpand(prediction.predictionId)}
              onCopy={handleCopy}
              copiedHash={copiedHash}
            />
          ))}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-20 ${
          isOpen ? 'left-[450px]' : 'left-0'
        } z-30 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-r-lg transition-all duration-300 shadow-lg`}
        title={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>
    </>
  );
}

// Individual Prediction Card Component
function PredictionCard({ prediction, isExpanded, onToggle, onCopy, copiedHash }) {
  const { forecast, blockchain, merkleTree, createdAt } = prediction;

  return (
    <div 
      className={`rounded-lg border transition-all duration-300 ${
        isExpanded 
          ? 'bg-slate-800 border-emerald-500 shadow-lg shadow-emerald-500/20' 
          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
      }`}
    >
      {/* Card Header (Always Visible) */}
      <div className="p-4">
        {/* Top Row: Date & Total */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center text-slate-400">
            <Calendar className="w-4 h-4 mr-2" />
            <span className="text-sm">
              {new Date(createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
          <div className="flex items-center text-green-400 font-bold">
            <DollarSign className="w-4 h-4" />
            <span>{forecast.totalPredicted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Transaction Hash */}
        <div className="mb-2">
          <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
            Transaction Hash
          </label>
          <div className="flex items-center bg-black/30 rounded px-3 py-2 group">
            <code className="text-xs text-slate-300 flex-1 truncate">
              {blockchain.transactionHash}
            </code>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(blockchain.transactionHash, `tx-${prediction.predictionId}`);
              }}
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              {copiedHash === `tx-${prediction.predictionId}` ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400 hover:text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Merkle Root */}
        <div className="mb-3">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
            Merkle Root
          </div>
          <div className="flex items-center bg-black/30 rounded px-3 py-2 group">
            <code className="text-xs text-emerald-400 flex-1 truncate">
              {merkleTree.root}
            </code>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(merkleTree.root, `root-${prediction.predictionId}`);
              }}
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              {copiedHash === `root-${prediction.predictionId}` ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400 hover:text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Dataset Name */}
        <div className="text-xs text-slate-500 mb-3">
          <span className="font-semibold">Dataset:</span> {blockchain.domain}
        </div>

        {/* Metrics */}
        {forecast.metrics && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {forecast.metrics.errorPercentage !== undefined && (
              <div className="bg-black/20 rounded px-3 py-2">
                <div className="text-xs text-slate-500">Accuracy</div>
                <div className="text-sm font-bold text-emerald-400">
                  {(100 - forecast.metrics.errorPercentage).toFixed(2)}%
                </div>
              </div>
            )}
            {forecast.metrics.mae !== undefined && (
              <div className="bg-black/20 rounded px-3 py-2">
                <div className="text-xs text-slate-500">MAE</div>
                <div className="text-sm font-bold text-teal-400">
                  {forecast.metrics.mae.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expand Button */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onToggle}
            className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center text-white text-sm font-semibold"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Expand
              </>
            )}
          </button>
          <Link
            href={`/merkle/${prediction.predictionId}`}
            className="py-2 px-4 bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors flex items-center justify-center text-white text-sm font-semibold text-center"
          >
            Full View
          </Link>
        </div>
      </div>

      {/* Expanded Content: Merkle Tree */}
      {isExpanded && (
        <div className="border-t border-slate-700" style={{ height: '600px' }}>
          <MerkleTreeVisualization
            treeData={merkleTree.hierarchicalStructure}
            transactionHash={blockchain.transactionHash}
            dailyPredictions={forecast.dailyPredictions}
          />
        </div>
      )}
    </div>
  );
}
