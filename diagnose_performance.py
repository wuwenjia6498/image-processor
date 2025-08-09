#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
性能诊断脚本 - 分析处理速度瓶颈
"""

import time
import os
from datetime import datetime

def test_api_speed():
    """测试API响应速度"""
    print("🔍 开始API性能测试...")
    
    try:
        # 导入配置
        import config
        from openai import OpenAI
        from supabase import create_client
        
        # 初始化客户端
        if hasattr(config, 'OPENAI_BASE_URL'):
            openai_client = OpenAI(api_key=config.OPENAI_API_KEY, base_url=config.OPENAI_BASE_URL)
        else:
            openai_client = OpenAI(api_key=config.OPENAI_API_KEY)
        
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
        
        # 测试1: GPT-4o响应速度
        print("📝 测试GPT-4o响应速度...")
        start_time = time.time()
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-2024-11-20",
            messages=[
                {"role": "system", "content": "你是一个测试助手。"},
                {"role": "user", "content": "请简短回复：测试"}
            ],
            max_tokens=10
        )
        
        gpt_time = time.time() - start_time
        print(f"   ✅ GPT-4o响应时间: {gpt_time:.2f}秒")
        
        # 测试2: Embedding响应速度
        print("🔢 测试Embedding响应速度...")
        start_time = time.time()
        
        embedding_response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=["测试文本"],
            encoding_format="float"
        )
        
        embedding_time = time.time() - start_time
        print(f"   ✅ Embedding响应时间: {embedding_time:.2f}秒")
        
        # 测试3: Supabase查询速度
        print("🗄️  测试Supabase查询速度...")
        start_time = time.time()
        
        query_response = supabase.table('illustrations_optimized') \
            .select('id, filename') \
            .limit(1) \
            .execute()
        
        db_query_time = time.time() - start_time
        print(f"   ✅ 数据库查询时间: {db_query_time:.2f}秒")
        
        # 测试4: Supabase更新速度
        if query_response.data:
            print("💾 测试Supabase更新速度...")
            start_time = time.time()
            
            test_id = query_response.data[0]['id']
            update_response = supabase.table('illustrations_optimized') \
                .update({'updated_at': datetime.now().isoformat()}) \
                .eq('id', test_id) \
                .execute()
            
            db_update_time = time.time() - start_time
            print(f"   ✅ 数据库更新时间: {db_update_time:.2f}秒")
        else:
            db_update_time = 0
            print("   ⚠️  无法测试数据库更新（没有数据）")
        
        # 总结
        total_time = gpt_time + embedding_time + db_query_time + db_update_time
        print("\n📊 性能测试结果:")
        print(f"   GPT-4o分析:     {gpt_time:.2f}秒")
        print(f"   向量生成:       {embedding_time:.2f}秒")
        print(f"   数据库查询:     {db_query_time:.2f}秒")
        print(f"   数据库更新:     {db_update_time:.2f}秒")
        print(f"   总计(单条):     {total_time:.2f}秒")
        print(f"   预计190条:      {total_time * 190 / 60:.1f}分钟")
        
        # 问题诊断
        print("\n🔍 问题诊断:")
        if gpt_time > 10:
            print("   ❌ GPT-4o响应过慢，可能是API服务商问题")
        if embedding_time > 5:
            print("   ❌ Embedding响应过慢，可能是API服务商问题")
        if db_query_time > 2:
            print("   ❌ 数据库查询过慢，可能是网络问题")
        if db_update_time > 3:
            print("   ❌ 数据库更新过慢，可能是网络问题")
        if total_time > 15:
            print("   ❌ 单条处理时间过长，建议检查网络和API服务")
        else:
            print("   ✅ API响应速度正常")
            
    except Exception as e:
        print(f"❌ 性能测试失败: {e}")

def check_log_file():
    """检查日志文件中的处理时间"""
    print("\n📄 分析处理日志...")
    
    try:
        if not os.path.exists('illustration_processing.log'):
            print("   ⚠️  日志文件不存在")
            return
            
        with open('illustration_processing.log', 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # 查找最近的处理记录
        processing_times = []
        current_record_start = None
        
        for line in lines[-100:]:  # 只看最后100行
            if "正在处理记录ID:" in line:
                # 提取时间戳
                timestamp_str = line.split(' - ')[0]
                try:
                    current_record_start = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S,%f')
                except:
                    pass
            elif "处理完成" in line and current_record_start:
                timestamp_str = line.split(' - ')[0]
                try:
                    end_time = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S,%f')
                    duration = (end_time - current_record_start).total_seconds()
                    processing_times.append(duration)
                    current_record_start = None
                except:
                    pass
        
        if processing_times:
            avg_time = sum(processing_times) / len(processing_times)
            print(f"   📊 最近{len(processing_times)}条记录平均处理时间: {avg_time:.1f}秒")
            print(f"   ⏱️  按此速度处理190条需要: {avg_time * 190 / 60:.1f}分钟")
            
            if avg_time > 30:
                print("   ❌ 处理速度异常缓慢！")
            elif avg_time > 15:
                print("   ⚠️  处理速度偏慢")
            else:
                print("   ✅ 处理速度正常")
        else:
            print("   ⚠️  无法从日志中提取处理时间")
            
    except Exception as e:
        print(f"   ❌ 日志分析失败: {e}")

if __name__ == "__main__":
    print("🚀 开始性能诊断...")
    print("=" * 60)
    
    test_api_speed()
    check_log_file()
    
    print("\n💡 优化建议:")
    print("   1. 如果API响应慢，考虑更换API服务商")
    print("   2. 如果网络慢，考虑使用VPN或更换网络")
    print("   3. 如果数据库慢，检查Supabase区域设置")
    print("   4. 可以尝试减少batch_size从20降到10")
    print("\n运行: python check_progress.py 查看当前进度")