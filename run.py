from app import create_app
# from app.utils.usage_logger import init_db
from config import Config

app = create_app(Config)    # ⬅️ 把 Config 當參數丟進去

    
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8002, debug=True)
