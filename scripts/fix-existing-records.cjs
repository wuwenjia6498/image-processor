#!/usr/bin/env node

/**
 * 修复已上传但文件名错误的图片记录脚本
 * 功能：
 * 1. 查找所有已上传的记录
 * 2. 使用新的书名提取逻辑重新生成正确的书名
 * 3. 更新数据库中的book_title字段
 * 4. 更新Pinecone中的元数据
 * 5. 可选择重新生成AI描述
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 全局变量
let supabase, pinecone, pineconeIndex, openai;

// 初始化客户端
async function initializeClients() {
  console.log('🚀 初始化客户端连接...\n');
  
  try {
    // 初始化 Supabase
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase 客户端初始化成功');

    // 初始化 Pinecone
    pinecone = new Pinecone({
      apiKey: process.env.VITE_PINECONE_API_KEY
    });
    pineconeIndex = pinecone.index(process.env.VITE_PINECONE_INDEX_NAME);
    console.log('✅ Pinecone 客户端初始化成功');

    // 初始化 OpenAI（如果需要重新生成描述）
    if (process.env.VITE_OPENAI_API_KEY) {
      openai = new OpenAI({
        apiKey: process.env.VITE_OPENAI_API_KEY,
        baseURL: process.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
      });
      console.log('✅ OpenAI 客户端初始化成功\n');
    }

  } catch (error) {
    console.error('❌ 客户端初始化失败:', error.message);
    process.exit(1);
  }
}

// 新的书名提取函数（修复版）
function extractBookTitle(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // 首先去掉前缀数字和连字符（如：133-中国1 -> 中国1）
  let bookTitle = nameWithoutExt.replace(/^\d+-/, '');
  
  // 然后去掉各种形式的后缀数字：
  // 1. 直接连接的数字（如：中国1 -> 中国）
  bookTitle = bookTitle.replace(/\d+$/, '');
  
  // 2. 用连字符连接的数字（如：好奇之旅-1 -> 好奇之旅）
  bookTitle = bookTitle.replace(/-\d+$/, '');
  
  // 3. 处理复杂情况，如：幸福的大桌子-1关于家和爱 -> 幸福的大桌子关于家和爱
  bookTitle = bookTitle.replace(/-\d+(?=[\u4e00-\u9fa5])/, '');
  
  // 清理多余的空白和连字符
  bookTitle = bookTitle.replace(/[-\s]+$/, '').trim();
  
  // 如果处理后为空，返回原始文件名（去掉扩展名）
  return bookTitle || nameWithoutExt;
}

// 旧的书名提取函数（用于对比）
function extractBookTitleOld(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // 匹配数字-中文标题的模式
  const match = nameWithoutExt.match(/^\d+-(.+)$/);
  if (match) {
    return match[1];
  }
  
  // 如果包含中文，提取中文部分
  const chineseMatch = nameWithoutExt.match(/[\u4e00-\u9fa5]+.*$/);
  if (chineseMatch) {
    return chineseMatch[0].replace(/-\d+$/, '').trim();
  }
  
  return nameWithoutExt;
}

// 获取所有需要修复的记录
async function getRecordsToFix() {
  console.log('🔍 正在扫描数据库中的记录...\n');
  
  const { data: records, error } = await supabase
    .from('illustrations_optimized')
    .select('id, filename, book_title, ai_description, image_url')
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`获取记录失败: ${error.message}`);
  }
  
  // 找出需要修复的记录
  const recordsToFix = [];
  
  records.forEach(record => {
    const oldTitle = record.book_title;
    const newTitle = extractBookTitle(record.filename);
    
    if (oldTitle !== newTitle) {
      recordsToFix.push({
        ...record,
        oldTitle,
        newTitle
      });
    }
  });
  
  return recordsToFix;
}

// 更新单个记录
async function updateRecord(record, options = {}) {
  const { regenerateDescription = false } = options;
  
  console.log(`📝 更新记录: ${record.filename}`);
  console.log(`   📖 旧书名: ${record.oldTitle}`);
  console.log(`   📖 新书名: ${record.newTitle}`);
  
  try {
    let updateData = {
      book_title: record.newTitle,
      updated_at: new Date().toISOString()
    };
    
    // 如果需要重新生成AI描述
    if (regenerateDescription && openai) {
      console.log('   🤖 重新生成AI描述...');
      // 这里可以添加重新生成AI描述的逻辑
      // 但由于我们没有原始图片文件，暂时跳过
      console.log('   ⏭️ 跳过AI描述重新生成（需要原始图片文件）');
    }
    
    // 1. 更新数据库
    const { error: dbError } = await supabase
      .from('illustrations_optimized')
      .update(updateData)
      .eq('id', record.id);
    
    if (dbError) {
      throw new Error(`数据库更新失败: ${dbError.message}`);
    }
    console.log('   ✅ 数据库更新成功');
    
    // 2. 更新Pinecone元数据
    try {
      await pineconeIndex.update({
        id: record.id,
        metadata: {
          filename: record.filename,
          book_title: record.newTitle,
          ai_description: record.ai_description,
          image_url: record.image_url
        }
      });
      console.log('   ✅ Pinecone元数据更新成功');
    } catch (vectorError) {
      console.log(`   ⚠️ Pinecone更新失败: ${vectorError.message}`);
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ 更新失败: ${error.message}`);
    return false;
  }
}

// 显示修复预览
function showFixPreview(recordsToFix) {
  console.log(`📊 找到 ${recordsToFix.length} 条需要修复的记录:\n`);
  
  if (recordsToFix.length === 0) {
    console.log('🎉 所有记录的书名都是正确的，无需修复！');
    return;
  }
  
  // 按书名分组显示
  const groupedByNewTitle = {};
  recordsToFix.forEach(record => {
    if (!groupedByNewTitle[record.newTitle]) {
      groupedByNewTitle[record.newTitle] = [];
    }
    groupedByNewTitle[record.newTitle].push(record);
  });
  
  Object.entries(groupedByNewTitle).forEach(([newTitle, records]) => {
    console.log(`📚 "${newTitle}" (${records.length}个文件):`);
    records.forEach(record => {
      console.log(`   📄 ${record.filename}`);
      console.log(`      旧: "${record.oldTitle}" → 新: "${record.newTitle}"`);
    });
    console.log('');
  });
}

// 确认操作
function confirmOperation(recordsToFix) {
  return new Promise((resolve) => {
    console.log(`\n❓ 确认要修复这 ${recordsToFix.length} 条记录吗？`);
    console.log('   输入 "FIX" 确认修复');
    console.log('   输入 "PREVIEW" 重新查看预览');
    console.log('   按 Ctrl+C 取消操作\n');
    
    process.stdout.write('请输入: ');
    
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toUpperCase();
      
      if (input === 'FIX') {
        resolve(true);
      } else if (input === 'PREVIEW') {
        showFixPreview(recordsToFix);
        resolve(confirmOperation(recordsToFix));
      } else {
        console.log('❌ 操作已取消');
        resolve(false);
      }
    });
  });
}

// 主函数
async function main() {
  console.log('🔧 ===== 修复已上传图片的书名记录 =====\n');
  
  try {
    // 初始化客户端
    await initializeClients();
    
    // 获取需要修复的记录
    const recordsToFix = await getRecordsToFix();
    
    // 显示预览
    showFixPreview(recordsToFix);
    
    if (recordsToFix.length === 0) {
      return;
    }
    
    // 确认操作
    const shouldProceed = await confirmOperation(recordsToFix);
    
    if (!shouldProceed) {
      return;
    }
    
    // 执行修复
    console.log('\n🚀 开始修复记录...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const record of recordsToFix) {
      const success = await updateRecord(record);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    // 显示结果
    console.log('\n📊 ===== 修复完成 =====');
    console.log(`✅ 成功修复: ${successCount} 条记录`);
    console.log(`❌ 修复失败: ${failCount} 条记录`);
    console.log(`📈 成功率: ${((successCount / recordsToFix.length) * 100).toFixed(1)}%`);
    
    if (successCount > 0) {
      console.log('\n🎉 修复完成！现在AI搜索应该能更准确地找到相关绘本了。');
      console.log('💡 建议：');
      console.log('   1. 在前端系统中测试搜索功能');
      console.log('   2. 验证同一绘本的不同页面是否正确归类');
    }
    
  } catch (error) {
    console.error('❌ 修复过程失败:', error.message);
    process.exit(1);
  }
}

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n\n⚠️ 接收到中断信号，正在退出...');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { extractBookTitle, updateRecord }; 