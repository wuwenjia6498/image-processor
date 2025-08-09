#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查是否使用了新的详细提示词生成字段
通过分析字段内容的特征来判断是否符合新提示词的要求
"""

import re
from datetime import datetime, timedelta

def analyze_prompt_version(record: dict) -> dict:
    """分析记录是否使用了新提示词"""
    
    # 新提示词的特征关键词（更宽松的匹配）
    new_prompt_indicators = {
        'theme_philosophy': [
            '价值观', '人生态度', '世界观', '哲理', '人生主题', '对美的看法', 
            '生活的意义', '幸福的定义', '静态价值观', '人生观', '成长', '思考',
            '重要性', '力量', '渴望', '矛盾', '支持', '权衡', '接纳', '探索'
        ],
        'action_process': [
            '动态行为', '经历什么挑战', '如何克服', '成长过程', '探索过程',
            '坚持不懈', '犯错学习', '努力奋斗', '行为表现', '挑战应对',
            '展现', '表达', '变化', '归家', '期待', '过程', '动作', '手势'
        ],
        'interpersonal_roles': [
            '人际关系', '情感连接', '亲子关系', '师生关系', '朋友关系',
            '关爱互动', '支持陪伴', '引导教育', '情感交流', '角色互动',
            '亲子', '关系', '连接', '互动', '角色', '关怀', '保护', '沟通'
        ],
        'edu_value': [
            '教育意义', '品格塑造', '拓宽视野', '培养审美', '宏观教育',
            '品格培养', '视野开阔', '审美教育', '教育价值', '成长启发',
            '培养', '理解', '帮助', '意识', '同情心', '责任感', '价值'
        ],
        'learning_strategy': [
            '学习方法', '观察能力', '提问技巧', '对比分析', '输出表达',
            '角色扮演', '学习策略', '认知方法', '思维训练', '学习技能',
            '观察', '学习', '理解', '表达', '沟通', '分析', '思考'
        ],
        'creative_play': [
            '创意游戏', '想象力', '创造力', '幻想世界', '角色扮演游戏',
            '创意表达', '想象空间', '创造性思维', '游戏化学习', '创意启发',
            '想象', '激发', '创造', '鼓励', '扮演', '探索'
        ],
        'scene_visuals': [
            '场景描述', '室内外环境', '季节特征', '天气状况', '光线效果',
            '色彩运用', '艺术风格', '整体氛围', '视觉元素', '环境营造',
            '场景', '氛围', '色彩', '视觉', '画面', '背景', '风格', '构图'
        ]
    }
    
    # 旧提示词的特征（简单、模糊的描述）
    old_prompt_indicators = [
        '从文本中提炼出', '根据上述指南分析得出', '在此填写',
        '描述了', '展现了', '体现了', '表达了', '反映了',
        '简单的', '基本的', '一般的', '普通的'
    ]
    
    analysis = {
        'is_new_prompt': True,
        'confidence': 0,
        'field_scores': {},
        'issues': [],
        'evidence': []
    }
    
    total_score = 0
    field_count = 0
    
    for field, keywords in new_prompt_indicators.items():
        content = record.get(field, '').strip()
        
        if not content:
            analysis['issues'].append(f"{field}字段为空")
            continue
            
        field_count += 1
        field_score = 0
        
        # 检查新提示词关键词
        matched_keywords = []
        for keyword in keywords:
            if keyword in content:
                field_score += 1
                matched_keywords.append(keyword)
        
        # 检查旧提示词特征
        old_indicators_found = []
        for indicator in old_prompt_indicators:
            if indicator in content:
                field_score -= 2  # 扣分
                old_indicators_found.append(indicator)
        
        # 长度和复杂性检查
        if len(content) < 20:
            field_score -= 1
            analysis['issues'].append(f"{field}内容过短")
        elif len(content) > 150:
            field_score += 1  # 详细内容加分
        
        # 具体性检查
        if any(word in content for word in ['具体', '详细', '深入', '丰富', '全面']):
            field_score += 1
        
        # 抽象性检查（旧提示词特征）
        if any(word in content for word in ['抽象', '模糊', '大概', '可能', '似乎']):
            field_score -= 1
        
        analysis['field_scores'][field] = {
            'score': field_score,
            'matched_keywords': matched_keywords,
            'old_indicators': old_indicators_found,
            'length': len(content)
        }
        
        total_score += field_score
        
        # 记录证据
        if matched_keywords:
            analysis['evidence'].append(f"{field}: 匹配关键词 {matched_keywords}")
        if old_indicators_found:
            analysis['evidence'].append(f"{field}: 发现旧格式特征 {old_indicators_found}")
    
    # 计算总体置信度
    if field_count > 0:
        avg_score = total_score / field_count
        analysis['confidence'] = max(0, min(100, (avg_score + 2) * 25))  # 转换为0-100的置信度
        analysis['is_new_prompt'] = avg_score > 0
    
    return analysis

def check_prompt_usage():
    """检查数据库中记录使用的提示词版本"""
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
        
        print(f"🔍 分析 {len(records)} 条记录的提示词版本...")
        print("=" * 80)
        
        # 统计数据
        new_prompt_count = 0
        old_prompt_count = 0
        uncertain_count = 0
        
        # 按时间分组
        today = datetime.now().date()
        recent_records = []
        old_records = []
        
        detailed_results = []
        
        for i, record in enumerate(records):
            analysis = analyze_prompt_version(record)
            
            # 时间分析
            is_recent = False
            if record.get('updated_at'):
                try:
                    update_time = datetime.fromisoformat(record['updated_at'].replace('Z', '+00:00')).date()
                    is_recent = update_time >= today
                    if is_recent:
                        recent_records.append((record, analysis))
                    else:
                        old_records.append((record, analysis))
                except:
                    pass
            
            # 分类统计
            if analysis['confidence'] >= 70:
                if analysis['is_new_prompt']:
                    new_prompt_count += 1
                    status = "🆕 新提示词"
                else:
                    old_prompt_count += 1
                    status = "📜 旧提示词"
            else:
                uncertain_count += 1
                status = "❓ 不确定"
            
            detailed_results.append({
                'record': record,
                'analysis': analysis,
                'status': status,
                'is_recent': is_recent
            })
            
            # 显示前15条详细结果
            if i < 15:
                print(f"\n📝 记录 {i+1}: {record['id']}")
                print(f"   文件: {record.get('filename', 'N/A')}")
                print(f"   时间: {record.get('updated_at', 'N/A')}")
                print(f"   状态: {status} (置信度: {analysis['confidence']:.1f}%)")
                
                if analysis['confidence'] < 50:
                    print(f"   ⚠️  问题: {', '.join(analysis['issues'][:3])}")
                
                # 显示字段得分
                high_score_fields = [k for k, v in analysis['field_scores'].items() if v['score'] >= 2]
                low_score_fields = [k for k, v in analysis['field_scores'].items() if v['score'] < 0]
                
                if high_score_fields:
                    print(f"   ✅ 高质量字段: {', '.join(high_score_fields)}")
                if low_score_fields:
                    print(f"   ❌ 低质量字段: {', '.join(low_score_fields)}")
        
        if len(records) > 15:
            print(f"\n... (显示前15条详细信息，共{len(records)}条)")
        
        # 总结报告
        print("\n" + "=" * 80)
        print("📊 提示词版本分析报告")
        print("=" * 80)
        
        total = len(records)
        print(f"📈 总体统计:")
        print(f"   总记录数: {total}")
        print(f"   🆕 新提示词: {new_prompt_count} ({new_prompt_count/total*100:.1f}%)")
        print(f"   📜 旧提示词: {old_prompt_count} ({old_prompt_count/total*100:.1f}%)")
        print(f"   ❓ 不确定: {uncertain_count} ({uncertain_count/total*100:.1f}%)")
        
        print(f"\n⏰ 时间分析:")
        print(f"   今日更新: {len(recent_records)} 条")
        print(f"   历史记录: {len(old_records)} 条")
        
        if recent_records:
            recent_new = sum(1 for _, analysis in recent_records if analysis['is_new_prompt'] and analysis['confidence'] >= 70)
            print(f"   今日新提示词比例: {recent_new}/{len(recent_records)} ({recent_new/len(recent_records)*100:.1f}%)")
        
        # 建议
        print(f"\n💡 建议:")
        if old_prompt_count > total * 0.3:
            print(f"   ❗ 发现 {old_prompt_count} 条使用旧提示词的记录")
            print(f"   🔄 强烈建议运行: python process_illustrations_data.py --force-update")
        elif uncertain_count > total * 0.2:
            print(f"   ⚠️  发现 {uncertain_count} 条质量不确定的记录")
            print(f"   🔍 建议检查API配置或重新处理部分记录")
        elif new_prompt_count > total * 0.8:
            print(f"   ✅ 大部分记录({new_prompt_count}/{total})已使用新提示词，质量良好")
        else:
            print(f"   🔄 建议运行强制更新以确保所有记录使用新提示词")
        
        # 显示需要重新处理的记录ID
        need_update = [r['record']['id'] for r in detailed_results 
                      if not r['analysis']['is_new_prompt'] or r['analysis']['confidence'] < 70]
        
        if need_update and len(need_update) <= 20:
            print(f"\n📋 需要重新处理的记录ID:")
            for record_id in need_update[:10]:
                print(f"   {record_id}")
            if len(need_update) > 10:
                print(f"   ... 还有{len(need_update)-10}条")
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")

if __name__ == "__main__":
    print("🔍 新提示词使用情况检查")
    print("=" * 50)
    
    check_prompt_usage()
    
    print(f"\n🎯 如果发现大量旧提示词记录:")
    print(f"   运行: python process_illustrations_data.py --force-update")
    print(f"   这将使用新的详细提示词重新处理所有记录")