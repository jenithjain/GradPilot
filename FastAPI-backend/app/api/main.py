from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.blockchain.wrapper import BlockchainService
from app.blockchain.merkle_tree import MerkleTree
from app.services.forecast_engine import GeneralForecaster
from app.services.crm_engine import CRMEngine
from app.services.mongodb_service import MongoDBService
import uvicorn
import pandas as pd
import io
import time
import hashlib
from typing import Optional, List

app = FastAPI(title="GradPilot API")

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins like ["https://your-frontend.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS (Matching your Schema) ---
class Meta(BaseModel):
    forecast_id: str
    domain: str
    generated_at_unix: int
    model_version: str

class ForecastData(BaseModel):
    currency: str
    scale_factor: int
    total_predicted_value_int: int
    prediction_period_start: str
    prediction_period_end: str

class IntegrityProof(BaseModel):
    merkle_root: str
    record_count_hashed: int
    algorithm: str

class Payload(BaseModel):
    meta: Meta
    forecast_data: ForecastData
    integrity_proof: IntegrityProof

# --- INITIALIZE BLOCKCHAIN SERVICE ---
try:
    blockchain = BlockchainService()
    print("✅ Connected to Blockchain Service")
except Exception as e:
    print(f"⚠️ Blockchain connection failed: {e}")
    blockchain = None

# --- INITIALIZE MONGODB SERVICE ---
try:
    mongodb = MongoDBService()
    print("✅ Connected to MongoDB Service")
except Exception as e:
    print(f"⚠️ MongoDB connection failed: {e}")
    mongodb = None

# --- IN-MEMORY MERKLE TREE STORAGE ---
# Store trees by transaction hash for later retrieval
merkle_trees = {}

@app.get("/")
def read_root():
    return {"status": "GradPilot API is running"}

@app.post("/log-forecast")
def log_forecast_endpoint(payload: Payload):
    """
    Receives the strict JSON payload from ML Engine and logs to Blockchain.
    """
    if not blockchain:
        raise HTTPException(status_code=503, detail="Blockchain service unavailable")

    try:
        tx_hash = blockchain.log_forecast(
            domain=payload.meta.domain,
            value=payload.forecast_data.total_predicted_value_int,
            merkle_root=payload.integrity_proof.merkle_root,
            timestamp=payload.meta.generated_at_unix
        )
        return {"status": "success", "transaction_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/latest-on-chain")
def get_latest():
    """Reads the last confirmed data from the blockchain"""
    if not blockchain:
        raise HTTPException(status_code=503, detail="Blockchain service unavailable")
    return blockchain.get_latest_forecast()

@app.get("/merkle-tree/{tx_hash}")
def get_merkle_tree(tx_hash: str):
    """
    Get the Merkle Tree structure for a specific transaction.
    Used by the frontend to visualize the tree.
    """
    if tx_hash not in merkle_trees:
        raise HTTPException(status_code=404, detail="Merkle Tree not found for this transaction")
    
    tree_data = merkle_trees[tx_hash]
    merkle_tree = tree_data["tree"]
    
    return {
        "transaction_hash": tx_hash,
        "domain": tree_data["domain"],
        "timestamp": tree_data["timestamp"],
        "merkle_root": "0x" + merkle_tree.get_root(),
        "tree": {
            "leaves": merkle_tree.leaves,
            "predictions": [
                {"day": i+1, "data": tree_data["predictions"][i], "hash": merkle_tree.leaves[i]}
                for i in range(len(tree_data["predictions"]))
            ]
        }
    }

@app.get("/merkle-proof/{tx_hash}/{day}")
def get_merkle_proof(tx_hash: str, day: int):
    """
    Get the proof path for a specific day's prediction.
    Used to verify that a specific day's data is part of the Merkle Tree.
    """
    if tx_hash not in merkle_trees:
        raise HTTPException(status_code=404, detail="Merkle Tree not found for this transaction")
    
    tree_data = merkle_trees[tx_hash]
    merkle_tree = tree_data["tree"]
    
    # Validate day number
    if day < 1 or day > len(tree_data["predictions"]):
        raise HTTPException(status_code=400, detail=f"Day must be between 1 and {len(tree_data['predictions'])}")
    
    index = day - 1  # Convert to 0-indexed
    proof = merkle_tree.get_proof(index)
    
    return {
        "transaction_hash": tx_hash,
        "day": day,
        "data": tree_data["predictions"][index],
        "data_hash": merkle_tree.leaves[index],
        "proof": [{"hash": h, "position": p} for h, p in proof],
        "merkle_root": "0x" + merkle_tree.get_root(),
        "instructions": "To verify: Start with data_hash, combine with each proof hash (left or right), hash the result. Final hash should equal merkle_root."
    }

@app.post("/analyze")
async def analyze_dataset(
    file: UploadFile = File(...),
    user_email: Optional[str] = Form(None),
    date_col: Optional[str] = Form(None),
    sales_col: Optional[str] = Form(None),
    id_col: Optional[str] = Form(None),
    category_col: Optional[str] = Form(None)
):
    """
    Unified endpoint for Forecasting and CRM.
    Takes a CSV file, user_email, and optional column mappings, runs the full pipeline, and returns JSON results.
    """
    try:
        contents = await file.read()
        # Try reading CSV with different encodings
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(contents), encoding='ISO-8859-1')
            
        # Initialize Engines
        forecaster = GeneralForecaster()
        crm = CRMEngine()
        
        # 1. Detect Columns (Use provided if available, else auto-detect)
        auto_date, auto_sales = forecaster.detect_columns(df)
        
        final_date_col = date_col if date_col and date_col in df.columns else auto_date
        final_sales_col = sales_col if sales_col and sales_col in df.columns else auto_sales
        
        if not final_date_col or not final_sales_col:
            raise HTTPException(status_code=400, detail=f"Could not detect Date or Sales columns. Auto-detected: Date={auto_date}, Sales={auto_sales}")
            
        # Detect ID and Category for CRM
        auto_id = next((c for c in df.columns if 'id' in c.lower() or 'cust' in c.lower()), None)
        auto_cat = next((c for c in df.columns if 'cat' in c.lower() or 'prod' in c.lower() or 'dept' in c.lower()), None)
        
        final_id_col = id_col if id_col and id_col in df.columns else auto_id
        final_cat_col = category_col if category_col and category_col in df.columns else auto_cat
        
        response_data = {
            "meta": {
                "filename": file.filename,
                "used_columns": {
                    "date": final_date_col,
                    "sales": final_sales_col,
                    "id": final_id_col,
                    "category": final_cat_col
                }
            },
            "forecast": {},
            "segmentation": {}
        }
        
        # 2. Run Forecast Pipeline
        try:
            df_clean = forecaster.process_data(df, final_date_col, final_sales_col)
            mae = forecaster.train(df_clean)
            
            # Metrics
            mean_daily_val = df_clean['y'].mean()
            error_pct = (mae / mean_daily_val) * 100 if mean_daily_val != 0 else 0.0
            
            # Forecast
            forecast_df = forecaster.forecast(df_clean, days=28)
            total_predicted_sales = float(forecast_df['forecast'].sum())
            
            response_data["forecast"] = {
                "status": "success",
                "metrics": {
                    "mae": float(mae),
                    "daily_avg_sales": float(mean_daily_val),
                    "error_percentage": float(error_pct),
                    "total_predicted_sales_28d": total_predicted_sales
                },
                # Convert timestamps to string for JSON serialization
                "history": df_clean.tail(90).assign(ds=lambda x: x['ds'].astype(str)).to_dict(orient="records"),
                "prediction": forecast_df.assign(ds=lambda x: x['ds'].astype(str)).to_dict(orient="records")
            }

            # --- AUTOMATIC BLOCKCHAIN LOGGING WITH MERKLE TREE ---
            if blockchain:
                try:
                    # Prepare data for blockchain
                    domain_name = file.filename if file.filename else "unknown_dataset"
                    value_cents = int(total_predicted_sales * 100) # Convert to cents
                    timestamp = int(time.time())
                    
                    # Build Merkle Tree from 28 daily predictions
                    prediction_data = [
                        f"Day {i+1}|{row['ds']}|{row['forecast']:.2f}"
                        for i, row in forecast_df.iterrows()
                    ]
                    merkle_tree = MerkleTree(prediction_data)
                    merkle_root = "0x" + merkle_tree.get_root()

                    print(f"🔗 Logging to Blockchain: {domain_name}, {value_cents}")
                    print(f"📊 Merkle Root: {merkle_root}")
                    
                    tx_hash = blockchain.log_forecast(
                        domain=domain_name,
                        value=value_cents,
                        merkle_root=merkle_root,
                        timestamp=timestamp
                    )
                    
                    # Store tree for later retrieval
                    merkle_trees[tx_hash] = {
                        "tree": merkle_tree,
                        "predictions": prediction_data,
                        "domain": domain_name,
                        "timestamp": timestamp
                    }
                    
                    response_data["forecast"]["blockchain_status"] = "logged"
                    response_data["forecast"]["transaction_hash"] = tx_hash
                    response_data["forecast"]["merkle_root"] = merkle_root
                    response_data["forecast"]["merkle_tree"] = {
                        "leaves": merkle_tree.leaves,
                        "tree_size": len(merkle_tree.leaves),
                        "predictions": [
                            {"day": i+1, "data": prediction_data[i], "hash": merkle_tree.leaves[i]}
                            for i in range(len(prediction_data))
                        ]
                    }
                    print(f"✅ Logged! Tx: {tx_hash}")
                    
                    # --- SAVE TO MONGODB ---
                    if mongodb and user_email:
                        try:
                            # Prepare structured data for MongoDB
                            forecast_data = {
                                "total_predicted": total_predicted_sales,
                                "daily_predictions": [
                                    {
                                        "day": i+1,
                                        "date": str(row['ds']),
                                        "predicted": float(row['forecast'])
                                    }
                                    for i, row in forecast_df.iterrows()
                                ],
                                "metrics": {
                                    "mae": float(mae),
                                    "error_percentage": float(error_pct)
                                }
                            }
                            
                            blockchain_data = {
                                "transaction_hash": tx_hash,
                                "timestamp": timestamp,
                                "domain": domain_name
                            }
                            
                            # Get hierarchical tree structure for visualization
                            hierarchical_tree = merkle_tree.get_hierarchical_structure(prediction_data)
                            
                            merkle_tree_data = {
                                "root": merkle_root,
                                "leaves": [
                                    {
                                        "index": i,
                                        "hash": merkle_tree.leaves[i],
                                        "data": prediction_data[i]
                                    }
                                    for i in range(len(prediction_data))
                                ],
                                "tree_structure": merkle_tree.tree,
                                "hierarchical_structure": hierarchical_tree  # For frontend visualization
                            }
                            
                            prediction_id = mongodb.save_prediction_log(
                                user_email=user_email,
                                forecast_data=forecast_data,
                                blockchain_data=blockchain_data,
                                merkle_tree_data=merkle_tree_data
                            )
                            
                            response_data["forecast"]["prediction_id"] = prediction_id
                            response_data["forecast"]["saved_to_db"] = True
                            print(f"💾 Saved to MongoDB with ID: {prediction_id}")
                            
                        except Exception as db_e:
                            print(f"⚠️ MongoDB save failed: {db_e}")
                            response_data["forecast"]["saved_to_db"] = False
                    # ------------------------------------
                    
                except Exception as bc_e:
                    print(f"❌ Blockchain Error: {bc_e}")
                    response_data["forecast"]["blockchain_status"] = "failed"
                    response_data["forecast"]["blockchain_error"] = str(bc_e)
            # ------------------------------------

        except Exception as e:
            response_data["forecast"] = {"status": "error", "message": str(e)}

        # 3. Run CRM Pipeline
        if final_id_col:
            try:
                rfm_df = crm.process_rfm(df, final_date_col, final_id_col, final_sales_col, final_cat_col)
                labeled_rfm = crm.segment_customers(n_clusters=3)
                recs_df = crm.generate_ai_recommendations()
                
                # Stats
                vip_segment = labeled_rfm[labeled_rfm['Segment_Label'].str.contains('VIP', case=False, na=False)]
                
                response_data["segmentation"] = {
                    "status": "success",
                    "stats": {
                        "vip_count": int(len(vip_segment)),
                        "avg_spend": float(labeled_rfm['Monetary'].mean()),
                        "active_customers": int(len(labeled_rfm))
                    },
                    "segments_summary": labeled_rfm['Segment_Label'].value_counts().to_dict(),
                    "recommendations": recs_df.to_dict(orient="records") if not recs_df.empty else [],
                    # Sample data for scatter plot (limit to top 1000 to avoid huge payload)
                    "plot_data": labeled_rfm[['Recency', 'Frequency', 'Monetary', 'Segment_Label']].reset_index().head(1000).to_dict(orient="records")
                }
            except Exception as e:
                response_data["segmentation"] = {"status": "error", "message": str(e)}
        else:
             response_data["segmentation"] = {"status": "skipped", "message": "No Customer ID column detected."}
             
        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== NEW MONGODB ENDPOINTS =====

