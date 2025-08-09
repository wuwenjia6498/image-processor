#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查是否有重复处理的问题
"""

import os
from datetime import datetime, timedelta

def check_processing_log():
    """检查日志中是否有重复处理同一记录的情况"""
    
    if not os.path.exists('illustration_processing.log'):
        print("❌ 日志文件不存在")
        return
    
    print("🔍 检查是否存在重复处理...")
    
    try:
        with open('illustration_processing.log', 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # 统计每个记录ID被处理的次数
        processed_records = {}
        recent_processing = []
        
        # 只看最近的日志（最后500行）
        for line in lines[-500:]:
            if "正在处理记录ID:" in line:
                # 提取记录ID
                parts = line.split("正在处理记录ID: ")
                if len(parts) > 1:
                    record_id = parts[1].split(",")[0].strip()
                    
                    # 提取时间戳
                    timestamp_str = line.split(' - ')[0]
                    try:
                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S,%f')
                        recent_processing.append((record_id, timestamp))
                        
                        if record_id in processed_records:
                            processed_records[record_id] += 1
                        else:
                            processed_records[record_id] = 1
                    except:
                        pass
        
        # 检查重复处理
        duplicates = {k: v for k, v in processed_records.items() if v > 1}
        
        if duplicates:
            print(f"❌ 发现重复处理的记录:")
            for record_id, count in duplicates.items():
                print(f"   记录 {record_id}: 处理了 {count} 次")
            
            print(f"\n📊 统计:")
            print(f"   总处理次数: {sum(processed_records.values())}")
            print(f"   唯一记录数: {len(processed_records)}")
            print(f"   重复记录数: {len(duplicates)}")
            
            # 检查最近是否还在重复处理
            now = datetime.now()
            recent_duplicates = []
            for record_id, timestamp in recent_processing[-20:]:  # 最近20次处理
                if record_id in duplicates:
                    recent_duplicates.append((record_id, timestamp))
            
            if recent_duplicates:
                print(f"\n⚠️  最近仍在重复处理以下记录:")
                for record_id, timestamp in recent_duplicates[-5:]:
                    print(f"   {record_id} 在 {timestamp.strftime('%H:%M:%S')} 被处理")
                
                print(f"\n💡 建议:")
                print(f"   1. 停止当前脚本 (Ctrl+C)")
                print(f"   2. 运行正常模式: python process_illustrations_data.py")
                print(f"   3. 避免使用 --force-update 参数")
            
        else:
            print("✅ 没有发现重复处理的记录")
            
            if recent_processing:
                print(f"\n📊 最近处理情况:")
                print(f"   最近处理了 {len(recent_processing)} 次")
                print(f"   涉及 {len(set(r[0] for r in recent_processing))} 个不同记录")
                
                if len(recent_processing) > 0:
                    latest = recent_processing[-1][1]
                    print(f"   最后处理时间: {latest.strftime('%Y-%m-%d %H:%M:%S')}")
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")

def check_current_status():
    """检查当前处理状态"""
    try:
        import config
        from supabase import create_client
        
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
        
        # 检查正常模式下还有多少待处理
        pending_response = supabase.table('illustrations_optimized') \
            .select('id', count='exact') \
            .is_('theme_philosophy', 'null') \
            .execute()
        
        pending_count = pending_response.count or 0
        
        print(f"\n📊 当前状态:")
        print(f"   正常模式待处理: {pending_count} 条")
        
        if pending_count == 0:
            print("   ✅ 所有记录已处理完成!")
            print("   💡 如果脚本还在运行，可能是在做无效的重复处理")
        else:
            print(f"   ⏳ 建议运行正常模式完成剩余 {pending_count} 条记录")
            
    except Exception as e:
        print(f"❌ 状态检查失败: {e}")

if __name__ == "__main__":
    print("🔍 重复处理检查工具")
    print("=" * 50)
    
    check_processing_log()
    check_current_status()
    
    print("\n🎯 如果发现重复处理问题:")
    print("   1. 立即停止当前脚本 (Ctrl+C)")
    print("   2. 运行: python process_illustrations_data.py")
    print("   3. 不要使用 --force-update 参数")