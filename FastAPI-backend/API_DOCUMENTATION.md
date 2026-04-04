# GradPilot API Documentation

## 📌 Overview

**GradPilot** is an AI-powered student counselling and overseas education platform with blockchain-backed audit trails. Upload CSV files to receive 28-day sales forecasts, customer segmentation, and cryptographically verifiable prediction logs stored in MongoDB with Merkle Tree integrity proofs.

**Base URL:** `https://lamaq-gradpilot.hf.space`

---

## 🚀 Quick Start

```python
import requests

# Upload CSV and get predictions
url = "https://lamaq-gradpilot.hf.space/analyze"
files = {"file": open("sales_data.csv", "rb")}
data = {"user_email": "user@example.com"}  # Required for MongoDB storage

response = requests.post(url, files=files, data=data)
result = response.json()

print(f"Predicted Revenue: ${result['forecast']['metrics']['total_predicted_sales_28d']}")
print(f"Blockchain TX: {result['forecast']['transaction_hash']}")
print(f"Prediction ID: {result['forecast']['prediction_id']}")
```

---

## 📡 API Endpoints

### 1. Health Check

**`GET /`**

Check if the API is running.

**Response:**
```json
{
  "status": "GradPilot API is running"
}
```

---

### 2. Analyze Dataset (Create Prediction)

**`POST /analyze`**

Upload a CSV file to generate sales forecast, customer segmentation, blockchain proof, and Merkle Tree.

**Request:**
- **Content-Type:** `multipart/form-data`
- **Parameters:**
  - `file` (required): CSV file with historical sales data
  - `user_email` (required): User's email address (for MongoDB storage)
  - `date_col` (optional): Name of date column (auto-detected if omitted)
  - `sales_col` (optional): Name of sales/revenue column (auto-detected if omitted)
  - `id_col` (optional): Customer ID column for segmentation
  - `category_col` (optional): Product/service category column

**Example cURL:**
```bash
curl -X POST "https://lamaq-gradpilot.hf.space/analyze" \
  -F "file=@sales_data.csv" \
  -F "user_email=user@example.com"
```

**Example JavaScript:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('user_email', 'user@example.com');

