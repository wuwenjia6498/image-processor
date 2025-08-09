#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
安全的强制更新脚本 - 避免重复处理问题
通过临时标记字段来确保每条记录只处理一次
"""

import os
import json
import time
import logging
from typing import List, Dict, Optional
from datetime import datetime
import uuid

# 第三方库导入
import openai
from supabase import create_client, Client
from openai import OpenAI

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('safe_update.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SafeForceUpdater:
    """安全的强制更新器"""
    
    def __init__(self):
        """初始化"""
        self.setup_clients()
        self.batch_size = 10
        self.session_id = str(uuid.uuid4())[:8]  # 本次运行的唯一标识
        
        # 定义7个主题字段
        self.theme_fields = [
            'theme_philosophy',
            'action_process', 
            'interpersonal_roles',
            'edu_value',
            'learning_strategy',
            'creative_play',
            'scene_visuals'
        ]
        
        # 对应的向量字段
        self.embedding_fields = [f"{field}_embedding" for field in self.theme_fields]
        
    def setup_clients(self):
        """设置Supabase和OpenAI客户端"""
        try:
            import config
            supabase_url = config.SUPABASE_URL
            supabase_key = config.SUPABASE_ANON_KEY
            openai_api_key = config.OPENAI_API_KEY
            
            # 初始化客户端
            self.supabase: Client = create_client(supabase_url, supabase_key)
            
            # 初始化OpenAI客户端，支持自定义base_url
            if hasattr(config, 'OPENAI_BASE_URL'):
                self.openai_client = OpenAI(api_key=openai_api_key, base_url=config.OPENAI_BASE_URL)
                logger.info(f"使用自定义OpenAI API地址: {config.OPENAI_BASE_URL}")
            else:
                self.openai_client = OpenAI(api_key=openai_api_key)
            
            logger.info("客户端初始化成功")
        except Exception as e:
            logger.error(f"客户端初始化失败: {e}")
            raise
    
    def mark_processing_start(self):
        """标记开始处理 - 添加临时字段"""
        logger.info("准备开始安全强制更新...")
        
        try:
            # 统计需要处理的记录
            response = self.supabase.table('illustrations_optimized') \
                .select('id', count='exact') \
                .not_.is_('original_description', 'null') \
                .execute()
            
            total_count = response.count or 0
            logger.info(f"总共需要处理 {total_count} 条记录")
            
            return total_count
            
        except Exception as e:
            logger.error(f"标记处理开始失败: {e}")
            return 0
    
    def get_next_batch(self) -> List[Dict]:
        """获取下一批待处理记录"""
        try:
            # 获取还没有处理标记的记录
            response = self.supabase.table('illustrations_optimized') \
                .select('id, filename, original_description') \
                .not_.is_('original_description', 'null') \
                .is_('processing_session', 'null') \
                .limit(self.batch_size) \
                .execute()
            
            records = response.data
            
            if records:
                # 标记这批记录正在处理
                record_ids = [r['id'] for r in records]
                self.supabase.table('illustrations_optimized') \
                    .update({'processing_session': self.session_id}) \
                    .in_('id', record_ids) \
                    .execute()
                
                logger.info(f"获取并标记了 {len(records)} 条记录")
            
            return records
            
        except Exception as e:
            logger.error(f"获取记录失败: {e}")
            return []
    
    def analyze_with_gpt4(self, description: str) -> Optional[Dict]:
        """使用GPT-4o分析描述文本，提取7个主题字段"""
        
        prompt = f"""目标：请你扮演一位资深的文本分析和信息提取专家。你的任务是深入分析我提供的这段关于绘本插图的详细描述文字，并从中提取关键信息，为一个JSON对象中的7个核心字段填充内容。

输入：一段关于绘本插图的详细描述文字。

