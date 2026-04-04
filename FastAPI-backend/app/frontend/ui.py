import streamlit as st
import time
import sys
import os

# Add project root to path so we can import 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.blockchain.wrapper import BlockchainService

st.set_page_config(page_title="Redact CRM Blockchain", layout="wide")

st.title("🔗 Redact CRM - Blockchain Forecast Log")

# Sidebar for connection status
with st.sidebar:
    st.header("Connection Status")
    try:
        service = BlockchainService()
        st.success(f"✅ Connected to Contract\n\nAddress: `{service.address}`")
    except Exception as e:
        st.error("❌ Not Connected")
        st.warning(f"Ensure Ganache is running on port 8545 and you have run `deploy.py`.\n\nError: {e}")
        service = None

# Main Interface
col1, col2 = st.columns(2)

with col1:
    st.subheader("📝 Log New Forecast")
    with st.form("log_forecast_form"):
        domain = st.text_input("Domain", value="example.com")
        value = st.number_input("Total Predicted Value (cents)", min_value=0, value=50000)
        merkle_root = st.text_input("Merkle Root (Hash)", value="0x123456789abcdef...")
        
        submitted = st.form_submit_button("Log to Blockchain")
        
        if submitted and service:
            try:
                timestamp = int(time.time())
                with st.spinner("Sending transaction..."):
                    tx_hash = service.log_forecast(domain, value, merkle_root, timestamp)
                st.success("Transaction Successful!")
                st.code(f"Tx Hash: {tx_hash}")
            except Exception as e:
                st.error(f"Transaction Failed: {e}")

with col2:
    st.subheader("🔍 Latest On-Chain Data")
    if st.button("Fetch Latest Forecast"):
        if service:
            try:
                data = service.get_latest_forecast()
                st.json(data)
                
                # Display nicely
                st.metric("Domain", data.get('domain', 'N/A'))
                st.metric("Value", f"${data.get('value_cents', 0)/100:,.2f}")
                st.caption(f"Timestamp: {data.get('timestamp', 0)}")
            except Exception as e:
                st.error(f"Failed to fetch data: {e}")
