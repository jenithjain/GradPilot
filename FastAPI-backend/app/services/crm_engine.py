import pandas as pd
import numpy as np
import os
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

class CRMEngine:
    def __init__(self):
        self.rfm_df = None
        self.segments = None
        self.llm = None
        
        # Initialize LLM if API key exists
        api_key = os.getenv("GROQ_API_KEY")
        if api_key:
            try:
                self.llm = ChatGroq(temperature=0.5, model_name="llama-3.3-70b-versatile", api_key=api_key)
                print("✅ Groq LLM initialized successfully")
            except Exception as e:
                print(f"⚠️ Warning: Could not initialize Groq LLM: {e}")
        else:
            print("⚠️ GROQ_API_KEY not found. AI recommendations will be skipped.")
        
    def process_rfm(self, df, date_col, id_col, amount_col, category_col=None):
        """
        Calculates Recency, Frequency, Monetary (RFM) for each user.
        Also calculates 'Favorite Category' if provided.
        """
        print("Calculating RFM...")
        
        # Ensure standard format
        df = df.copy()
        
        # Robust Date Parsing with Fallback
        try:
            df[date_col] = pd.to_datetime(df[date_col])
        except (ValueError, TypeError):
            try:
                # Handle mixed formats (e.g. some DD/MM/YYYY and some MM/DD/YYYY)
                df[date_col] = pd.to_datetime(df[date_col], format='mixed', errors='coerce')
            except:
                # Last resort: coerce errors to NaT
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        
        # Drop rows where date parsing failed
        df = df.dropna(subset=[date_col])
        
        # Reference date = 1 day after max date in dataset
        snapshot_date = df[date_col].max() + pd.Timedelta(days=1)
        
        # 1. Group by Customer ID
        # FIX: Use date_col for Frequency count to avoid KeyErrors if id_col is index
        rfm = df.groupby(id_col).agg({
            date_col: [lambda x: (snapshot_date - x.max()).days, 'count'], # Recency & Frequency
            amount_col: 'sum'                                              # Monetary
        })
        
        # Flatten columns
        rfm.columns = ['Recency', 'Frequency', 'Monetary']
        
        # 2. Add Favorite Category (Product Analysis)
        if category_col:
            # Find mode (most frequent) category for each user
            fav_cats = df.groupby(id_col)[category_col].agg(
                lambda x: x.mode().iloc[0] if not x.mode().empty else "Unknown"
            )
            rfm['Favorite_Category'] = fav_cats

        self.rfm_df = rfm
        return rfm

    def segment_customers(self, n_clusters=3):
        """
        Uses K-Means to cluster students into 'Cold', 'Warm', 'Hot' lead segments.
        """
        if self.rfm_df is None:
            raise ValueError("Run process_rfm first.")
            
        rfm_data = self.rfm_df[['Recency', 'Frequency', 'Monetary']]
        
        # Log transform to handle skew (Money/Frequency usually pareto distributed)
        rfm_log = np.log(rfm_data + 1)
        
        # Scale
        scaler = StandardScaler()
        rfm_scaled = scaler.fit_transform(rfm_log)
        
        # K-Means
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(rfm_scaled)
        
        self.rfm_df['Cluster'] = clusters
        
        # Label Clusters by engagement/value level
        cluster_avg = self.rfm_df.groupby('Cluster')['Monetary'].mean()
        
        # Sort clusters by value
        sorted_clusters = cluster_avg.sort_values().index.tolist()
        
        label_map = {
            sorted_clusters[0]: 'Cold Lead (0-39)',
            sorted_clusters[1]: 'Warm Lead (40-69)',
            sorted_clusters[2]: 'Hot Lead (70-100)'
        }
        
        if n_clusters > 3: # Fallback for more complex logic
             for i in range(3, n_clusters):
                 label_map[sorted_clusters[i]] = f'Segment {i}'

        self.rfm_df['Segment_Label'] = self.rfm_df['Cluster'].map(label_map)
        return self.rfm_df

    def generate_ai_recommendations(self):
        """
        Generates AI counselling strategies based on Segment + Category overlap using LangChain/Groq.
        """
        if 'Favorite_Category' not in self.rfm_df.columns:
            return pd.DataFrame()

        # Group by Segment AND Category to find patterns
        insights = self.rfm_df.groupby(['Segment_Label', 'Favorite_Category']).size().reset_index(name='Count')
        insights = insights.sort_values(['Segment_Label', 'Count'], ascending=[True, False])
        
        recommendations = []
        
        # Get unique segments
        segments = self.rfm_df['Segment_Label'].unique()
        
        for segment in segments:
            # Get top category for this segment
            seg_data = insights[insights['Segment_Label'] == segment]
            if seg_data.empty: continue
            
            top_cat = seg_data.iloc[0]['Favorite_Category']
            
            rec_text = "Standard follow-up strategy applied."
            
            # Use LLM if available
            if self.llm:
                try:
                    prompt = ChatPromptTemplate.from_template(
                        "You are an education counselling expert at Fateh Education, a study abroad consultancy. Give a single, short, actionable one-liner counselling recommendation "
                        "for a student lead segment labeled '{segment}' whose primary interest area is '{category}'. "
                        "Focus on study abroad guidance, IELTS/PTE prep, scholarship info, or application support. "
                        "Do not use quotes. Keep it under 15 words."
                    )
                    chain = prompt | self.llm
                    response = chain.invoke({"segment": segment, "category": top_cat})
                    rec_text = response.content.strip()
                except Exception as e:
                    print(f"LLM Error for {segment}: {e}")
                    # Fallback logic
                    if "Hot" in segment:
                        rec_text = f"Schedule immediate counsellor callback for {top_cat} applicants."
                    elif "Warm" in segment:
                        rec_text = f"Send scholarship info and {top_cat} course brochures within 24hrs."
                    else:
                        rec_text = f"Add to {top_cat} nurture campaign with IELTS prep resources."
            else:
                # Fallback logic if no LLM
                if "Hot" in segment:
                    rec_text = f"Schedule immediate counsellor callback for {top_cat} applicants."
                elif "Warm" in segment:
                    rec_text = f"Send scholarship info and {top_cat} course brochures within 24hrs."
                else:
                    rec_text = f"Add to {top_cat} nurture campaign with IELTS prep resources."
            
            recommendations.append({
                'Segment': segment,
                'Top Category': top_cat,
                'AI Recommendation': rec_text
            })
            
        return pd.DataFrame(recommendations)