字段填写指南：
- theme_philosophy (核心哲理与人生主题)：分析画面传递的静态价值观、人生态度、世界观等。例如：对美的看法、生活的意义、幸福的定义。
- action_process (行动过程与成长)：分析画面中角色的动态行为。描述他们正在做什么、经历什么挑战、如何克服，以及这个过程带来的成长。例如：探索、坚持、犯错、努力。
- interpersonal_roles (人际角色与情感连接)：分析画面中人物之间的关系和情感。是亲子、师生还是朋友？他们之间的互动是关爱、支持、引导还是陪伴？
- edu_value (阅读教育价值)：如果插图来自一本书，思考这本书能带给孩子的宏观教育意义。它如何塑造品格、拓宽视野、培养审美？
- learning_strategy (阅读学习策略)：分析画面中是否展现或暗示了具体的学习方法。例如：观察、提问、对比、输出、角色扮演等。
- creative_play (创意玩法与想象力)：分析画面中的游戏、幻想、角色扮演等元素。它如何激发孩子的创造力和想象力？
- scene_visuals (场景氛围与视觉元素)：描述画面的物理信息。包括场景（室内/外）、季节、天气、光线、色彩运用、艺术风格以及营造出的整体氛围（温馨、宁静、热闹、神秘等）。

输出格式要求：严格按照以下JSON格式输出，不要添加任何额外的解释或说明文字。

{{
  "theme_philosophy": "根据上述指南分析得出的核心哲理与人生主题",
  "action_process": "根据上述指南分析得出的行动过程与成长",
  "interpersonal_roles": "根据上述指南分析得出的人际角色与情感连接",
  "edu_value": "根据上述指南分析得出的阅读教育价值",
  "learning_strategy": "根据上述指南分析得出的阅读学习策略",
  "creative_play": "根据上述指南分析得出的创意玩法与想象力",
  "scene_visuals": "根据上述指南分析得出的场景氛围与视觉元素"
}}

