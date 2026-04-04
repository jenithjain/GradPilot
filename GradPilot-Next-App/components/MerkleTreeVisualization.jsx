'use client';

import { useCallback, useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Copy, CheckCircle2, AlertCircle } from 'lucide-react';

// Custom Node Component for Merkle Tree
const MerkleNode = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const [showFullHash, setShowFullHash] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(data.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getNodeStyle = () => {
    let baseStyle = 'rounded-lg p-3 border-2 transition-all duration-300 cursor-pointer min-w-[180px]';
    
    if (data.isSelected) {
      return `${baseStyle} bg-yellow-500 border-yellow-600 shadow-lg shadow-yellow-500/50 scale-105`;
    }
    
    if (data.isInProofPath) {
      return `${baseStyle} bg-red-500 border-red-600 shadow-lg shadow-red-500/50 animate-pulse`;
    }
    
    switch (data.type) {
      case 'leaf':
        return `${baseStyle} bg-emerald-600 border-emerald-700 hover:bg-emerald-500 hover:scale-105`;
      case 'root':
        return `${baseStyle} bg-emerald-700 border-emerald-800 shadow-lg shadow-emerald-500/30`;
      default:
        return `${baseStyle} bg-teal-600 border-teal-700 hover:bg-teal-500`;
    }
  };

  return (
    <div 
      className={getNodeStyle()}
      onClick={() => data.onClick?.(data)}
      onMouseEnter={() => setShowFullHash(true)}
      onMouseLeave={() => setShowFullHash(false)}
    >
      <div className="text-white text-center">
        {/* Node Type Label */}
        <div className="text-xs font-bold uppercase tracking-wide mb-2 opacity-90">
          {data.type === 'leaf' ? `Day ${data.day}` : data.type === 'root' ? 'Merkle Root' : `Level ${data.level}`}
        </div>
        
        {/* Leaf Node: Show Prediction Value */}
        {data.type === 'leaf' && data.prediction && (
          <div className="mb-2">
            <div className="text-sm opacity-75">{data.prediction.date}</div>
            <div className="text-lg font-bold">${data.prediction.predicted.toFixed(2)}</div>
          </div>
        )}
        
        {/* Hash Display */}
        <div className="relative">
          <code className="text-xs break-all block bg-black/20 rounded px-2 py-1">
            {showFullHash ? data.hash : `${data.hash.slice(0, 16)}...`}
          </code>
          
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="absolute -top-1 -right-1 bg-black/50 hover:bg-black/70 rounded p-1 transition-all"
            title="Copy hash"
          >
            {copied ? (
              <CheckCircle2 className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-white" />
            )}
          </button>
        </div>

        {/* Node Index */}
        <div className="text-xs opacity-60 mt-1">
          Index: {data.index}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  merkleNode: MerkleNode,
};

export default function MerkleTreeVisualization({ 
  treeData, 
  transactionHash, 
  dailyPredictions 
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedLeaf, setSelectedLeaf] = useState(null);
  const [proofPath, setProofPath] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  // Helper: collect leaves (day, hash) from treeData
  const collectLeaves = () => {
    if (!treeData?.levels || !Array.isArray(treeData.levels)) return [];
    // Leaves are assumed to be the first (bottom) level (index 0)
    // But support scanning all levels for nodes of type 'leaf'
    const leaves = [];
    treeData.levels.forEach((level) => {
      level.forEach((node) => {
        if (node.type === 'leaf' || node.level === 0) {
          leaves.push({ day: (node.index || 0) + 1, hash: node.hash });
        }
      });
    });
    // Deduplicate by day
    const uniq = [];
    const seen = new Set();
    for (const l of leaves) {
      if (!seen.has(l.day)) {
        uniq.push(l);
        seen.add(l.day);
      }
    }
    return uniq.sort((a,b)=>a.day-b.day);
  };

  // Export JSON: 'all' or 'selected'
  const handleExportJSON = (mode = 'all') => {
    try {
      const leaves = collectLeaves();
      let payload;
      if (mode === 'selected') {
        if (selectedLeaf === null) return alert('Select a day first');
        const found = leaves.find(l => l.day === selectedLeaf + 1);
        if (!found) return alert('Selected day not found in Merkle tree');
        payload = { transaction: transactionHash, day: found.day, hash: found.hash };
      } else {
        payload = { transaction: transactionHash, leaves };
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = mode === 'selected' ? `${transactionHash}_day_${selectedLeaf+1}.json` : `${transactionHash}_merkle_leaves.json`;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export JSON failed', err);
      alert('Failed to export JSON');
    }
  };

  // Export PDF: simple list layout
  const handleExportPDF = (mode = 'all') => {
    try {
      const leaves = collectLeaves();
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text(`Merkle Tree Export`, 40, 50);
      doc.setFontSize(10);
      doc.text(`Transaction: ${transactionHash}`, 40, 70);
      let y = 100;

      if (mode === 'selected') {
        if (selectedLeaf === null) return alert('Select a day first');
        const found = leaves.find(l => l.day === selectedLeaf + 1);
        if (!found) return alert('Selected day not found in Merkle tree');
        doc.setFontSize(12);
        doc.text(`Day: ${found.day}`, 40, y);
        y += 20;
        doc.setFontSize(9);
        // wrap hash if long
        doc.text(found.hash, 40, y, { maxWidth: 520 });
      } else {
        doc.setFontSize(11);
        doc.text(`Leaves (${leaves.length})`, 40, y);
        y += 18;
        doc.setFontSize(9);
        leaves.forEach((l, idx) => {
          if (y > 750) { doc.addPage(); y = 40; }
          doc.text(`Day ${l.day}:`, 40, y);
          doc.text(l.hash, 110, y, { maxWidth: 460 });
          y += 16;
        });
      }

      const filename = mode === 'selected' ? `${transactionHash}_day_${selectedLeaf+1}.pdf` : `${transactionHash}_merkle_leaves.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Export PDF failed', err);
      alert('Failed to export PDF');
    }
  };

  // Fetch Merkle Proof from API
  const fetchProof = async (leafIndex) => {
    setVerifying(true);
    setError(null);
    const day = leafIndex + 1;

    try {
      const response = await fetch(
        `https://lamaq-gradpilot.hf.space/merkle-proof/${transactionHash}/${day}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch proof');
      }

      const proof = await response.json();
      setProofPath(proof.proof);
      return proof.proof;
    } catch (err) {
      console.error('Failed to fetch proof:', err);
      setError('Failed to fetch verification proof. Please try again.');
      return null;
    } finally {
      setVerifying(false);
    }
  };

  // Check if a node's hash is in the current proof path
  const isNodeInProofPath = useCallback((nodeHash) => {
    if (!proofPath) return false;
    return proofPath.some(step => step.hash === nodeHash);
  }, [proofPath]);

  // Generate React Flow nodes and edges from hierarchical structure
  const generateFlowElements = useCallback(() => {
    if (!treeData?.levels) return { nodes: [], edges: [] };

    const flowNodes = [];
    const flowEdges = [];
    const levelHeight = 150; // Vertical spacing between levels
    const horizontalSpacing = 220; // Horizontal spacing between nodes

    // Process levels from bottom (leaves) to top (root)
    treeData.levels.forEach((level, levelIdx) => {
      const nodesInLevel = level.length;
      const levelWidth = nodesInLevel * horizontalSpacing;
      const startX = -levelWidth / 2;

      level.forEach((node, nodeIdx) => {
        const nodeId = `${node.level}-${node.index}`;
        
        // Find prediction data for leaf nodes
        const prediction = node.type === 'leaf' && dailyPredictions 
          ? dailyPredictions.find(p => p.day === node.index + 1)
          : null;

        // Create React Flow node
        flowNodes.push({
          id: nodeId,
          type: 'merkleNode',
          position: { 
            x: startX + (nodeIdx * horizontalSpacing),
            y: levelIdx * levelHeight
          },
          data: {
            hash: node.hash,
            level: node.level,
            index: node.index,
            type: node.type,
            day: node.index + 1,
            prediction,
            isSelected: node.type === 'leaf' && selectedLeaf === node.index,
            isInProofPath: isNodeInProofPath(node.hash),
            onClick: node.type === 'leaf' ? handleLeafClick : undefined,
          },
          sourcePosition: Position.Top,
          targetPosition: Position.Bottom,
        });

        // Create edges to children (if they exist)
        if (node.left_child) {
          const leftChildId = `${node.level - 1}-${nodeIdx * 2}`;
          flowEdges.push({
            id: `${nodeId}-left`,
            source: leftChildId,
            target: nodeId,
            type: 'smoothstep',
            animated: isNodeInProofPath(node.left_child),
            style: { 
              stroke: isNodeInProofPath(node.left_child) ? '#ef4444' : '#64748b',
              strokeWidth: isNodeInProofPath(node.left_child) ? 3 : 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isNodeInProofPath(node.left_child) ? '#ef4444' : '#64748b',
            },
          });
        }

        if (node.right_child) {
          const rightChildId = `${node.level - 1}-${nodeIdx * 2 + 1}`;
          flowEdges.push({
            id: `${nodeId}-right`,
            source: rightChildId,
            target: nodeId,
            type: 'smoothstep',
            animated: isNodeInProofPath(node.right_child),
            style: { 
              stroke: isNodeInProofPath(node.right_child) ? '#ef4444' : '#64748b',
              strokeWidth: isNodeInProofPath(node.right_child) ? 3 : 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isNodeInProofPath(node.right_child) ? '#ef4444' : '#64748b',
            },
          });
        }
      });
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [treeData, dailyPredictions, selectedLeaf, proofPath, isNodeInProofPath]);

  // Handle leaf node click
  const handleLeafClick = async (nodeData) => {
    const leafIndex = nodeData.index;
    setSelectedLeaf(leafIndex);
    await fetchProof(leafIndex);
  };

  // Update flow elements when dependencies change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = generateFlowElements();
    setNodes(newNodes);
    setEdges(newEdges);
  }, [generateFlowElements, setNodes, setEdges]);

  // Guard: treeData should be the hierarchicalStructure object with levels
  if (!treeData?.levels) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <AlertCircle className="w-6 h-6 mr-2" />
        <span>No Merkle Tree data available</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="p-4 bg-slate-800/50 border-b border-slate-700">
        <h3 className="text-lg font-bold text-white mb-1">🌲 Merkle Tree Structure</h3>
        <p className="text-sm text-slate-400">
          {treeData.total_leaves} Leaves • {treeData.total_levels} Levels
          {verifying && <span className="ml-3 text-yellow-400">⏳ Fetching proof...</span>}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white"
            onClick={() => handleExportJSON('all')}
          >
            Export JSON (All)
          </button>

          <button
            className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white"
            onClick={() => handleExportPDF('all')}
          >
            Export PDF (All)
          </button>

          <button
            className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-white"
            onClick={() => handleExportJSON('selected')}
            disabled={selectedLeaf === null}
            title={selectedLeaf === null ? 'Select a day leaf to export single day' : 'Export selected day as JSON'}
          >
            Export JSON (Day)
          </button>

          <button
            className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-white"
            onClick={() => handleExportPDF('selected')}
            disabled={selectedLeaf === null}
            title={selectedLeaf === null ? 'Select a day leaf to export single day' : 'Export selected day as PDF'}
          >
            Export PDF (Day)
          </button>
        </div>
      </div>

      {/* React Flow Container */}
      <div className="flex-1 bg-slate-900" style={{ minHeight: '500px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
          minZoom={0.1}
          maxZoom={1.5}
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: '#64748b' },
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#475569" gap={16} />
          <Controls className="bg-slate-800 border-slate-700" />
          <MiniMap 
            className="bg-slate-800 border-slate-700"
            nodeColor={(node) => {
              if (node.data.isSelected) return '#eab308';
              if (node.data.isInProofPath) return '#ef4444';
              switch (node.data.type) {
                case 'leaf': return '#10b981';
                case 'root': return '#059669';
                default: return '#14b8a6';
              }
            }}
          />
        </ReactFlow>
      </div>

      {/* Verification Display */}
      {selectedLeaf !== null && proofPath && !error && (
        <div className="p-4 bg-emerald-900/30 border-t border-emerald-700">
          <h4 className="text-lg font-bold text-emerald-400 mb-2 flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Verification Path for Day {selectedLeaf + 1}
          </h4>
          <div className="text-sm text-gray-300 mb-3">
            <strong>Selected:</strong> $
            {dailyPredictions[selectedLeaf]?.predicted.toFixed(2)} on{' '}
            {dailyPredictions[selectedLeaf]?.date}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {proofPath.map((step, idx) => (
              <div key={idx} className="text-xs text-slate-400 bg-black/20 rounded px-3 py-2">
                <span className="font-semibold text-emerald-400">Step {idx + 1}:</span> Combine with{' '}
                <span className="font-mono text-yellow-400">{step.position}</span> sibling:{' '}
                <code className="text-slate-300">{step.hash.slice(0, 20)}...</code>
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-400 mt-3 font-semibold">
            ✅ Final hash matches Merkle Root - Data is authentic!
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/30 border-t border-red-700">
          <div className="flex items-center text-red-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