const response = await fetch('https://lamaq-gradpilot.hf.space/analyze', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data.forecast.transaction_hash);
```

**Response Structure:**
```json
{
  "meta": {
    "filename": "sales_data.csv",
    "used_columns": {
      "date": "Date",
      "sales": "Revenue",
      "id": "CustomerID",
      "category": "Category"
    }
  },
  
  "forecast": {
    "status": "success",
    "metrics": {
      "mae": 45.2,
      "daily_avg_sales": 1200.50,
      "error_percentage": 3.77,
      "total_predicted_sales_28d": 35000.00
    },
    "blockchain_status": "logged",
    "transaction_hash": "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b",
    "merkle_root": "0x8492aace253919b8a9a4a327df63f...",
    "prediction_id": "5e517922-9b01-4d21-8446-a7bda812e780",
    "saved_to_db": true,
    "merkle_tree": {
      "leaves": ["hash1", "hash2", ...],
      "tree_size": 28
    },
    "history": [
      {"ds": "2023-10-01", "y": 1150.00},
      {"ds": "2023-10-02", "y": 1220.00}
    ],
    "prediction": [
      {"ds": "2023-11-01", "forecast": 1180.00},
      {"ds": "2023-11-02", "forecast": 1195.00}
    ]
  },
  
  "segmentation": {
    "status": "success",
    "stats": {
      "vip_count": 25,
      "avg_spend": 450.00,
      "active_customers": 150
    },
    "segments_summary": {
      "VIP Customers": 25,
      "Regular Customers": 100,
      "At-Risk Customers": 25
    },
    "recommendations": [
      {
        "Segment_Label": "VIP Customers",
        "Favorite_Category": "Electronics",
        "Count": 25,
        "Marketing_Strategy": "Offer exclusive early access..."
      }
    ]
  }
}
```

**Key Fields Explained:**
- `prediction_id`: Unique ID for this prediction (stored in MongoDB)
- `transaction_hash`: Blockchain receipt (immutable proof)
- `merkle_root`: Cryptographic hash of entire prediction tree
- `mae`: Mean Absolute Error (lower = more accurate)
- `error_percentage`: Forecast accuracy (< 5% is excellent)

---

### 3. Get User Predictions

**`GET /user/predictions/{user_email}`**

Retrieve all prediction logs for a specific user.

**Parameters:**
- `user_email` (path): User's email address
- `limit` (query, optional): Max number of predictions to return

**Example:**
```bash
curl "https://lamaq-gradpilot.hf.space/user/predictions/user@example.com?limit=10"
```

**Response:**
```json
{
  "user_email": "user@example.com",
  "total_predictions": 5,
  "predictions": [
    {
      "predictionId": "5e517922-9b01-4d21-8446-a7bda812e780",
      "createdAt": "2025-11-22T22:29:33.293000",
      "forecast": {
        "totalPredicted": 38952.72,
        "dailyPredictions": [
          {"day": 1, "date": "2025-11-24", "predicted": 1391.17},
          {"day": 2, "date": "2025-11-25", "predicted": 1392.67}
        ],
        "metrics": {"mae": 9.46, "errorPercentage": 0.58}
      },
      "blockchain": {
        "transactionHash": "0xfe6a52b4a210e541bb020290...",
        "timestamp": 1700755200,
        "domain": "retail_sales_dataset.csv"
      },
      "merkleTree": {
        "root": "0x8492aace253919b8a9a4a327df63...",
        "leaves": [
          {"index": 0, "hash": "abc123...", "data": "Day 1|2025-11-24|1391.17"}
        ],
        "hierarchicalStructure": {
          "root": "0x8492aace...",
          "total_levels": 5,
          "total_leaves": 28,
          "levels": [[...], [...], ...]
        }
      }
    }
  ]
}
```

---

### 4. Get Single Prediction

**`GET /user/prediction/{user_email}/{prediction_id}`**

Retrieve detailed information for a specific prediction.

**Example:**
```bash
curl "https://lamaq-gradpilot.hf.space/user/prediction/user@example.com/5e517922-9b01-4d21-8446-a7bda812e780"
```

**Response:** Same structure as single prediction object from `/user/predictions`

---

### 5. Get Merkle Tree

**`GET /user/merkle-tree/{user_email}/{transaction_hash}`**

Retrieve only the Merkle Tree data for a specific blockchain transaction.

**Example:**
```bash
curl "https://lamaq-gradpilot.hf.space/user/merkle-tree/user@example.com/0xfe6a52b4a210e541bb020290..."
```

**Response:**
```json
{
  "root": "0x8492aace253919b8a9a4a327df63...",
  "leaves": [...],
  "treeStructure": {...},
  "hierarchicalStructure": {...}
}
```

---

### 6. Get Merkle Proof (Verification)

**`GET /merkle-proof/{transaction_hash}/{day}`**

Get cryptographic proof that a specific day's prediction is part of the Merkle Tree.

**Parameters:**
- `transaction_hash`: Blockchain transaction hash
- `day`: Day number (1-28)

**Example:**
```bash
curl "https://lamaq-gradpilot.hf.space/merkle-proof/0xfe6a52b4a210e541bb020290.../5"
```

**Response:**
```json
{
  "transaction_hash": "0xfe6a52b4a210e541bb020290...",
  "day": 5,
  "data": "Day 5|2025-11-28|1395.45",
  "data_hash": "abc123...",
  "proof": [
    {"hash": "sibling_hash1", "position": "left"},
    {"hash": "sibling_hash2", "position": "right"}
  ],
  "merkle_root": "0x8492aace253919b8a9a4a327df63...",
  "instructions": "To verify: Start with data_hash, combine with each proof hash..."
}
```

---

### 7. Get User Statistics

**`GET /user/stats/{user_email}`**

Get summary statistics for a user's prediction history.

**Example:**
```bash
curl "https://lamaq-gradpilot.hf.space/user/stats/user@example.com"
```

**Response:**
```json
{
  "user_email": "user@example.com",
  "stats": {
    "total_predictions": 10,
    "total_revenue_predicted": 450000.00,
    "avg_accuracy": 96.5,
    "most_recent_prediction": "2025-11-23T10:30:00"
  }
}
```

---

### 8. Delete Prediction

**`DELETE /user/prediction/{user_email}/{prediction_id}`**

Delete a specific prediction log from the database.

**Example:**
```bash
curl -X DELETE "https://lamaq-gradpilot.hf.space/user/prediction/user@example.com/5e517922-9b01-4d21-8446-a7bda812e780"
```

**Response:**
```json
{
  "message": "Prediction deleted successfully",
  "prediction_id": "5e517922-9b01-4d21-8446-a7bda812e780"
}
```

---

### 9. Get Latest Blockchain Entry

**`GET /latest-on-chain`**

Retrieve the most recent prediction stored on the blockchain.

**Example:**
```bash
curl "https://lamaq-gradpilot.hf.space/latest-on-chain"
```

**Response:**
```json
{
  "domain": "sales_data.csv",
  "value_cents": 125000,
  "merkle_root": "0xabc123...",
  "timestamp": 1700000000
}
```

---

## 🔐 Blockchain & Merkle Trees Explained

### What is a Merkle Tree?

A **Merkle Tree** is a cryptographic data structure that allows verification of data integrity without storing all the data. In GradPilot:

1. **28 daily predictions** = 28 leaf nodes
2. Each leaf is hashed (SHA256)
3. Pairs of hashes are combined and hashed again
4. This continues until one hash remains: the **Merkle Root**
5. The root is stored on the blockchain

**Why it matters:** If anyone changes even one prediction, the Merkle Root changes completely. This proves data hasn't been tampered with.

### Verification Process

To verify a specific day's prediction:
1. Get the proof path using `/merkle-proof/{tx_hash}/{day}`
2. Hash the original data
3. Combine with sibling hashes (left/right) from proof path
4. Compare final hash to Merkle Root
5. If they match → data is authentic ✅

---

## 📊 Data Requirements

### Minimum CSV Format
```csv
Date,Sales
2024-01-01,1250.50
2024-01-02,1380.75
...
```

### Recommended Format (for full features)
```csv
Date,Revenue,CustomerID,Category
2024-01-01,1250.50,CUST-001,Electronics
2024-01-02,980.25,CUST-002,Clothing
...
```

**Requirements:**
- Minimum 60 rows (60 days of data) for accurate forecasting
- Date column in parseable format (YYYY-MM-DD recommended)
- Numeric sales/revenue column
- No missing values in date or sales columns

---

## ⚡ Rate Limits & Performance

- **Max File Size:** 200 MB
- **Processing Time:** 5-30 seconds (depends on dataset size)
- **Rate Limits:** None (demo environment)
- **Concurrent Requests:** Supported

---

## 🛠️ Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "detail": "Could not detect Date or Sales columns"
}
```
**Solution:** Specify `date_col` and `sales_col` explicitly

