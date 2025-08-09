#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速检查处理进度脚本
"""

import os
from supabase import create_client, Client

def check_progress():
    """检查当前处理进度"""
    try:
        # 从config.py导入配置
        import config
        supabase_url = config.SUPABASE_URL
        supabase_key = config.SUPABASE_ANON_KEY
        
        # 初始化客户端
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # 获取总记录数
        total_response = supabase.table('illustrations_optimized') \
            .select('id', count='exact') \
            .not_.is_('original_description', 'null') \
            .execute()
        total_records = total_response.count or 0
        
        # 获取已处理记录数
        processed_response = supabase.table('illustrations_optimized') \
            .select('id', count='exact') \
            .not_.is_('theme_philosophy', 'null') \
            .execute()
        processed_records = processed_response.count or 0
        
        # 获取待处理记录数
        pending_records = total_records - processed_records
        
        # 计算进度
        progress_percentage = (processed_records / total_records * 100) if total_records > 0 else 0
        
        print("=" * 50)
        print("📊 绘本插图数据处理进度")
        print("=" * 50)
        print(f"总记录数:     {total_records:>6} 条")
        print(f"已处理:       {processed_records:>6} 条")
        print(f"待处理:       {pending_records:>6} 条")
        print(f"完成进度:     {progress_percentage:>6.1f}%")
        print("=" * 50)
        
        if pending_records > 0:
            print(f"⏳ 还需要处理 {pending_records} 条记录")
        else:
            print("🎉 所有记录已处理完成！")
            
    except Exception as e:
        print(f"❌ 检查进度失败: {e}")

if __name__ == "__main__":
    check_progress()