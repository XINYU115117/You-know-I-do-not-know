"""初始化 SQLite 数据库（幂等，可重复执行）。

db.py 首次连接会自动建表，此脚本只是显式初始化一次（可选）。
用法：python init_db.py
"""
import os

import db

if __name__ == "__main__":
    conn = db._connect()
    conn.close()
    print(f"SQLite 初始化完成: {db._db_path}")
