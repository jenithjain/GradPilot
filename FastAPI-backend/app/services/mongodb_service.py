"""
MongoDB Service for storing prediction logs with Merkle Tree data
"""
import os
from pymongo import MongoClient
from datetime import datetime
from typing import Dict, List, Optional
import uuid
from dotenv import load_dotenv

load_dotenv(r"C:\Users\lamaq\OneDrive\Desktop\Redact-CRM\.env")

class MongoDBService:
    def __init__(self):
        """Initialize MongoDB connection"""
        mongodb_uri = os.getenv("MONGODB_URI")
        if not mongodb_uri:
            raise ValueError("MONGODB_URI not found in environment variables")
        
        self.client = MongoClient(mongodb_uri)
        # Use 'test' database where existing users are stored
        self.db = self.client.get_database("test")
        self.users_collection = self.db["users"]
        print(f"✅ MongoDB connected successfully to database: {self.db.name}")
    
    def save_prediction_log(
        self,
        user_email: str,
        forecast_data: Dict,
        blockchain_data: Dict,
        merkle_tree_data: Dict,
        crm_analysis: Optional[Dict] = None
    ) -> str:
        """
        Save a complete prediction log to the user's document
        
        Args:
            user_email: User's email identifier
            forecast_data: Dictionary with forecast results
            blockchain_data: Dictionary with blockchain transaction info
            merkle_tree_data: Dictionary with Merkle Tree structure
            crm_analysis: Optional CRM segmentation data
        
        Returns:
            prediction_id: Unique ID for this prediction
        """
        prediction_id = str(uuid.uuid4())
        
        # Structure the prediction log
        prediction_log = {
            "predictionId": prediction_id,
            "createdAt": datetime.utcnow(),
            
            "forecast": {
                "totalPredicted": forecast_data.get("total_predicted", 0),
                "dailyPredictions": [
                    {
                        "day": pred.get("day"),
                        "date": pred.get("date"),
                        "predicted": pred.get("predicted")
                    }
                    for pred in forecast_data.get("daily_predictions", [])
                ],
                "metrics": forecast_data.get("metrics", {})
            },
            
            "blockchain": {
                "transactionHash": blockchain_data.get("transaction_hash"),
                "blockNumber": blockchain_data.get("block_number"),
                "timestamp": blockchain_data.get("timestamp"),
                "domain": blockchain_data.get("domain", "sales_forecast")
            },
            
            "merkleTree": {
                "root": merkle_tree_data.get("root"),
                "leaves": [
                    {
                        "index": leaf.get("index"),
                        "hash": leaf.get("hash"),
                        "data": leaf.get("data")
                    }
                    for leaf in merkle_tree_data.get("leaves", [])
                ],
                "treeStructure": merkle_tree_data.get("tree_structure"),
                "hierarchicalStructure": merkle_tree_data.get("hierarchical_structure")
            }
        }
        
        # Add CRM analysis if available
        if crm_analysis:
            prediction_log["crmAnalysis"] = {
                "segments": crm_analysis.get("segments", []),
                "recommendations": crm_analysis.get("recommendations", "")
            }
        
        # Update user document - add to predictionLogs array
        result = self.users_collection.update_one(
            {"email": user_email},
            {
                "$push": {"predictionLogs": prediction_log},
                "$set": {"updatedAt": datetime.utcnow()}
            },
            upsert=True  # Create user if doesn't exist
        )
        
        print(f"📊 Prediction log saved for user: {user_email} | Prediction ID: {prediction_id}")
        return prediction_id
    
    def get_user_predictions(
        self,
        user_email: str,
        limit: Optional[int] = None
    ) -> List[Dict]:
        """
        Retrieve all prediction logs for a user
        
        Args:
            user_email: User's email
            limit: Optional limit on number of predictions to return
        
        Returns:
            List of prediction logs
        """
        user = self.users_collection.find_one(
            {"email": user_email},
            {"predictionLogs": 1, "_id": 0}
        )
        
        if not user or "predictionLogs" not in user:
            return []
        
        predictions = user["predictionLogs"]
        
        # Sort by most recent first
        predictions.sort(key=lambda x: x.get("createdAt", datetime.min), reverse=True)
        
        if limit:
            predictions = predictions[:limit]
        
        return predictions
    
    def get_prediction_by_id(
        self,
        user_email: str,
        prediction_id: str
    ) -> Optional[Dict]:
        """
        Retrieve a specific prediction log
        
        Args:
            user_email: User's email
            prediction_id: Unique prediction ID
        
        Returns:
            Prediction log or None if not found
        """
        user = self.users_collection.find_one(
            {
                "email": user_email,
                "predictionLogs.predictionId": prediction_id
            },
            {
                "predictionLogs.$": 1,
                "_id": 0
            }
        )
        
        if user and "predictionLogs" in user and len(user["predictionLogs"]) > 0:
            return user["predictionLogs"][0]
        
        return None
    
    def get_merkle_tree(
        self,
        user_email: str,
        transaction_hash: str
    ) -> Optional[Dict]:
        """
        Retrieve Merkle Tree data by transaction hash
        
        Args:
            user_email: User's email
            transaction_hash: Blockchain transaction hash
        
        Returns:
            Merkle Tree data or None if not found
        """
        user = self.users_collection.find_one(
            {
                "email": user_email,
                "predictionLogs.blockchain.transactionHash": transaction_hash
            },
            {
                "predictionLogs.$": 1,
                "_id": 0
            }
        )
        
        if user and "predictionLogs" in user and len(user["predictionLogs"]) > 0:
            return user["predictionLogs"][0].get("merkleTree")
        
        return None
    
    def delete_prediction(
        self,
        user_email: str,
        prediction_id: str
    ) -> bool:
        """
        Delete a specific prediction log
        
        Args:
            user_email: User's email
            prediction_id: Unique prediction ID
        
        Returns:
            True if deleted, False otherwise
        """
        result = self.users_collection.update_one(
            {"email": user_email},
            {
                "$pull": {"predictionLogs": {"predictionId": prediction_id}},
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        
        return result.modified_count > 0
    
    def get_user_stats(self, user_email: str) -> Dict:
        """
        Get summary statistics for a user's predictions
        
        Args:
            user_email: User's email
        
        Returns:
            Dictionary with summary stats
        """
        predictions = self.get_user_predictions(user_email)
        
        if not predictions:
            return {
                "total_predictions": 0,
                "total_revenue_predicted": 0,
                "latest_prediction_date": None,
                "average_prediction_value": 0
            }
        
        total_revenue = sum(
            pred.get("forecast", {}).get("totalPredicted", 0)
            for pred in predictions
        )
        
        return {
            "total_predictions": len(predictions),
            "total_revenue_predicted": total_revenue,
            "latest_prediction_date": predictions[0].get("createdAt"),
            "average_prediction_value": total_revenue / len(predictions) if predictions else 0
        }
