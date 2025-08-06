import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { generateOpenAIDescription } from '../services/cloud-ai-service';
import { imageDescriptionToVector, getDimension } from '../services/unified-embedding';

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// 初始化客户端
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  try {
    console.log('🚀 开始修复版图片处理（统一1536维向量）...\n');
    
    // 1. 获取所有待处理的图片记录
    console.log('📋 获取待处理图片记录...');
    const { data: records, error } = await supabase
      .from('illustrations_optimized')
      .select('*')
      .is('vector_embedding', null) // 只处理未向量化的记录
      .limit(10); // 限制处理数量，避免API额度消耗过多

    if (error) {
      throw new Error(`获取记录失败: ${error.message}`);
    }

    if (!records || records.length === 0) {
      console.log('✅ 没有需要处理的图片记录');
      return;
    }

    console.log(`📊 找到 ${records.length} 条待处理记录\n`);

    // 2. 处理每条记录
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      console.log(`\n🖼️ 处理图片 ${i + 1}/${records.length}: ${record.filename}`);
      console.log(`📖 书名: ${record.book_title}`);

      try {
        // 检查是否已有AI描述
        let aiDescription = record.ai_description;
        
        if (!aiDescription || aiDescription.includes('模拟') || aiDescription.includes('AI生成的')) {
          // 需要重新生成AI描述
          console.log('  🤖 生成新的AI描述...');
          
          // 构建图片路径
          const imagePath = path.join(process.cwd(), 'data', 'images', record.filename);
          
          if (fs.existsSync(imagePath)) {
            aiDescription = await generateOpenAIDescription(imagePath, record.book_title);
          } else {
            console.log('  ⚠️ 图片文件不存在，使用现有描述');
            aiDescription = record.ai_description || `来自《${record.book_title}》的精美插图`;
          }
        } else {
          console.log('  ✅ 使用现有AI描述');
        }

        console.log(`  📝 AI描述: ${aiDescription.substring(0, 100)}...`);

        // 生成1536维向量
        console.log('  🔢 生成1536维向量...');
        const imageVector = await imageDescriptionToVector(aiDescription);
        
        // 验证向量维度
        const expectedDim = getDimension();
        if (imageVector.length !== expectedDim) {
          throw new Error(`向量维度错误: 期望${expectedDim}维，实际${imageVector.length}维`);
        }

        console.log(`  ✅ 向量生成完成: ${imageVector.length}维`);

        // 更新Supabase记录
        console.log('  💾 更新数据库记录...');
        const { error: updateError } = await supabase
          .from('illustrations_optimized')
          .update({
            ai_description: aiDescription,
            vector_embedding: imageVector,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (updateError) {
          throw new Error(`更新数据库失败: ${updateError.message}`);
        }

        // 更新或插入Pinecone向量
        console.log('  🌲 更新Pinecone向量...');
        const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);
        
        await index.upsert([{
          id: record.id,
          values: imageVector,
          metadata: {
            filename: record.filename,
            book_title: record.book_title,
            description: aiDescription,
            image_url: record.image_url,
            age_orientation: record.age_orientation,
            text_type_fit: record.text_type_fit,
            book_theme: record.book_theme,
            keywords: record.keywords || []
          }
        }]);

        console.log(`  ✅ 处理完成！`);

        // 添加延迟避免API限制
        if (i < records.length - 1) {
          console.log('  ⏳ 等待2秒避免API限制...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`  ❌ 处理失败:`, error);
        continue;
      }
    }

    console.log('\n🎉 批量处理完成！');
    console.log(`📊 处理统计:`);
    console.log(`   - 总记录数: ${records.length}`);
    console.log(`   - 向量维度: ${getDimension()}维`);
    console.log(`   - 模型: text-embedding-3-small`);

  } catch (error) {
    console.error('❌ 处理过程中出错:', error);
    process.exit(1);
  }
}

// 运行主函数
main().catch(console.error);

export { main }; 