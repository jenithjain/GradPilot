'use client';

import { useEffect, useState, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import MerkleTreeVisualization from '@/components/MerkleTreeVisualization';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

export default function MerkleFullView({ params }) {
  const { predictionId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);

  const fetchPrediction = async () => {
    if (!session?.user?.email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/prediction/${predictionId}`);
      if (!res.ok) throw new Error('Failed to fetch prediction');
      const data = await res.json();
      setPrediction(data.prediction);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, [session, predictionId]);

  if (!session) {
    return (
      <div className="p-8 text-center text-slate-300">Sign in required.</div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </button>
          <h1 className="text-lg font-semibold text-white">Merkle Tree Full View</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPrediction}
            className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >Dashboard</Link>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading prediction...
        </div>
      )}

      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center text-red-400">
          <AlertCircle className="w-10 h-10 mb-3" />
          <p>{error}</p>
        </div>
      )}

      {!loading && prediction && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Meta Summary */}
          <div className="p-4 grid md:grid-cols-4 sm:grid-cols-2 gap-4 border-b border-slate-800 bg-slate-900">
            <SummaryItem label="Prediction ID" value={prediction.predictionId} copy />
            <SummaryItem label="Transaction Hash" value={prediction.blockchain.transactionHash} copy />
            <SummaryItem label="Merkle Root" value={prediction.merkleTree.root} copy highlight />
            <SummaryItem label="Dataset" value={prediction.blockchain.domain} />
          </div>
          {/* Tree Visualization */}
          <div className="flex-1 min-h-0">
            <MerkleTreeVisualization
              key={prediction.predictionId}
              treeData={prediction.merkleTree.hierarchicalStructure}
              transactionHash={prediction.blockchain.transactionHash}
              dailyPredictions={prediction.forecast.dailyPredictions}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value, copy=false, highlight=false }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className={`rounded-lg p-3 bg-slate-800 border ${highlight ? 'border-emerald-600' : 'border-slate-700'} text-xs`}> 
      <div className="uppercase tracking-wide text-slate-400 mb-1 font-semibold">{label}</div>
      <div className="font-mono text-slate-200 break-all text-[10px] leading-relaxed">
        {value}
      </div>
      {copy && (
        <button
          onClick={handleCopy}
          className="mt-1 inline-block px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-white"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
}