**404 Not Found:**
```json
{
  "detail": "Prediction not found"
}
```
**Solution:** Verify prediction_id and user_email are correct

**500 Internal Server Error:**
```json
{
  "detail": "MongoDB connection failed"
}
```
**Solution:** Contact API administrator

**503 Service Unavailable:**
```json
{
  "detail": "MongoDB service not available"
}
```
**Solution:** Retry request after a few seconds

---

## 🔧 Technical Stack

- **Backend:** FastAPI (Python 3.11)
- **Database:** MongoDB Atlas (Cloud)
- **Blockchain:** Ethereum (Ganache Testnet)
- **ML Model:** Random Forest (200 trees)
- **Cryptography:** SHA-256 for Merkle Trees
- **Deployment:** Hugging Face Spaces (Docker)

---

## 📞 Support

For issues, questions, or feature requests:
- **GitHub:** [Repository Issues](https://github.com/Lamaq-Mujpurwala/redeact-dnl-crm/issues)
- **Email:** Contact repository maintainer

---

## 📝 Changelog

**v2.0** (Current)
- ✅ MongoDB integration for persistent storage
- ✅ Hierarchical Merkle Tree structure for visualization
- ✅ User prediction logs with complete audit trail
- ✅ New endpoints: `/user/predictions`, `/user/stats`, `/merkle-proof`

**v1.0**
- Initial release with forecast + blockchain logging
