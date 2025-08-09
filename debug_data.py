#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试数据内容 - 查看实际数据库中的字段内容
"""

def check_actual_data():
    """检查数据库中实际的字段内容"""
    try:
        import config
        from supabase import create_client
        
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
        
        # 获取几条最新的记录
        response = supabase.table('illustrations_optimized') \
            .select('id, filename, theme_philosophy, action_process, interpersonal_roles, edu_value, learning_strategy, creative_play, scene_visuals, updated_at') \
            .not_.is_('theme_philosophy', 'null') \
            .order('updated_at', desc=True) \
            .limit(5) \
            .execute()
        
        records = response.data
        
        if not records:
            print("❌ 没有找到已处理的记录")
            return
        
        print(f"🔍 查看最新的 {len(records)} 条记录内容:")
        print("=" * 100)
        
        for i, record in enumerate(records):
            print(f"\n📝 记录 {i+1}: {record['id']}")
            print(f"文件名: {record.get('filename', 'N/A')}")
            print(f"更新时间: {record.get('updated_at', 'N/A')}")
            
            fields = ['theme_philosophy', 'action_process', 'interpersonal_roles', 
                     'edu_value', 'learning_strategy', 'creative_play', 'scene_visuals']
            
            for field in fields:
                content = record.get(field, '')
                if content:
                    # 显示前100个字符
                    preview = content[:100] + "..." if len(content) > 100 else content
                    print(f"\n{field}:")
                    print(f"  内容: {preview}")
                    print(f"  长度: {len(content)} 字符")
                    
                    # 检查是否包含新提示词的关键特征
                    new_indicators = {
                        'theme_philosophy': ['价值观', '人生态度', '世界观', '哲理'],
                        'action_process': ['动态行为', '挑战', '克服', '成长过程'],
                        'interpersonal_roles': ['人际关系', '情感连接', '亲子', '师生'],
                        'edu_value': ['教育意义', '品格塑造', '拓宽视野', '审美'],
                        'learning_strategy': ['学习方法', '观察', '提问', '对比'],
                        'creative_play': ['创意游戏', '想象力', '创造力', '幻想'],
                        'scene_visuals': ['场景', '氛围', '视觉', '色彩', '光线']
                    }
                    
                    if field in new_indicators:
                        matched = [kw for kw in new_indicators[field] if kw in content]
                        if matched:
                            print(f"  ✅ 匹配关键词: {matched}")
                        else:
                            print(f"  ❌ 未匹配任何关键词")
                            
                    # 检查旧提示词特征
                    old_indicators = ['根据上述指南分析得出', '从文本中提炼出', '在此填写']
                    old_found = [ind for ind in old_indicators if ind in content]
                    if old_found:
                        print(f"  ⚠️  发现旧格式: {old_found}")
                else:
                    print(f"\n{field}: [空]")
            
            print("\n" + "-" * 80)
        
        # 统计信息
        print(f"\n📊 快速统计:")
        
        # 检查是否真的有记录被更新
        total_response = supabase.table('illustrations_optimized') \
            .select('id', count='exact') \
            .not_.is_('theme_philosophy', 'null') \
            .execute()
        
        processed_count = total_response.count or 0
        print(f"已处理记录总数: {processed_count}")
        
        # 检查最近更新的记录
        from datetime import datetime, timedelta
        today = datetime.now().date()
        
        recent_response = supabase.table('illustrations_optimized') \
            .select('id, updated_at') \
            .not_.is_('theme_philosophy', 'null') \
            .gte('updated_at', today.isoformat()) \
            .execute()
        
        recent_count = len(recent_response.data) if recent_response.data else 0
        print(f"今日更新记录数: {recent_count}")
        
        if recent_count == 0:
            print("⚠️  今日没有记录被更新，可能强制更新脚本没有运行成功")
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")

def check_simple_update_log():
    """检查简单更新脚本的日志"""
    import os
    
    log_file = 'simple_force_update.log'
    if not os.path.exists(log_file):
        print(f"❌ 日志文件 {log_file} 不存在")
        print("这意味着 simple_force_update.py 可能没有运行过")
        return
    
    print(f"📄 检查 {log_file} 日志文件...")
    
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        if not lines:
            print("❌ 日志文件为空")
            return
        
        print(f"日志文件包含 {len(lines)} 行")
        
        # 查找关键信息
        success_count = 0
        error_count = 0
        processed_count = 0
        
        for line in lines:
            if "处理完成" in line:
                success_count += 1
            elif "ERROR" in line:
                error_count += 1
            elif "正在处理记录ID:" in line:
                processed_count += 1
        
        print(f"处理的记录数: {processed_count}")
        print(f"成功处理数: {success_count}")
        print(f"错误数: {error_count}")
        
        # 显示最后几行日志
        print(f"\n📝 最后5行日志:")
        for line in lines[-5:]:
            print(f"  {line.strip()}")
        
        if processed_count == 0:
            print("⚠️  日志显示没有处理任何记录，脚本可能有问题")
        
    except Exception as e:
        print(f"❌ 读取日志失败: {e}")

if __name__ == "__main__":
    print("🔍 数据调试工具")
    print("=" * 50)
    
    print("\n1️⃣ 检查数据库实际内容:")
    check_actual_data()
    
    print("\n2️⃣ 检查更新脚本日志:")
    check_simple_update_log()
    
    print(f"\n💡 诊断建议:")
    print(f"   - 如果今日更新记录数为0，说明强制更新脚本没有成功运行")
    print(f"   - 如果字段内容很短且无关键词，说明API返回质量有问题") 
    print(f"   - 如果发现旧格式特征，说明使用了旧提示词")