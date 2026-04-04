import json
import os
from web3 import Web3

class BlockchainService:
    def __init__(self):
        # Default to local Ganache for development
        # Set BLOCKCHAIN_URL env var to use cloud VM in production
        #ganache_url = os.getenv("BLOCKCHAIN_URL", "http://127.0.0.0:8545")
        ganache_url = "http://127.0.0.1:8545"
        print(f"🔗 Connecting to blockchain at: {ganache_url}")
        self.w3 = Web3(Web3.HTTPProvider(ganache_url))
        
        if not self.w3.is_connected():
            raise Exception(f"❌ Failed to connect to blockchain at {ganache_url}. Make sure Ganache is running.")
        
        # Load Contract Data
        data_path = os.path.join(os.path.dirname(__file__), "contract_data.json")
        if not os.path.exists(data_path):
            raise Exception("Contract data not found! Run deploy.py first.")

        with open(data_path, "r") as f:
            data = json.load(f)
            self.address = data["address"]
            self.abi = data["abi"]

        self.contract = self.w3.eth.contract(address=self.address, abi=self.abi)

    def log_forecast(self, domain: str, value: int, merkle_root: str, timestamp: int):
        """Logs a forecast to the blockchain"""
        # Using account[0] for simplicity in this demo
        tx_hash = self.contract.functions.logForecast(
            domain, value, merkle_root, timestamp
        ).transact({'from': self.w3.eth.accounts[0]})
        
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()

    def get_latest_forecast(self):
        """Fetches the latest forecast directly from chain"""
        try:
            # Check count first to avoid "No forecasts logged" revert
            count = self.contract.functions.getForecastCount().call()
            if count == 0:
                return {"domain": "No Data", "value_cents": 0, "timestamp": 0, "merkle_root": ""}

            data = self.contract.functions.getLatestForecast().call()
            return {
                "domain": data[0],
                "value_cents": data[1],
                "merkle_root": data[2],
                "timestamp": data[3]
            }
        except Exception as e:
            return {"error": str(e)}
            
    def get_total_count(self):
        return self.contract.functions.getForecastCount().call()