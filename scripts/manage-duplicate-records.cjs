#!/usr/bin/env node

/**
 * 管理重复记录和不符合要求的记录
 * 功能：
 * 1. 查看今日创建的记录
 * 2. 删除不符合要求的记录
 * 3. 支持强制覆盖重新上传
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env.local' });

// 初始化客户端
let supabase, pinecone, pineconeIndex;

function initializeClients() {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  pinecone = new Pinecone({
    apiKey: process.env.VITE_PINECONE_API_KEY
  });
  pineconeIndex = pinecone.index(process.env.VITE_PINECONE_INDEX_NAME);
  
  console.log('✅ 客户端初始化成功');
}

// 查看今日创建的记录
async function listTodayRecords() {
  console.log('🔍 查看今日创建的记录...\n');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  
  const { data, error } = await supabase
    .from('illustrations_optimized')
    .select('id, filename, created_at, ai_description')
    .gte('created_at', todayStr)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ 查询失败:', error.message);
    return [];
  }
  
  console.log(`📊 找到 ${data?.length || 0} 条今日记录:\n`);
  
  data?.forEach((record, index) => {
    const hasChineseInId = /[\u4e00-\u9fa5]/.test(record.id);
    const isShortDescription = record.ai_description && record.ai_description.length < 400;
    const isLongDescription = record.ai_description && record.ai_description.length >= 400;
    
    console.log(`${index + 1}. ID: ${record.id}`);
    console.log(`   文件名: ${record.filename}`);
    console.log(`   创建时间: ${new Date(record.created_at).toLocaleString()}`);
    console.log(`   ID包含中文: ${hasChineseInId ? '❌ 是' : '✅ 否'}`);
    console.log(`   描述长度: ${record.ai_description?.length || 0} 字符 ${isShortDescription ? '❌ 过短' : isLongDescription ? '✅ 合适' : '⚠️ 未知'}`);
    console.log(`   状态: ${hasChineseInId || isShortDescription ? '❌ 不符合要求' : '✅ 符合要求'}`);
    console.log('-'.repeat(60));
  });
  
  return data || [];
}

// 删除指定记录
async function deleteRecord(recordId, filename) {
  console.log(`🗑️ 删除记录: ${recordId} (${filename})`);
  
  try {
    // 1. 从数据库删除
    const { error: dbError } = await supabase
      .from('illustrations_optimized')
      .delete()
      .eq('id', recordId);
    
    if (dbError) {
      console.log(`   ⚠️ 数据库删除失败: ${dbError.message}`);
    } else {
      console.log('   ✅ 数据库记录已删除');
    }
    
    // 2. 从Pinecone删除向量
    try {
      await pineconeIndex.deleteOne(recordId);
      console.log('   ✅ Pinecone向量已删除');
    } catch (vectorError) {
      console.log(`   ⚠️ Pinecone删除失败: ${vectorError.message}`);
    }
    
    // 3. 从存储删除文件（可选，通常保留）
    // 注意：这里不删除存储文件，因为可能有其他引用
    
    return true;
  } catch (error) {
    console.log(`   ❌ 删除失败: ${error.message}`);
    return false;
  }
}

// 批量删除不符合要求的记录
async function deleteNonCompliantRecords(records) {
  const nonCompliantRecords = records.filter(record => {
    const hasChineseInId = /[\u4e00-\u9fa5]/.test(record.id);
    const isShortDescription = record.ai_description && record.ai_description.length < 400;
    return hasChineseInId || isShortDescription;
  });
  
  if (nonCompliantRecords.length === 0) {
    console.log('🎉 所有记录都符合要求，无需删除！');
    return;
  }
  
  console.log(`\n🔍 找到 ${nonCompliantRecords.length} 条不符合要求的记录:\n`);
  
  nonCompliantRecords.forEach((record, index) => {
    const hasChineseInId = /[\u4e00-\u9fa5]/.test(record.id);
    const isShortDescription = record.ai_description && record.ai_description.length < 400;
    
    console.log(`${index + 1}. ${record.filename}`);
    console.log(`   ID: ${record.id}`);
    console.log(`   问题: ${hasChineseInId ? 'ID包含中文' : ''} ${isShortDescription ? 'AI描述过短' : ''}`);
  });
  
  console.log('\n⚠️ 即将删除这些记录，删除后可以重新上传以生成符合要求的记录。');
  console.log('⚠️ 这个操作不可撤销！');
  
  // 确认删除
  process.stdout.write('\n❓ 确认删除这些记录吗？(输入 "DELETE" 确认): ');
  
  return new Promise((resolve) => {
    process.stdin.once('data', async (data) => {
      const input = data.toString().trim();
      
      if (input === 'DELETE') {
        console.log('\n🚀 开始删除记录...\n');
        
        let successCount = 0;
        let failCount = 0;
        
        for (const record of nonCompliantRecords) {
          const success = await deleteRecord(record.id, record.filename);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        }
        
        console.log(`\n📊 删除结果:`);
        console.log(`   ✅ 成功: ${successCount}`);
        console.log(`   ❌ 失败: ${failCount}`);
        
        if (successCount > 0) {
          console.log('\n💡 现在您可以重新运行批量上传，这些文件将按新标准重新处理！');
        }
        
      } else {
        console.log('\n❌ 操作已取消');
      }
      
      resolve();
    });
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  console.log('🗂️ ===== 记录管理工具 =====\n');
  
  try {
    initializeClients();
    
    if (args.includes('--list') || args.length === 0) {
      // 默认操作：列出今日记录
      const records = await listTodayRecords();
      
      if (records.length > 0) {
        console.log('\n💡 使用说明:');
        console.log('   --delete-non-compliant  删除不符合要求的记录');
        console.log('   --list                  仅列出记录（默认）');
      }
      
    } else if (args.includes('--delete-non-compliant')) {
      // 删除不符合要求的记录
      const records = await listTodayRecords();
      await deleteNonCompliantRecords(records);
      
    } else {
      console.log('使用方法:');
      console.log('  node scripts/manage-duplicate-records.cjs [选项]');
      console.log('');
      console.log('选项:');
      console.log('  --list                   列出今日创建的记录（默认）');
      console.log('  --delete-non-compliant   删除不符合要求的记录');
      console.log('');
      console.log('示例:');
      console.log('  node scripts/manage-duplicate-records.cjs');
      console.log('  node scripts/manage-duplicate-records.cjs --delete-non-compliant');
    }
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 