# Frontend Integration Guide: Merkle Tree Visualization

## 📋 System Prompt for Frontend Developer

**You are building a Prediction Logs Dashboard** with interactive Merkle Tree visualization for a sales forecasting CRM platform. The backend provides complete prediction history with blockchain audit trails stored in MongoDB. Your goal is to create a sidebar component that displays prediction logs with collapsible, interactive Merkle Trees.

---

## 🎯 User Experience Flow

1. **User uploads CSV** → Calls `POST /analyze` with `user_email` parameter
2. **Backend processes** → Generates forecast, creates Merkle Tree, logs to blockchain, saves to MongoDB
3. **Frontend displays sidebar** → Shows list of previous predictions (collapsed by default)
4. **User clicks log** → Expands to reveal interactive Merkle Tree visualization
5. **User clicks leaf node** → Frontend fetches cryptographic proof and highlights verification path

---

## 🗂️ Data Structure Overview

### MongoDB Schema (User Document)

```typescript
interface User {
  email: string;
  name: string;
  predictionLogs: PredictionLog[];
}

interface PredictionLog {
  predictionId: string;  // UUID
  createdAt: string;     // ISO 8601 date
  
  forecast: {
    totalPredicted: number;
    dailyPredictions: Array<{
      day: number;
      date: string;
      predicted: number;
    }>;
    metrics: {
      mae: number;
      errorPercentage: number;
    };
  };
  
  blockchain: {
    transactionHash: string;  // Display in sidebar header
    timestamp: number;         // Unix timestamp
    domain: string;            // Original CSV filename
  };
  
  merkleTree: {
    root: string;  // Display in sidebar (collapsed state)
    leaves: Array<{
      index: number;
      hash: string;
      data: string;  // Format: "Day X|YYYY-MM-DD|$$$.$$"
    }>;
    hierarchicalStructure: {  // ✅ USE THIS FOR TREE VISUALIZATION
      root: string;
      total_levels: number;
      total_leaves: number;
      levels: Array<Array<TreeNode>>;  // Array of levels, each level is array of nodes
    };
  };
}

interface TreeNode {
  hash: string;
  level: number;
  index: number;
  type: 'leaf' | 'intermediate' | 'root';
  data?: string;           // Only for leaf nodes
  left_child?: string;     // Hash of left child (for intermediate/root)
  right_child?: string;    // Hash of right child (for intermediate/root)
}
```

---

## 📡 API Endpoints for Frontend

### 1. Create New Prediction

```typescript
POST /analyze

// FormData payload
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('user_email', currentUser.email);  // ✅ REQUIRED

// Response includes prediction_id for immediate display
{
  forecast: {
    prediction_id: "uuid-here",
    transaction_hash: "0x...",
    merkle_root: "0x...",
    saved_to_db: true
  }
}
```

### 2. Fetch All User Predictions (For Sidebar)

```typescript
GET /user/predictions/{email}?limit=20

// Response
{
  user_email: "user@example.com",
  total_predictions: 5,
  predictions: PredictionLog[]  // See schema above
}
```

### 3. Get Merkle Proof (For Verification UI)

```typescript
GET /merkle-proof/{transaction_hash}/{day}

// day is 1-28 (the day number user clicked)

// Response
{
  transaction_hash: "0x...",
  day: 5,
  data: "Day 5|2025-11-28|1395.45",
  data_hash: "abc123...",
  proof: [
    { hash: "sibling_hash", position: "left" | "right" },
    // ... more proof steps
  ],
  merkle_root: "0x...",
  instructions: "Verification steps..."
}
```

---

## 🎨 Component Architecture

### Recommended Structure

```
<Dashboard>
  └── <PredictionLogsSidebar>
        ├── <PredictionLogCard> (collapsed)
        │     ├── Date + Total Revenue
        │     ├── Transaction Hash (copyable)
        │     ├── Merkle Root (copyable)
        │     └── Expand Button
        └── <PredictionLogCard> (expanded)
              ├── Collapsed header (same as above)
              └── <MerkleTreeVisualization>
                    ├── Tree Canvas/SVG
                    ├── Leaf Node Click → Fetch Proof
                    └── Proof Path Highlight Animation
```

