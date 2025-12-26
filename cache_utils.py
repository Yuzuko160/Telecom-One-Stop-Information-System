import os
import logging

# === 全局快取字典 ===
_map_cache = {}
_excel_cache = {}

def reset_excel_cache(filepath=None):
    global _excel_cache, _map_cache

    if not isinstance(_excel_cache, dict):
        _excel_cache = {}
        logging.warning("Excel 快取字典無效，已重新初始化")

    if not isinstance(_map_cache, dict):
        _map_cache = {}
        logging.warning("地圖 Excel 快取字典無效，已重新初始化")

    abs_filepath = os.path.abspath(filepath) if filepath else None

    if abs_filepath:
        _excel_cache.pop(abs_filepath, None)
        _map_cache.pop(abs_filepath, None)
        logging.info(f"已重置快取：{abs_filepath}")
    else:
        _excel_cache.clear()
        _map_cache.clear()
        logging.info("已重置所有 Excel 快取與地圖快取")
