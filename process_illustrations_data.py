#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
绘本插图数据处理脚本
功能：读取旧的描述文本，用AI分析填充7个主题字段，并生成对应的向量嵌入
作者：AI Assistant
"""

import os
import json
import time
import logging
from typing import List, Dict, Optional
from datetime import datetime

# 第三方库导入
import openai
from supabase import create_client, Client
from openai import OpenAI

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('illustration_processing.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class IllustrationProcessor:
    """绘本插图数据处理器"""
    
    def __init__(self):
        """初始化处理器，设置API客户端"""
        self.setup_clients()
        self.batch_size = 10  # 每批处理的记录数（减少批次大小提升稳定性）
        
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
        # 优先从环境变量获取配置，如果没有则从config.py获取
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')  # 或使用 SERVICE_ROLE_KEY
        openai_api_key = os.getenv('OPENAI_API_KEY')
        
        # 尝试从config.py导入配置（优先使用config.py中的配置）
        openai_base_url = None
        try:
            import config
            supabase_url = config.SUPABASE_URL
            supabase_key = config.SUPABASE_ANON_KEY
            openai_api_key = config.OPENAI_API_KEY
            # 检查是否有自定义的OpenAI Base URL
            if hasattr(config, 'OPENAI_BASE_URL'):
                openai_base_url = config.OPENAI_BASE_URL
            logger.info("从config.py文件加载配置")
        except ImportError:
            # 如果config.py不存在，使用环境变量
            logger.info("config.py不存在，使用环境变量")
            pass
        
        if not all([supabase_url, supabase_key, openai_api_key]):
            raise ValueError("请设置环境变量或在config.py中配置：SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY")
        
        # 初始化客户端
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # 初始化OpenAI客户端，支持自定义base_url
        if openai_base_url:
            self.openai_client = OpenAI(api_key=openai_api_key, base_url=openai_base_url)
            logger.info(f"使用自定义OpenAI API地址: {openai_base_url}")
        else:
            self.openai_client = OpenAI(api_key=openai_api_key)
        
        logger.info("客户端初始化成功")
    
    def get_pending_records(self, force_update: bool = False, processed_ids: set = None) -> List[Dict]:
        """获取待处理的记录"""
        try:
            if force_update:
                # 强制更新模式：获取所有有original_description的记录，但排除本次已处理的
                query = self.supabase.table('illustrations_optimized') \
                    .select('id, filename, original_description') \
                    .not_.is_('original_description', 'null')
                
                # 如果有已处理的ID列表，排除它们
                if processed_ids:
                    query = query.not_.in_('id', list(processed_ids))
                
                response = query.limit(self.batch_size).execute()
                
                if not processed_ids:  # 只在第一次显示
                    logger.info("强制更新模式：将重新处理所有记录")
            else:
                # 正常模式：只处理theme_philosophy为NULL的记录
                response = self.supabase.table('illustrations_optimized') \
                    .select('id, filename, original_description') \
                    .is_('theme_philosophy', 'null') \
                    .limit(self.batch_size) \
                    .execute()
            
            return response.data
        except Exception as e:
            logger.error(f"获取待处理记录失败: {e}")
            return []
    
    def analyze_with_gpt4(self, description: str) -> Optional[Dict]:
        """使用GPT-4o分析描述文本，提取7个主题字段"""
        
        prompt = f"""目标：请你扮演一位资深的文本分析和信息提取专家。你的任务是深入分析我提供的这段关于绘本插图的详细描述文字，并从中提取关键信息，为一个JSON对象中的7个核心字段填充内容。

输入：一段关于绘本插图的详细描述文字。

字段填写指南：
- theme_philosophy (核心理念与人生主题)：分析画面传递的静态价值观、人生态度、世界观等。例如：对美的看法、生活的意义、幸福的定义。
- action_process (行动过程与成长)：分析画面中角色的动态行为。描述他们正在做什么、经历什么挑战、如何克服，以及这个过程带来的成长。例如：探索、坚持、犯错、努力。
- interpersonal_roles (人际角色与情感连接)：分析画面中人物之间的关系和情感。是亲子、师生还是朋友？他们之间的互动是关爱、支持、引导还是陪伴？
- edu_value (阅读带来的价值)：思考这本书能带给孩子的宏观教育意义。它如何塑造品格、拓宽视野、培养审美？
- learning_strategy (阅读中的学习方法)：分析画面中是否展现或暗示了具体的学习方法。例如：观察、提问、对比、输出、角色扮演等。
- creative_play (创意表现与想象力)：分析画面中的游戏、幻想、角色扮演等元素。它如何激发孩子的创造力和想象力？
- scene_visuals (场景氛围与画面元素)：描述画面的物理信息。包括场景（室内/外）、季节、天气、光线、色彩运用、艺术风格以及营造出的整体氛围（温馨、宁静、热闹、神秘等）。