---

## 💻 Implementation Examples

### 1. Fetch and Display Predictions (React)

```tsx
import React, { useState, useEffect } from 'react';

interface Prediction {
  predictionId: string;
  createdAt: string;
  forecast: {
    totalPredicted: number;
    dailyPredictions: Array<{ day: number; date: string; predicted: number }>;
  };
  blockchain: {
    transactionHash: string;
    timestamp: number;
    domain: string;
  };
  merkleTree: {
    root: string;
    hierarchicalStructure: {
      root: string;
      total_levels: number;
      total_leaves: number;
      levels: Array<Array<any>>;
    };
  };
}

const PredictionLogsSidebar = ({ userEmail }: { userEmail: string }) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://lamaq-gradpilot.hf.space/user/predictions/${userEmail}?limit=20`)
      .then(res => res.json())
      .then(data => {
        setPredictions(data.predictions);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch predictions:', err);
        setLoading(false);
      });
  }, [userEmail]);

  if (loading) return <div>Loading predictions...</div>;

  return (
    <div className="predictions-sidebar">
      <h2>📊 Prediction History</h2>
      {predictions.map(pred => (
        <PredictionCard
          key={pred.predictionId}
          prediction={pred}
          isExpanded={expandedId === pred.predictionId}
          onToggle={() => setExpandedId(
            expandedId === pred.predictionId ? null : pred.predictionId
          )}
        />
      ))}
    </div>
  );
};
```

### 2. Prediction Card Component

```tsx
const PredictionCard = ({ 
  prediction, 
  isExpanded, 
  onToggle 
}: { 
  prediction: Prediction;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={`prediction-card ${isExpanded ? 'expanded' : ''}`}>
      {/* Collapsed Header (Always Visible) */}
      <div className="card-header" onClick={onToggle}>
        <div className="header-row">
          <span className="date">
            {new Date(prediction.createdAt).toLocaleDateString()}
          </span>
          <span className="total">
            ${prediction.forecast.totalPredicted.toLocaleString()}
          </span>
        </div>
        
        <div className="header-details">
          <div className="detail-field">
            <label>TX Hash</label>
            <code onClick={(e) => { e.stopPropagation(); copyToClipboard(prediction.blockchain.transactionHash); }}>
              {prediction.blockchain.transactionHash.slice(0, 20)}...
              <button className="copy-btn">📋</button>
            </code>
          </div>
          
          <div className="detail-field">
            <label>Merkle Root</label>
            <code onClick={(e) => { e.stopPropagation(); copyToClipboard(prediction.merkleTree.root); }}>
              {prediction.merkleTree.root.slice(0, 20)}...
              <button className="copy-btn">📋</button>
            </code>
          </div>
          
          <div className="detail-field">
            <label>Dataset</label>
            <span>{prediction.blockchain.domain}</span>
          </div>
        </div>
        
        <button className="expand-btn">
          {isExpanded ? '▲ Collapse Tree' : '▼ Expand Tree'}
        </button>
      </div>

      {/* Expanded Content: Merkle Tree */}
      {isExpanded && (
        <MerkleTreeVisualization 
          treeData={prediction.merkleTree.hierarchicalStructure}
          transactionHash={prediction.blockchain.transactionHash}
          dailyPredictions={prediction.forecast.dailyPredictions}
        />
      )}
    </div>
  );
};
```

### 3. Merkle Tree Visualization Component

```tsx
const MerkleTreeVisualization = ({ 
  treeData, 
  transactionHash,
  dailyPredictions 
}: { 
  treeData: any;
  transactionHash: string;
  dailyPredictions: Array<{ day: number; date: string; predicted: number }>;
}) => {
  const [selectedLeaf, setSelectedLeaf] = useState<number | null>(null);
  const [proofPath, setProofPath] = useState<Array<{ hash: string; position: string }> | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleLeafClick = async (leafIndex: number) => {
    setVerifying(true);
    const day = leafIndex + 1;
    
    try {
      const response = await fetch(
        `https://lamaq-gradpilot.hf.space/merkle-proof/${transactionHash}/${day}`
      );
      const proof = await response.json();
      
      setSelectedLeaf(leafIndex);
      setProofPath(proof.proof);
    } catch (err) {
      console.error('Failed to fetch proof:', err);
    } finally {
      setVerifying(false);
    }
  };

  // Check if a node's hash is in the current proof path
  const isNodeInProofPath = (nodeHash: string): boolean => {
    if (!proofPath) return false;
    return proofPath.some(step => step.hash === nodeHash);
  };

  return (
    <div className="merkle-tree-visualization">
      <div className="tree-header">
        <h3>🌲 Merkle Tree Structure</h3>
        <p>{treeData.total_leaves} Leaves | {treeData.total_levels} Levels</p>
      </div>

      {/* Render tree levels (bottom to top) */}
      <div className="tree-container">
        {treeData.levels.slice().reverse().map((level, levelIdx) => (
          <div key={levelIdx} className="tree-level">
            {level.map((node, nodeIdx) => (
              <TreeNode
                key={nodeIdx}
                node={node}
                isLeaf={node.type === 'leaf'}
                isSelected={node.type === 'leaf' && selectedLeaf === node.index}
                isInProofPath={isNodeInProofPath(node.hash)}
                onClick={() => node.type === 'leaf' && handleLeafClick(node.index)}
                prediction={
                  node.type === 'leaf' 
                    ? dailyPredictions[node.index] 
                    : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>

      {/* Verification Display */}
      {selectedLeaf !== null && proofPath && (
        <div className="proof-display">
          <h4>✅ Verification Path for Day {selectedLeaf + 1}</h4>
          <p>Selected: ${dailyPredictions[selectedLeaf].predicted.toFixed(2)}</p>
          <ol>
            {proofPath.map((step, idx) => (
              <li key={idx}>
                Combine with {step.position} sibling: 
                <code>{step.hash.slice(0, 16)}...</code>
              </li>
            ))}
          </ol>
          <p className="proof-result">
            Final hash matches Merkle Root ✅
          </p>
        </div>
      )}
    </div>
  );
};

const TreeNode = ({ 
  node, 
  isLeaf, 
  isSelected, 
  isInProofPath, 
  onClick,
  prediction 
}: any) => {
  return (
    <div 
      className={`tree-node ${node.type} ${isSelected ? 'selected' : ''} ${isInProofPath ? 'proof-path' : ''}`}
      onClick={onClick}
      style={{ cursor: isLeaf ? 'pointer' : 'default' }}
    >
      {isLeaf && prediction ? (
        <div className="leaf-content">
          <div className="day">Day {prediction.day}</div>
          <div className="value">${prediction.predicted.toFixed(2)}</div>
          <div className="hash">{node.hash.slice(0, 8)}...</div>
        </div>
      ) : (
        <div className="node-content">
          <div className="hash">{node.hash.slice(0, 12)}...</div>
          <div className="level-label">L{node.level}</div>
        </div>
      )}
    </div>
  );
};
```

---

## 🎨 Styling Recommendations

```css
.predictions-sidebar {
  width: 400px;
  height: 100vh;
  overflow-y: auto;
  background: #1a1a2e;
  padding: 20px;
}

.prediction-card {
  background: #16213e;
  border-radius: 12px;
  margin-bottom: 16px;
  padding: 16px;
  transition: all 0.3s ease;
}

.prediction-card.expanded {
  background: #0f3460;
}

.card-header {
  cursor: pointer;
}

.tree-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
  padding: 20px;
  background: #0a1929;
  border-radius: 8px;
}

.tree-level {
  display: flex;
  justify-content: space-around;
  gap: 10px;
}

.tree-node {
  padding: 12px;
  border-radius: 8px;
  background: #1e3a5f;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.tree-node.leaf {
  background: #2ecc71;
  color: white;
}

.tree-node.leaf:hover {
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(46, 204, 113, 0.6);
}

.tree-node.selected {
  border-color: #f39c12;
  box-shadow: 0 0 30px rgba(243, 156, 18, 0.8);
}

.tree-node.proof-path {
  background: #e74c3c;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.proof-display {
  margin-top: 20px;
  padding: 16px;
  background: #27ae60;
  border-radius: 8px;
  color: white;
}
```

---

## 🔑 Key Implementation Notes

### 1. hierarchicalStructure Format

The `hierarchicalStructure` is an array of levels where:
- **Level 0** = Leaf nodes (bottom of tree, 28 nodes)
- **Level N** = Root node (top of tree, 1 node)

```typescript
levels: [
  // Level 0: Leaves (28 nodes)
  [
    { hash: "abc...", level: 0, index: 0, type: "leaf", data: "Day 1|2025-11-24|1391.17" },
    { hash: "def...", level: 0, index: 1, type: "leaf", data: "Day 2|2025-11-25|1392.67" },
    // ... 28 total
  ],
  // Level 1: Intermediate (14 nodes)
  [
    { hash: "ghi...", level: 1, index: 0, type: "intermediate", left_child: "abc...", right_child: "def..." },
    // ... 14 total
  ],
  // ... more levels
  // Last Level: Root (1 node)
  [
    { hash: "xyz...", level: 4, index: 0, type: "root", left_child: "...", right_child: "..." }
  ]
]
```

### 2. Rendering Strategy

**Render from bottom to top** (reverse the levels array):
```tsx
{treeData.levels.slice().reverse().map((level, idx) => (
  <div key={idx} className="tree-level">
    {/* Render nodes */}
  </div>
))}
```

### 3. Proof Path Highlighting

When user clicks a leaf:
1. Fetch proof from `/merkle-proof/{tx_hash}/{day}`
2. Extract sibling hashes from proof
3. Highlight all nodes whose hash appears in the proof
4. Animate the verification path from leaf to root

### 4. Performance Optimization

- Use virtualization for long prediction lists (e.g., `react-window`)
- Lazy load tree visualization (only render when expanded)
- Debounce API calls
- Cache fetched proofs

---

## 🚀 Getting Started Checklist

- [ ] Set up API client with base URL
- [ ] Create `PredictionLogsSidebar` component
- [ ] Implement prediction fetching on mount
- [ ] Build `PredictionCard` with collapse/expand
- [ ] Design `MerkleTreeVisualization` component
- [ ] Implement proof fetching and path highlighting
- [ ] Add copy-to-clipboard for hashes
- [ ] Style components (dark theme recommended)
- [ ] Add loading states and error handling
- [ ] Test with real data from API

---

## 🐛 Common Issues & Solutions

**Issue:** Tree looks unbalanced
- **Solution:** The tree may have duplicate nodes if prediction count isn't a power of 2. This is normal - the algorithm duplicates the last node to complete the tree.

**Issue:** Proof verification fails
- **Solution:** Ensure you're hashing in the correct order (left + right vs right + left) based on `position` field.

**Issue:** hierarchicalStructure is missing
- **Solution:** Ensure backend is running v2.0+ with the latest MongoDB service code.

**Issue:** Performance issues with many predictions
- **Solution:** Implement pagination (`?limit=20`) and virtualized scrolling.

---

## 📞 Support

- **API Base URL:** `https://lamaq-gradpilot.hf.space`
- **Backend Repo:** [GitHub](https://github.com/Lamaq-Mujpurwala/redeact-dnl-crm)
- **Documentation:** See `API_DOCUMENTATION.md`

Happy coding! 🚀
