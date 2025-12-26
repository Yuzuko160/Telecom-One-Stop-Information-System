import os
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, g, request, current_app, jsonify, redirect
from config import Config, FILE_PATHS

# === 日誌設定（只初始化一次） ===
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)

# 匯入 models（確保定義會註冊到 Base 上）
from .models.excel_manager import ExcelManager
from .routes.menu import menu_bp
from .routes.usage import usage_bp
from .routes.low_traffic import low_traffic_bp
from .routes.site_data import site_data_bp, ta_trend_bp, percentile_bp
from .routes.cus_layer_map import cus_layer_map_bp
from .routes.ante_query import ante_query_bp
# from .routes.auth import auth_bp
from .routes.IOPS_CR import IOPS_CR_bp
from .routes.UL_interfere import UL_interfere_bp
from .routes.system_config import system_config_bp
from .routes.site_property import site_property_bp
from .routes.param_4g import param_4g_bp
from .routes.param_5g import param_5g_bp
from .routes.low_traffic_daily import low_traffic_daily_bp
from .routes.low_traffic_weekly import low_traffic_weekly_bp
from app.db import init_db
from .utils.cache_utils import reset_excel_cache 


def create_app(config_object=None):
    b_dir = os.path.abspath(os.path.dirname(__file__))
    app = Flask(
        __name__,
        static_folder=os.path.join(b_dir, "static"),
        static_url_path='/N2RF/static',  # 設定靜態資源 URL 路徑
        template_folder=os.path.join(b_dir, "view"),
        instance_relative_config=True,
    )

    # === 引入 config(系統配置設定) 大寫參數===
    app.config.from_object(Config)
    
    # === 設定應用程式根路徑 (用於 nginx 反向代理) ===
    app.config['APPLICATION_ROOT'] = Config.APPLICATION_ROOT

    # === 利用 config 路徑 呼叫 ExcelManager 開始預載入excel檔案 ===
    base_dir = app.config["BASE_DIR"]
    app.config["EXCEL_MGR"] = ExcelManager(base_dir)
    excel_mgr = app.config["EXCEL_MGR"]

    # === db config ===
    app.config['SECRET_KEY'] = "super_secret_key"

    # === 全局模板變數：應用根路徑 ===
    @app.context_processor
    def inject_app_root():
        env_val = os.environ.get("SHOW_MENU_INDEX", "")
        sanitized = (env_val or "").strip().upper()
        return dict(
            app_root=Config.APPLICATION_ROOT,
            # 若系統環境變數 SHOW_MENU_INDEX 存在且為 "OFF"（不分大小寫，忽略前後空白），則隱藏右上頁面跳轉功能
            show_menu_index_visible=(sanitized != "OFF")
        )

    # 在應用啟動時輸出 SHOW_MENU_INDEX 的值（方便偵錯）
    show_menu_env = os.environ.get("SHOW_MENU_INDEX")
    sanitized = (show_menu_env or "").strip().upper()
    show_menu_visible = (sanitized != "OFF")
    logging.info(f"環境變數 SHOW_MENU_INDEX raw={repr(show_menu_env)} sanitized='{sanitized}' -> show_menu_index_visible={show_menu_visible}")
    print(f"[INFO] SHOW_MENU_INDEX raw={repr(show_menu_env)} sanitized='{sanitized}' -> show_menu_index_visible={show_menu_visible}")

    # === Reset 快取 ===
    @app.route("/N2RF/reset_cache", methods=["POST"])
    def reset_cache():
        reset_excel_cache()
        return jsonify({"message": "快取已清除"}), 200

    # === 預載 Excel 資料（並行載入優化） ===
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        try:
            with app.app_context():
                print("🚀 開始並行載入 Excel 資料...")
                import time
                start_time = time.time()
                
                # 定義所有載入任務
                load_tasks = [
                    ("Site 資料", lambda: excel_mgr.get_site_data(force_reload=False)),
                    ("5G 低話務地圖", lambda: excel_mgr.get_map_data(force_reload=False)),
                    ("Antenna 天線資料庫", lambda: excel_mgr.get_ante_data(force_reload=False)),
                    ("UL 干擾資料", lambda: excel_mgr.get_UL_interfere_data(force_reload=False)),
                    ("基站組態查詢", lambda: excel_mgr.get_system_config_data(force_reload=False)),
                    ("基站屬性查詢", lambda: excel_mgr.get_site_property_data(force_reload=False)),
                    ("4G 參數異動", lambda: excel_mgr.get_param_4g_data(force_reload=False)),
                    ("5G 參數異動", lambda: excel_mgr.get_param_5g_data(force_reload=False)),
                    ("低使用率 Daily", lambda: excel_mgr.get_low_traffic_daily_data(force_reload=False)),
                    ("低使用率 Weekly", lambda: excel_mgr.get_low_traffic_weekly_data(force_reload=False)),
                ]
                
                # 使用執行緒池並行載入（最多 5 個並行任務）
                successful = 0
                failed = 0
                
                with ThreadPoolExecutor(max_workers=5) as executor:
                    # 提交所有任務
                    future_to_task = {
                        executor.submit(task_func): task_name 
                        for task_name, task_func in load_tasks
                    }
                    
                    # 等待所有任務完成
                    for future in as_completed(future_to_task):
                        task_name = future_to_task[future]
                        try:
                            future.result()
                            successful += 1
                            print(f"  ✅ {task_name}")
                        except Exception as e:
                            failed += 1
                            print(f"  ❌ {task_name}: {e}")
                            logging.error(f"載入 {task_name} 失敗: {e}", exc_info=True)
                
                elapsed_time = time.time() - start_time
                print(f"\n🎉 Excel 資料載入完成！")
                print(f"📊 成功: {successful} / 失敗: {failed} / 總計: {len(load_tasks)}")
                print(f"⏱️  耗時: {elapsed_time:.2f} 秒")
                
        except Exception as e:
            print(f"❌ 預載入失敗: {e}")
            logging.error(f"預載入失敗: {e}", exc_info=True)

    # === 註冊藍圖 (所有路由都在 / 底下) ===
    app.register_blueprint(menu_bp, url_prefix='/')
    app.register_blueprint(usage_bp, url_prefix='/')
    app.register_blueprint(low_traffic_bp, url_prefix='/')
    app.register_blueprint(site_data_bp, url_prefix='/')
    app.register_blueprint(ta_trend_bp, url_prefix='/')
    app.register_blueprint(percentile_bp, url_prefix='/')
    app.register_blueprint(cus_layer_map_bp, url_prefix='/')
    app.register_blueprint(ante_query_bp, url_prefix='/')
    app.register_blueprint(IOPS_CR_bp, url_prefix='/')
    app.register_blueprint(UL_interfere_bp, url_prefix='/')
    app.register_blueprint(system_config_bp, url_prefix='/')
    app.register_blueprint(site_property_bp, url_prefix='/')
    app.register_blueprint(param_4g_bp, url_prefix='/')
    app.register_blueprint(param_5g_bp, url_prefix='/')
    app.register_blueprint(low_traffic_daily_bp, url_prefix='/')
    app.register_blueprint(low_traffic_weekly_bp, url_prefix='/')
    # app.register_blueprint(auth_bp, url_prefix='/')

    # === 根目錄導向至 APPLICATION_ROOT (/) ===
    @app.route('/')
    def root_redirect():
        root = app.config.get('APPLICATION_ROOT', '/') or '/'
        if not root.startswith('/'):
            root = '/' + root
        return redirect(root)

    return app
