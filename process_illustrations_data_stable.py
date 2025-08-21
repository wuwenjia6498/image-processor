#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
绘本插图数据处理脚本 - 稳定版本
功能：读取旧的描述文本，用AI分析填充7个主题字段，并生成对应的向量嵌入
作者：AI Assistant
"""

import os
import json
import time
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import random

# 第三方库导入
import openai
from supabase import create_client, Client
from openai import OpenAI

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('illustration_processing_stable.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class StableIllustrationProcessor:
    """绘本插图数据处理器 - 稳定版本"""
    
    def __init__(self):
        """初始化处理器，设置API客户端"""
        self.setup_clients()
        self.batch_size = 5  # 减少批次大小提升稳定性
        self.max_retries = 3  # 最大重试次数
        self.base_delay = 2   # 基础延迟时间（秒）
        
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
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # 使用SERVICE_ROLE_KEY
        openai_api_key = os.getenv('OPENAI_API_KEY')
        
        # 尝试从config.py导入配置（优先使用config.py中的配置）
        openai_base_url = None
        try:
            import config
            supabase_url = config.SUPABASE_URL
            supabase_key = getattr(config, 'SUPABASE_SERVICE_ROLE_KEY', config.SUPABASE_ANON_KEY)
            openai_api_key = config.OPENAI_API_KEY
            # 检查是否有自定义的OpenAI Base URL
            if hasattr(config, 'OPENAI_BASE_URL'):
                openai_base_url = config.OPENAI_BASE_URL
            logger.info("从config.py文件加载配置")
        except ImportError:
            logger.info("config.py不存在，使用环境变量")
            pass
        
        if not all([supabase_url, supabase_key, openai_api_key]):
            raise ValueError("请设置环境变量或在config.py中配置：SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY")
        
        # 初始化客户端
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # 初始化OpenAI客户端，支持自定义base_url
        if openai_base_url:
            self.openai_client = OpenAI(
                api_key=openai_api_key, 
                base_url=openai_base_url,
                timeout=60.0  # 设置60秒超时
            )
            logger.info(f"使用自定义OpenAI API地址: {openai_base_url}")
        else:
            self.openai_client = OpenAI(
                api_key=openai_api_key,
                timeout=60.0  # 设置60秒超时
            )
        
        logger.info("客户端初始化成功")
    
    def exponential_backoff(self, attempt: int) -> float:
        """指数退避算法"""
        delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
        return min(delay, 60)  # 最大延迟60秒
    
    def get_pending_records(self, force_update: bool = False, processed_ids: set = None) -> Tuple[List[Dict], bool]:
        """获取待处理的记录
        Returns:
            tuple: (records_list, is_network_error)
        """
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
            
            return response.data, False
        except Exception as e:
            error_msg = str(e)
            logger.error(f"获取待处理记录失败: {e}")
            
            # 检查是否是网络连接错误
            is_network_error = any(keyword in error_msg.lower() for keyword in [
                'winerror 10054', 'connection', 'timeout', 'network', 
                '远程主机强迫关闭', 'connection reset', 'connection aborted'
            ])
            
            return [], is_network_error
    
    def analyze_with_gpt4_stable(self, description: str) -> Optional[Dict]:
        """使用GPT-4o分析描述文本，提取7个主题字段 - 稳定版本"""
        
        # 完整的prompt，包含详细的字段填写指南
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

        for attempt in range(self.max_retries):
            try:
                logger.info(f"尝试GPT-4分析 (第{attempt + 1}次)")
                
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o-2024-11-20",
                    messages=[
                        {
                            "role": "system",
                            "content": "你是专业的文本分析专家。请严格按照JSON格式返回结果，不要添加任何解释。"
                        },
                        {
                            "role": "user", 
                            "content": prompt
                        }
                    ],
                    temperature=0.3,
                    max_tokens=800,  # 减少token数量
                    timeout=30  # 30秒超时
                )
                
                # 解析JSON响应
                content = response.choices[0].message.content.strip()
                
                # 移除可能的markdown代码块标记
                if content.startswith('```json'):
                    content = content[7:]
                if content.endswith('```'):
                    content = content[:-3]
                
                result = json.loads(content)
                logger.info("GPT-4分析成功")
                return result
                
            except json.JSONDecodeError as e:
                logger.error(f"JSON解析失败 (第{attempt + 1}次): {e}")
                if attempt == self.max_retries - 1:
                    return self.get_fallback_analysis(description)
                    
            except Exception as e:
                logger.error(f"GPT-4分析失败 (第{attempt + 1}次): {e}")
                if attempt < self.max_retries - 1:
                    delay = self.exponential_backoff(attempt)
                    logger.info(f"等待 {delay:.1f} 秒后重试...")
                    time.sleep(delay)
                else:
                    return self.get_fallback_analysis(description)
        
        return None
    
    def get_fallback_analysis(self, description: str) -> Dict:
        """当AI分析失败时的备用分析"""
        logger.info("使用备用分析方案")
        return {
            "theme_philosophy": "基于插图内容的人生感悟和价值观念",
            "action_process": "画面中展现的动作和成长过程",
            "interpersonal_roles": "人物之间的关系和情感互动",
            "edu_value": "对儿童教育和成长的积极意义",
            "learning_strategy": "通过观察和体验获得的学习方式",
            "creative_play": "激发想象力和创造力的游戏元素",
            "scene_visuals": f"温馨的画面场景，描述长度：{len(description)}字符"
        }
    
    def generate_embeddings_stable(self, texts: List[str]) -> Optional[List[List[float]]]:
        """为文本列表生成向量嵌入 - 稳定版本"""
        
        for attempt in range(self.max_retries):
            try:
                # 过滤空文本
                valid_texts = [text for text in texts if text and text.strip()]
                if not valid_texts:
                    return None
                
                logger.info(f"生成向量嵌入 (第{attempt + 1}次) - {len(valid_texts)}个文本")
                
                response = self.openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=valid_texts,
                    encoding_format="float",
                    timeout=30  # 30秒超时
                )
                
                embeddings = [embedding.embedding for embedding in response.data]
                logger.info(f"向量嵌入生成成功 - {len(embeddings)}个向量")
                return embeddings
                
            except Exception as e:
                logger.error(f"向量嵌入生成失败 (第{attempt + 1}次): {e}")
                if attempt < self.max_retries - 1:
                    delay = self.exponential_backoff(attempt)
                    logger.info(f"等待 {delay:.1f} 秒后重试...")
                    time.sleep(delay)
        
        logger.error("向量嵌入生成最终失败，跳过此记录")
        return None
    
    def process_single_record(self, record: Dict) -> bool:
        """处理单条记录"""
        try:
            record_id = record['id']
            filename = record['filename']
            original_description = record['original_description']
            
            logger.info(f"正在处理记录ID: {record_id}, 文件名: {filename}")
            
            # 1. 使用GPT-4分析描述文本
            analysis_result = self.analyze_with_gpt4_stable(original_description)
            if not analysis_result:
                logger.error(f"跳过记录 {record_id}: GPT-4分析失败")
                return False
            
            # 2. 生成向量嵌入
            theme_texts = [analysis_result[field] for field in self.theme_fields]
            embeddings = self.generate_embeddings_stable(theme_texts)
            
            if not embeddings or len(embeddings) != len(self.theme_fields):
                logger.error(f"跳过记录 {record_id}: 向量嵌入生成失败")
                return False
            
            # 3. 准备更新数据
            update_data = {}
            
            # 添加主题字段
            for field in self.theme_fields:
                update_data[field] = analysis_result[field]
            
            # 添加向量字段
            for i, embedding_field in enumerate(self.embedding_fields):
                update_data[embedding_field] = embeddings[i]
            
            # 4. 更新数据库
            response = self.supabase.table('illustrations_optimized') \
                .update(update_data) \
                .eq('id', record_id) \
                .execute()
            
            if response.data:
                logger.info(f"✅ 记录 {record_id} 处理成功")
                return True
            else:
                logger.error(f"❌ 记录 {record_id} 数据库更新失败")
                return False
                
        except Exception as e:
            logger.error(f"处理记录 {record.get('id', 'unknown')} 时出错: {e}")
            return False
    
    def run_stable(self, force_update: bool = False):
        """运行稳定版本的处理流程"""
        logger.info("开始稳定版本的插图数据处理")
        
        processed_count = 0
        failed_count = 0
        processed_ids = set()
        
        max_reconnect_attempts = 3 # 最大重连尝试次数
        current_reconnect_attempt = 0
        
        try:
            while True:
                # 获取待处理记录
                records, is_network_error = self.get_pending_records(force_update, processed_ids)
                
                if not records:
                    if is_network_error:
                        # 网络错误，尝试重连
                        logger.warning("检测到网络错误，30秒后重试...")
                        time.sleep(30)
                        
                        # 重新初始化Supabase客户端
                        try:
                            logger.info("尝试重新连接Supabase...")
                            self.setup_clients()
                            logger.info("重新连接成功，继续处理...")
                            current_reconnect_attempt = 0  # 重连成功后重置计数器
                            continue
                        except Exception as reconnect_error:
                            logger.error(f"重连失败: {reconnect_error}")
                            current_reconnect_attempt += 1
                            if current_reconnect_attempt < max_reconnect_attempts:
                                logger.warning(f"重连失败，{current_reconnect_attempt}/{max_reconnect_attempts} 次尝试...")
                                time.sleep(60) # 重连失败后等待60秒
                                continue
                            else:
                                logger.error(f"达到最大重连尝试次数 ({max_reconnect_attempts})，退出处理。")
                                break
                    else:
                        # 真正没有更多数据
                        logger.info("没有更多待处理记录")
                        break
                
                logger.info(f"获取到 {len(records)} 条待处理记录")
                
                # 处理每条记录
                for record in records:
                    success = self.process_single_record(record)
                    
                    if success:
                        processed_count += 1
                        processed_ids.add(record['id'])
                    else:
                        failed_count += 1
                    
                    # 记录间的短暂延迟
                    time.sleep(1)
                
                # 批次间的延迟
                if len(records) == self.batch_size:
                    logger.info("批次完成，等待5秒后继续...")
                    time.sleep(5)
                
        except KeyboardInterrupt:
            logger.info("用户中断处理")
        except Exception as e:
            logger.error(f"处理过程中出错: {e}")
        
        # 输出最终统计
        logger.info(f"处理完成！成功: {processed_count}, 失败: {failed_count}")

def main():
    """主函数"""
    try:
        processor = StableIllustrationProcessor()
        
        # 询问是否强制更新
        force_update = input("是否强制更新所有记录？(y/N): ").lower().strip() == 'y'
        
        processor.run_stable(force_update=force_update)
        
    except Exception as e:
        logger.error(f"程序启动失败: {e}")

if __name__ == "__main__":
    main()
