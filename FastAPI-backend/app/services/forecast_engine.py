import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error

class GeneralForecaster:
    def __init__(self):
        self.model = None
        self.feature_cols = []
        
    def detect_columns(self, df):
        """Heuristics to find Date and Sales columns automatically."""
        cols = df.columns.tolist()
        lower_cols = [c.lower() for c in cols]
        
        # 1. Date Detection
        date_col = None
        date_keywords = ['date', 'time', 'day', 'week', 'invoice_date', 't_dat']
        for kw in date_keywords:
            for c, lc in zip(cols, lower_cols):
                if kw in lc and 'birth' not in lc:
                    date_col = c
                    break
            if date_col: break
            
        # 2. Sales/Value Detection
        sales_col = None
        
        # Helper to check if column is numeric
        def is_numeric_col(col_name):
            if pd.api.types.is_numeric_dtype(df[col_name]):
                return True
            # Try sampling
            try:
                sample = df[col_name].dropna().astype(str).head(50)
                if sample.empty: return False
                # Try converting to numeric
                pd.to_numeric(sample)
                return True
            except:
                return False

        # Priority 1: Explicit Revenue/Total columns
        # Reordered keywords to prioritize 'amount' and 'revenue' over generic 'sales'
        sales_keywords = ['revenue', 'amount', 'turnover', 'total', 'sales']
        for kw in sales_keywords:
            for c, lc in zip(cols, lower_cols):
                if kw in lc:
                    # Exclude common non-numeric sales columns
                    if 'channel' in lc or 'region' in lc or 'rep' in lc or 'id' in lc or 'status' in lc:
                        continue
                    
                    if is_numeric_col(c):
                        sales_col = c
                        break
            if sales_col: break
            
        # Priority 2: Calculate Revenue from Quantity * Price
        if not sales_col:
            qty_col = next((c for c, lc in zip(cols, lower_cols) if 'quantity' in lc and is_numeric_col(c)), None)
            price_col = next((c for c, lc in zip(cols, lower_cols) if ('price' in lc or 'unit_price' in lc) and is_numeric_col(c)), None)
            
            if qty_col and price_col:
                print(f"Creating Revenue column from {qty_col} * {price_col}")
                # Ensure numeric before multiplication
                df['Revenue_Calculated'] = pd.to_numeric(df[qty_col], errors='coerce') * pd.to_numeric(df[price_col], errors='coerce')
                sales_col = 'Revenue_Calculated'

        # Priority 3: Fallback to Price/Value (weakest signal)
        if not sales_col:
            fallback_keywords = ['price', 'value', 'close', 'adj close']
            for kw in fallback_keywords:
                for c, lc in zip(cols, lower_cols):
                    if kw in lc:
                        if is_numeric_col(c):
                            sales_col = c
                            break
                if sales_col: break
            
        return date_col, sales_col

    def process_data(self, df, date_col, sales_col):
        """Normalizes data: Parses dates, aggregates duplicates, ensures daily frequency."""
        # Robust Rename
        df = df.rename(columns={date_col: 'ds', sales_col: 'y'})
        
        # Date Parsing
        df['ds'] = pd.to_datetime(df['ds'], errors='coerce')
        
        # Force numeric on target
        df['y'] = pd.to_numeric(df['y'], errors='coerce')
        
        df = df.dropna(subset=['ds', 'y'])
        
        # Normalize to Date only (remove time component) to ensure daily aggregation works
        df['ds'] = df['ds'].dt.normalize()
        
        # Sorting & Aggregation
        df = df.sort_values('ds')
        daily_df = df.groupby('ds')['y'].sum().reset_index()
        
        # Fill missing dates with 0
        if not daily_df.empty:
            all_dates = pd.date_range(start=daily_df['ds'].min(), end=daily_df['ds'].max(), freq='D')
            daily_df = daily_df.set_index('ds').reindex(all_dates, fill_value=0).reset_index()
            daily_df.columns = ['ds', 'y']
        
        return daily_df

    def create_features(self, df, lags=[1, 2, 3, 7, 14, 28], windows=[7, 14, 28]):
        """Feature Engineering: Lags and Rolling Windows."""
        df_feat = df.copy()
        
        # Time Features
        df_feat['day_of_week'] = df_feat['ds'].dt.dayofweek
        df_feat['day_of_month'] = df_feat['ds'].dt.day
        df_feat['month'] = df_feat['ds'].dt.month
        
        # Lag Features
        for lag in lags:
            df_feat[f'lag_{lag}'] = df_feat['y'].shift(lag)
            
        # Rolling Window Features
        for w in windows:
            df_feat[f'roll_mean_{w}'] = df_feat['y'].shift(1).rolling(window=w).mean()
            
        df_feat = df_feat.dropna()
        self.feature_cols = [c for c in df_feat.columns if c not in ['ds', 'y']]
        return df_feat

    def train(self, df):
        """Trains the Random Forest model."""
        df_processed = self.create_features(df)
        
        if df_processed.empty:
            raise ValueError("Not enough data to generate features. Need at least 60 days of history.")

        X = df_processed[self.feature_cols]
        y = df_processed['y']
        
        # Standard Random Forest for robustness
        model = RandomForestRegressor(n_estimators=200, max_depth=15, min_samples_split=5, n_jobs=-1, random_state=42)
        model.fit(X, y)
        self.model = model
        
        # Simple validation on last split
        tscv = TimeSeriesSplit(n_splits=3)
        train_idx, test_idx = list(tscv.split(X))[-1]
        y_pred = model.predict(X.iloc[test_idx])
        mae = mean_absolute_error(y.iloc[test_idx], y_pred)
        
        # FIX: Return only the scalar Metric (float), not a tuple
        return float(mae)

    def forecast(self, last_known_data, days=28):
        """Recursive Forecasting for the next 'days'."""
        future_dates = pd.date_range(start=last_known_data['ds'].max() + pd.Timedelta(days=1), periods=days)
        forecasts = []
        current_hist = last_known_data.copy()
        
        for date in future_dates:
            # Placeholder row
            new_row = pd.DataFrame({'ds': [date], 'y': [0]})
            temp_df = pd.concat([current_hist, new_row], ignore_index=True)
            
            # Generate features
            feat_df = self.create_features(temp_df)
            if feat_df.empty: break
                
            X_pred = feat_df.iloc[[-1]][self.feature_cols]
            
            # Predict
            pred_value = self.model.predict(X_pred)[0]
            pred_value = max(0, pred_value) # No negative sales
            
            # Update history for recursion
            current_hist.iloc[-1, current_hist.columns.get_loc('y')] = pred_value
            forecasts.append({'ds': date, 'forecast': pred_value})
            
        return pd.DataFrame(forecasts)