@app.get("/user/predictions/{user_email}")
def get_user_predictions(user_email: str, limit: Optional[int] = None):
    """
    Retrieve all prediction logs for a specific user
    
    Args:
        user_email: User's email address
        limit: Optional limit on number of predictions to return
    
    Returns:
        List of prediction logs with Merkle Tree data
    """
    if not mongodb:
        raise HTTPException(status_code=503, detail="MongoDB service not available")
    
    try:
        predictions = mongodb.get_user_predictions(user_email, limit)
        return {
            "user_email": user_email,
            "total_predictions": len(predictions),
            "predictions": predictions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/prediction/{user_email}/{prediction_id}")
def get_prediction_by_id(user_email: str, prediction_id: str):
    """
    Retrieve a specific prediction log by ID
    
    Args:
        user_email: User's email address
        prediction_id: Unique prediction ID
    
    Returns:
        Prediction log with full Merkle Tree data
    """
    if not mongodb:
        raise HTTPException(status_code=503, detail="MongoDB service not available")
    
    try:
        prediction = mongodb.get_prediction_by_id(user_email, prediction_id)
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")
        return prediction
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/merkle-tree/{user_email}/{transaction_hash}")
def get_user_merkle_tree(user_email: str, transaction_hash: str):
    """
    Retrieve Merkle Tree data for a specific transaction
    
    Args:
        user_email: User's email address
        transaction_hash: Blockchain transaction hash
    
    Returns:
        Complete Merkle Tree structure
    """
    if not mongodb:
        raise HTTPException(status_code=503, detail="MongoDB service not available")
    
    try:
        merkle_data = mongodb.get_merkle_tree(user_email, transaction_hash)
        if not merkle_data:
            raise HTTPException(status_code=404, detail="Merkle Tree not found")
        return merkle_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/stats/{user_email}")
def get_user_stats(user_email: str):
    """
    Get summary statistics for a user's predictions
    
    Args:
        user_email: User's email address
    
    Returns:
        Summary statistics including total predictions, revenue predicted, etc.
    """
    if not mongodb:
        raise HTTPException(status_code=503, detail="MongoDB service not available")
    
    try:
        stats = mongodb.get_user_stats(user_email)
        return {
            "user_email": user_email,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/user/prediction/{user_email}/{prediction_id}")
def delete_prediction(user_email: str, prediction_id: str):
    """
    Delete a specific prediction log
    
    Args:
        user_email: User's email address
        prediction_id: Unique prediction ID
    
    Returns:
        Success message
    """
    if not mongodb:
        raise HTTPException(status_code=503, detail="MongoDB service not available")
    
    try:
        success = mongodb.delete_prediction(user_email, prediction_id)
        if not success:
            raise HTTPException(status_code=404, detail="Prediction not found or already deleted")
        return {"message": "Prediction deleted successfully", "prediction_id": prediction_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)