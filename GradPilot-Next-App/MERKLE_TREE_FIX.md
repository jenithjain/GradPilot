# Merkle Tree Generation Fix

## Problem
Merkle trees were only being generated and saved to MongoDB for the user `lokeshs3gplf@gmail.com`. Other users who uploaded datasets and analyzed them did not have their prediction logs saved, so the Merkle Tree sidebar showed no data.

## Root Cause
The dashboard page (`app/dashboard/page.js`) was calling the FastAPI backend's `/analyze` endpoint **without passing the `user_email` parameter**.

The FastAPI backend (`FastAPI-backend/app/api/main.py`) only saves prediction logs to MongoDB when `user_email` is provided:

```python
# --- SAVE TO MONGODB ---
if mongodb and user_email:
    try:
        # Save prediction log
        prediction_id = mongodb.save_prediction_log(...)
```

Without `user_email`, the backend would still:
- Generate forecasts ✅
- Create Merkle trees ✅
- Log to blockchain ✅
- Return data to the frontend ✅

But it would **NOT** save to MongoDB ❌, which meant:
- No prediction history in the sidebar
- No Merkle tree visualization
- No blockchain audit trail in the database

## Solution
Updated `app/dashboard/page.js` to:

1. **Import and use NextAuth session**:
   ```javascript
   import { useSession } from "next-auth/react";
   const { data: session } = useSession();
   ```

2. **Pass `user_email` to the `/analyze` endpoint**:
   ```javascript
   // Add user email for MongoDB storage
   if (session?.user?.email) {
     fd.append('user_email', session.user.email);
   }
   ```

## Result
✅ **All logged-in users** can now:
- Upload and analyze datasets
- Have their predictions saved to MongoDB
- See their prediction history in the sidebar
- View interactive Merkle tree visualizations
- Access blockchain audit trails

## Files Changed
- `app/dashboard/page.js` - Added session import and user_email parameter

## Testing
1. Sign in with **any** user account
2. Upload a CSV dataset
3. Click "Analyze Dataset"
4. Open the Prediction Logs Sidebar (left side)
5. ✅ Your prediction should appear with a Merkle tree

## Technical Details
The flow now works as follows:

```
User uploads CSV → Dashboard gets session.user.email
                 ↓
          FastAPI /analyze endpoint
          (receives user_email parameter)
                 ↓
     Generates forecast + Merkle tree
                 ↓
      Saves to MongoDB with user_email
                 ↓
    Frontend sidebar fetches user predictions
                 ↓
        Displays Merkle tree visualization
```

## Previous Hardcoded Email Issue
If there was any hardcoded email (`lokeshs3gplf@gmail.com`) in the codebase, it has been replaced with dynamic session-based email retrieval. This ensures that every user's data is properly isolated and saved to their own account.
