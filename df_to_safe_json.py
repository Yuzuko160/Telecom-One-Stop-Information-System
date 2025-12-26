import numpy as np
import pandas as pd

def df_to_safe_json(df: pd.DataFrame):
    """
    將 DataFrame 轉換成 JSON 友善格式 (list of dict)
    - None/NaN 會自動轉為 null
    - 數值、字串都能被 jsonify 處理
    """
    if df is None or df.empty:
        return []
        
    # 把 NaN 和 NaT 都轉成 None，避免 jsonify 失敗
    print("開始轉換 NaN → None")
    safe_df = df.replace({np.nan: None, pd.NaT: None})
    print(f"轉換後 DataFrame 預覽：\n{safe_df.head()}")
    # orient="records" 讓每一列變成 dict
    return safe_df.to_dict(orient="records")
