import json
import os
from web3 import Web3
from solcx import compile_standard, install_solc

# Ensure correct solc version is installed
print("Checking Solidity compiler...")
install_solc('0.8.0')

def deploy():
    # 1. Connect to Ganache
    # Default: Local development (127.0.0.1:8545)
    # Production: Set BLOCKCHAIN_URL environment variable
    ganache_url = os.getenv("BLOCKCHAIN_URL", "http://127.0.0.1:8545")
    print(f"🔗 Connecting to blockchain at: {ganache_url}")
    w3 = Web3(Web3.HTTPProvider(ganache_url))

    if not w3.is_connected():
        print(f"❌ Failed to connect to Ganache at {ganache_url}")
        print("   Hint: Make sure Ganache is running on the specified port.")
        return

    # 2. Set Account (Using the first account from Ganache)
    w3.eth.default_account = w3.eth.accounts[0]
    print(f"Deploying with account: {w3.eth.default_account}")

    # 3. Compile Solidity
    contract_path = os.path.join(os.path.dirname(__file__), "contracts", "ForecastLog.sol")
    with open(contract_path, "r") as file:
        contract_source = file.read()

    compiled_sol = compile_standard({
        "language": "Solidity",
        "sources": {"ForecastLog.sol": {"content": contract_source}},
        "settings": {"outputSelection": {"*": {"*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]}}},
    }, solc_version='0.8.0')

    bytecode = compiled_sol['contracts']['ForecastLog.sol']['ForecastLog']['evm']['bytecode']['object']
    abi = json.loads(compiled_sol['contracts']['ForecastLog.sol']['ForecastLog']['metadata'])['output']['abi']

    # 4. Deploy
    ForecastLog = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = ForecastLog.constructor().transact()
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    print(f"✅ Contract Deployed at: {tx_receipt.contractAddress}")

    # 5. Save Artifacts (ABI & Address) for the App to use
    data = {
        "abi": abi,
        "address": tx_receipt.contractAddress
    }
    
    output_path = os.path.join(os.path.dirname(__file__), "contract_data.json")
    with open(output_path, "w") as outfile:
        json.dump(data, outfile)
    print(f"📄 Contract data saved to {output_path}")

if __name__ == "__main__":
    deploy()