待分析的描述文字：
{description}"""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-2024-11-20",
                messages=[
                    {
                        "role": "system",
                        "content": "你是一位专业的文本分析专家，擅长从绘本插图描述中提取深层含义。请严格按照JSON格式返回结果。"
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=1500
            )
            
            # 解析JSON响应
            content = response.choices[0].message.content.strip()
            
            # 移除可能的markdown代码块标记
            if content.startswith('```json'):
                content = content[7:]
            if content.endswith('```'):
                content = content[:-3]
            
            return json.loads(content)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {e}, 原始内容: {content}")
            return None
        except Exception as e:
            logger.error(f"GPT-4分析失败: {e}")
            return None
    
    def generate_embeddings(self, texts: List[str]) -> Optional[List[List[float]]]:
        """为文本列表生成向量嵌入"""
        try:
            # 过滤空文本
            valid_texts = [text for text in texts if text and text.strip()]
            if not valid_texts:
                return None
                
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=valid_texts,
                encoding_format="float"
            )
            
            embeddings = [embedding.embedding for embedding in response.data]
            return embeddings
            
        except Exception as e:
            logger.error(f"向量生成失败: {e}")
            return None
    
    def update_record(self, record_id: str, theme_data: Dict, embeddings: List[List[float]]) -> bool:
        """更新数据库记录并清除处理标记"""
        try:
            # 准备更新数据
            update_data = {}
            
            # 添加文本字段
            for field in self.theme_fields:
                if field in theme_data:
                    update_data[field] = theme_data[field]
            
            # 添加向量字段
            for i, embedding_field in enumerate(self.embedding_fields):
                if i < len(embeddings):
                    update_data[embedding_field] = embeddings[i]
            
            # 更新时间戳和清除处理标记
            update_data['updated_at'] = datetime.now().isoformat()
            update_data['processing_session'] = None  # 清除处理标记
            
            # 执行更新
            response = self.supabase.table('illustrations_optimized') \
                .update(update_data) \
                .eq('id', record_id) \
                .execute()
            
            return len(response.data) > 0
            
        except Exception as e:
            logger.error(f"更新记录失败 (ID: {record_id}): {e}")
            return False
    
    def process_single_record(self, record: Dict) -> bool:
        """处理单条记录"""
        record_id = record['id']
        filename = record['filename']
        description = record['original_description']
        
        logger.info(f"正在处理记录ID: {record_id}, 文件名: {filename}")
        
        # 检查描述是否存在
        if not description or not description.strip():
            logger.warning(f"记录 {record_id} 的原始描述为空，跳过处理")
            return False
        
        # 1. 使用GPT-4分析文本
        logger.info(f"  → 正在调用GPT-4o分析文本...")
        theme_data = self.analyze_with_gpt4(description)
        if not theme_data:
            logger.error(f"  → GPT-4分析失败，跳过记录 {record_id}")
            return False
        
        # 2. 生成向量嵌入
        logger.info(f"  → 正在生成向量嵌入...")
        texts_for_embedding = [theme_data.get(field, '') for field in self.theme_fields]
        embeddings = self.generate_embeddings(texts_for_embedding)
        if not embeddings:
            logger.error(f"  → 向量生成失败，跳过记录 {record_id}")
            return False
        
        # 3. 更新数据库
        logger.info(f"  → 正在更新数据库...")
        success = self.update_record(record_id, theme_data, embeddings)
        
        if success:
            logger.info(f"  ✓ 记录 {record_id} 处理完成")
            return True
        else:
            logger.error(f"  ✗ 记录 {record_id} 更新失败")
            return False
    
    def cleanup_processing_marks(self):
        """清理处理标记（在异常情况下使用）"""
        try:
            self.supabase.table('illustrations_optimized') \
                .update({'processing_session': None}) \
                .eq('processing_session', self.session_id) \
                .execute()
            logger.info("已清理处理标记")
        except Exception as e:
            logger.error(f"清理处理标记失败: {e}")
    
    def run(self):
        """运行安全强制更新"""
        logger.info("🚀 开始安全强制更新（使用新提示词重新处理所有记录）")
        
        total_records = self.mark_processing_start()
        if total_records == 0:
            logger.info("没有需要处理的记录")
            return
        
        total_processed = 0
        total_success = 0
        start_time = time.time()
        
        try:
            while True:
                # 获取下一批记录
                records = self.get_next_batch()
                
                if not records:
                    logger.info("✅ 所有记录处理完成！")
                    break
                
                logger.info(f"开始处理批次：{len(records)} 条记录")
                
                # 处理当前批次
                batch_success = 0
                for record in records:
                    try:
                        if self.process_single_record(record):
                            batch_success += 1
                            total_success += 1
                        
                        total_processed += 1
                        
                        # 进度显示
                        progress = (total_processed / total_records * 100) if total_records > 0 else 0
                        elapsed = time.time() - start_time
                        if total_processed > 0:
                            avg_time = elapsed / total_processed
                            remaining_time = (total_records - total_processed) * avg_time / 60
                            logger.info(f"📊 进度: {total_processed}/{total_records} ({progress:.1f}%) "
                                      f"成功: {total_success} 预计剩余: {remaining_time:.1f}分钟")
                        
                        # 添加延迟
                        time.sleep(0.2)
                        
                    except Exception as e:
                        logger.error(f"处理记录时发生错误: {e}")
                        continue
                
                logger.info(f"批次完成: {batch_success}/{len(records)} 成功")
                time.sleep(1)  # 批次间休息
                
        except KeyboardInterrupt:
            logger.info("用户中断处理")
            self.cleanup_processing_marks()
        except Exception as e:
            logger.error(f"处理过程中发生错误: {e}")
            self.cleanup_processing_marks()
        
        elapsed_time = time.time() - start_time
        logger.info(f"🎉 处理完成！总计: {total_processed} 条，成功: {total_success} 条")
        logger.info(f"⏱️  总用时: {elapsed_time/60:.1f}分钟")

def main():
    """主函数"""
    try:
        updater = SafeForceUpdater()
        updater.run()
    except KeyboardInterrupt:
        logger.info("用户中断程序")
    except Exception as e:
        logger.error(f"程序运行出错: {e}")

if __name__ == "__main__":
    main()