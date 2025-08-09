#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查数据是否按照新的提示词要求更新
"""

import json
from datetime import datetime

def analyze_field_quality(text: str, field_name: str) -> dict:
    """分析字段内容质量"""
    if not text or text.strip() == "":
        return {"quality": "empty", "issues": ["字段为空"]}
    
    text = text.strip()
    issues = []
    
    # 检查是否是占位符或过于简单
    placeholders = [
        "根据上述指南分析得出",
        "从文本中提炼出",
        "待分析",
        "无法确定",
        "不明确",
        "无相关信息"
    ]
    
    if any(placeholder in text for placeholder in placeholders):
        issues.append("包含占位符文本")
    
    # 检查长度
    if len(text) < 10:
        issues.append("内容过短")
    elif len(text) > 500:
        issues.append("内容过长")
    
    # 根据字段类型检查特定内容
    field_keywords = {
        'theme_philosophy': ['价值观', '人生', '世界观', '哲理', '意义', '态度', '美的', '幸福'],
        'action_process': ['行为', '挑战', '克服', '成长', '探索', '坚持', '努力', '过程'],
        'interpersonal_roles': ['关系', '情感', '亲子', '师生', '朋友', '关爱', '支持', '引导', '陪伴'],
        'edu_value': ['教育', '品格', '视野', '审美', '塑造', '培养', '学习', '发展'],
        'learning_strategy': ['学习', '方法', '观察', '提问', '对比', '输出', '角色扮演', '策略'],
        'creative_play': ['游戏', '幻想', '创造', '想象', '创意', '玩法', '角色扮演', '激发'],
        'scene_visuals': ['场景', '氛围', '视觉', '色彩', '光线', '风格', '季节', '天气', '室内', '室外']
    }
    
    if field_name in field_keywords:
        keywords = field_keywords[field_name]
        if not any(keyword in text for keyword in keywords):
            issues.append(f"缺少{field_name}相关关键词")
    
    # 质量评级
    if not issues:
        quality = "good"
    elif len(issues) == 1 and issues[0] in ["内容过长", "内容过短"]:
        quality = "fair"
    else:
        quality = "poor"
    
    return {"quality": quality, "issues": issues, "length": len(text)}

def check_data_quality():
    """检查数据库中记录的质量"""
    try:
        import config
        from supabase import create_client
        
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
        
        # 获取所有已处理的记录
        response = supabase.table('illustrations_optimized') \
            .select('id, filename, theme_philosophy, action_process, interpersonal_roles, edu_value, learning_strategy, creative_play, scene_visuals, updated_at') \
            .not_.is_('theme_philosophy', 'null') \
            .order('updated_at', desc=True) \
            .execute()
        
        records = response.data
        
        if not records:
            print("❌ 没有找到已处理的记录")
            return
        
        print(f"📊 分析 {len(records)} 条已处理记录的质量...")
        print("=" * 80)
        
        # 统计数据
        total_records = len(records)
        field_stats = {}
        quality_stats = {"good": 0, "fair": 0, "poor": 0, "empty": 0}
        recent_records = 0
        old_format_records = 0
        
        # 定义新旧提示词的分界时间（假设是今天）
        today = datetime.now().date()
        
        for i, record in enumerate(records):
            record_id = record['id']
            filename = record['filename']
            updated_at = record.get('updated_at')
            
            # 检查更新时间
            is_recent = False
            if updated_at:
                try:
                    update_time = datetime.fromisoformat(updated_at.replace('Z', '+00:00')).date()
                    is_recent = update_time >= today
                    if is_recent:
                        recent_records += 1
                except:
                    pass
            
            print(f"\n📝 记录 {i+1}/{total_records}: {record_id}")
            print(f"   文件名: {filename}")
            print(f"   更新时间: {updated_at}")
            print(f"   {'🆕 今日更新' if is_recent else '📅 较早更新'}")
            
            record_quality_issues = []
            
            # 分析每个字段
            fields = ['theme_philosophy', 'action_process', 'interpersonal_roles', 
                     'edu_value', 'learning_strategy', 'creative_play', 'scene_visuals']
            
            for field in fields:
                content = record.get(field, '')
                analysis = analyze_field_quality(content, field)
                
                if field not in field_stats:
                    field_stats[field] = {"good": 0, "fair": 0, "poor": 0, "empty": 0}
                
                field_stats[field][analysis["quality"]] += 1
                quality_stats[analysis["quality"]] += 1
                
                # 显示字段分析结果
                quality_icon = {"good": "✅", "fair": "⚠️", "poor": "❌", "empty": "🔴"}
                print(f"   {quality_icon[analysis['quality']]} {field}: {analysis['quality']} ({analysis['length']}字)")
                
                if analysis["issues"]:
                    print(f"      问题: {', '.join(analysis['issues'])}")
                    record_quality_issues.extend(analysis["issues"])
                
                # 显示内容预览
                if content and len(content) > 50:
                    print(f"      预览: {content[:50]}...")
                elif content:
                    print(f"      内容: {content}")
            
            # 判断是否可能是旧格式
            if len(record_quality_issues) >= 3:
                old_format_records += 1
                print(f"   ⚠️  疑似旧格式记录（问题较多）")
            
            # 只显示前10条详细信息
            if i >= 9:
                print(f"\n... (显示前10条详细信息，共{total_records}条)")
                break
        
        # 总结报告
        print("\n" + "=" * 80)
        print("📊 质量分析报告")
        print("=" * 80)
        
        print(f"📈 总体统计:")
        print(f"   总记录数: {total_records}")
        print(f"   今日更新: {recent_records}")
        print(f"   疑似旧格式: {old_format_records}")
        
        print(f"\n📊 字段质量分布:")
        total_fields = sum(quality_stats.values())
        for quality, count in quality_stats.items():
            percentage = (count / total_fields * 100) if total_fields > 0 else 0
            quality_icon = {"good": "✅", "fair": "⚠️", "poor": "❌", "empty": "🔴"}
            print(f"   {quality_icon[quality]} {quality}: {count} ({percentage:.1f}%)")
        
        print(f"\n📋 各字段质量:")
        for field, stats in field_stats.items():
            total_field = sum(stats.values())
            good_rate = (stats["good"] / total_field * 100) if total_field > 0 else 0
            print(f"   {field}: {good_rate:.1f}% 优质")
        
        # 建议
        print(f"\n💡 建议:")
        if old_format_records > total_records * 0.3:
            print(f"   ❗ 发现 {old_format_records} 条疑似旧格式记录，建议重新处理")
            print(f"   🔄 运行: python process_illustrations_data.py --force-update")
        elif recent_records < total_records * 0.5:
            print(f"   ⚠️  大部分记录更新时间较早，可能未使用新提示词")
            print(f"   🔄 建议运行: python process_illustrations_data.py --force-update")
        else:
            print(f"   ✅ 大部分记录质量良好，符合新提示词要求")
        
        if quality_stats["poor"] + quality_stats["empty"] > total_fields * 0.2:
            print(f"   ⚠️  发现较多质量问题，建议检查API配置和网络连接")
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")

def check_specific_record(record_id: str = None):
    """检查特定记录的详细内容"""
    if not record_id:
        print("请提供要检查的记录ID")
        return
    
    try:
        import config
        from supabase import create_client
        
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
        
        response = supabase.table('illustrations_optimized') \
            .select('*') \
            .eq('id', record_id) \
            .execute()
        
        if not response.data:
            print(f"❌ 未找到记录 {record_id}")
            return
        
        record = response.data[0]
        
        print(f"🔍 详细检查记录: {record_id}")
        print(f"文件名: {record.get('filename', 'N/A')}")
        print(f"更新时间: {record.get('updated_at', 'N/A')}")
        print("\n原始描述:")
        print(f"   {record.get('original_description', 'N/A')}")
        
        fields = ['theme_philosophy', 'action_process', 'interpersonal_roles', 
                 'edu_value', 'learning_strategy', 'creative_play', 'scene_visuals']
        
        for field in fields:
            content = record.get(field, '')
            analysis = analyze_field_quality(content, field)
            quality_icon = {"good": "✅", "fair": "⚠️", "poor": "❌", "empty": "🔴"}
            
            print(f"\n{quality_icon[analysis['quality']]} {field}:")
            print(f"   内容: {content}")
            if analysis["issues"]:
                print(f"   问题: {', '.join(analysis['issues'])}")
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")

if __name__ == "__main__":
    import sys
    
    print("🔍 数据质量检查工具")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        # 检查特定记录
        record_id = sys.argv[1]
        check_specific_record(record_id)
    else:
        # 检查所有记录
        check_data_quality()
    
    print(f"\n使用方法:")
    print(f"   检查所有记录: python check_prompt_quality.py")
    print(f"   检查特定记录: python check_prompt_quality.py <record_id>")