输出格式要求：严格按照以下JSON格式输出，不要添加任何额外的解释或说明文字。

{{
  "theme_philosophy": "根据上述指南分析得出的核心理念与人生主题",
  "action_process": "根据上述指南分析得出的行动过程与成长",
  "interpersonal_roles": "根据上述指南分析得出的人际角色与情感连接",
  "edu_value": "根据上述指南分析得出的阅读带来的价值",
  "learning_strategy": "根据上述指南分析得出的阅读中的学习方法",
  "creative_play": "根据上述指南分析得出的创意表现与想象力",
  "scene_visuals": "根据上述指南分析得出的场景氛围与画面元素"
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
            
            logger.info(f"使用模型: {response.model}")
            
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
            # 添加向量维度调试信息
            if embeddings:
                logger.info(f"生成向量维度: {len(embeddings[0])}")
            return embeddings
            
        except Exception as e:
            logger.error(f"向量生成失败: {e}")
            return None
    
    def update_record(self, record_id: str, theme_data: Dict, embeddings: List[List[float]]) -> bool:
        """更新数据库记录"""
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
            
            # 更新时间戳
            update_data['updated_at'] = datetime.now().isoformat()
            
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
        logger.info(f"  → 正在调用GPT-4分析文本...")
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
    
    def get_total_records_count(self, force_update: bool = False) -> int:
        """获取总记录数"""
        try:
            if force_update:
                response = self.supabase.table('illustrations_optimized') \
                    .select('id', count='exact') \
                    .not_.is_('original_description', 'null') \
                    .execute()
            else:
                response = self.supabase.table('illustrations_optimized') \
                    .select('id', count='exact') \
                    .is_('theme_philosophy', 'null') \
                    .execute()
            return response.count if response.count else 0
        except Exception as e:
            logger.error(f"获取总记录数失败: {e}")
            return 0
    
    def run(self, force_update: bool = False):
        """运行主处理流程"""
        if force_update:
            logger.info("开始强制更新绘本插图数据（将重新处理所有记录）...")
        else:
            logger.info("开始处理绘本插图数据...")
        
        # 获取总记录数
        total_records = self.get_total_records_count(force_update)
        logger.info(f"总共需要处理 {total_records} 条记录")
        
        total_processed = 0
        total_success = 0
        start_time = time.time()
        processed_ids = set()  # 跟踪本次运行已处理的记录ID
        
        while True:
            # 获取待处理记录
            records = self.get_pending_records(force_update=force_update, processed_ids=processed_ids)
            
            if not records:
                logger.info("没有更多待处理的记录，处理完成！")
                break
            
            logger.info(f"获取到 {len(records)} 条待处理记录")
            
            # 处理当前批次
            batch_success = 0
            for record in records:
                try:
                    record_id = record['id']
                    
                    if self.process_single_record(record):
                        batch_success += 1
                        total_success += 1
                    
                    total_processed += 1
                    processed_ids.add(record_id)  # 记录已处理的ID
                    
                    # 添加延迟以避免API限制（进一步减少延迟）
                    time.sleep(0.2)
                    
                except Exception as e:
                    logger.error(f"处理记录时发生未预期错误: {e}")
                    continue
            
            logger.info(f"当前批次完成: {batch_success}/{len(records)} 成功")
            
            # 计算进度和预估时间
            progress_percentage = (total_processed / total_records * 100) if total_records > 0 else 0
            elapsed_time = time.time() - start_time
            if total_processed > 0:
                avg_time_per_record = elapsed_time / total_processed
                remaining_records = total_records - total_processed
                estimated_remaining_time = remaining_records * avg_time_per_record
                
                logger.info(f"📊 总体进度: {total_success}/{total_processed}/{total_records} "
                          f"({progress_percentage:.1f}%) 成功率: {total_success/total_processed*100:.1f}%")
                logger.info(f"⏱️  已用时: {elapsed_time/60:.1f}分钟, 预计剩余: {estimated_remaining_time/60:.1f}分钟")
            else:
                logger.info(f"📊 总体进度: {total_success}/{total_processed}/{total_records}")
            
            # 批次间休息（减少延迟）
            time.sleep(1)
        
        elapsed_time = time.time() - start_time
        logger.info(f"🎉 所有数据处理完成！总计处理: {total_processed} 条，成功: {total_success} 条")
        logger.info(f"⏱️  总用时: {elapsed_time/60:.1f}分钟，平均每条: {elapsed_time/total_processed:.1f}秒")

def main():
    """主函数"""
    try:
        # 检查命令行参数
        import sys
        force_update = '--force-update' in sys.argv or '--update' in sys.argv
        
        # 创建处理器并运行
        processor = IllustrationProcessor()
        processor.run(force_update=force_update)
        
    except KeyboardInterrupt:
        logger.info("用户中断处理流程")
    except Exception as e:
        logger.error(f"程序运行出错: {e}")

if __name__ == "__main__":
    main()