const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// 从环境变量或.env文件读取配置
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 请确保设置了 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 从批量上传报告中成功处理的文件列表（基于2025-08-12T14-37-47-812Z报告）
const successfulFiles = [
  "1499-假如再给我三天时间.jpg",
  "1233-只老鼠_1.jpg",
  "1232-只老鼠.jpg",
  "1235-只老鼠去春游_1.jpg",
  "1239-男孩向前冲.jpg",
  "1238-只小猪和100只狼_1.jpg",
  "1237-只小猪和100只狼.jpg",
  "1236-只老鼠去春游_2.jpg",
  "1231-岁的鱼.jpg",
  "1240-Brush, Brush, Brush!.jpg",
  "1248-DNA：基因和遗传的秘密_3.jpg",
  "1246-DNA：基因和遗传的秘密_1.jpg",
  "1243-DK儿童目击者_1.jpg",
  "1249-Grace说恒心.jpg",
  "1244-DK儿童目击者_2.jpg",
  "1241-Brush, Brush, Brush!_1.jpg",
  "1242-DK儿童目击者.jpg",
  "1245-DNA：基因和遗传的秘密.jpg",
  "1247-DNA：基因和遗传的秘密_2.jpg",
  "1250-Grace说恒心_1.jpg",
  "1252-Grace说恒心_3.jpg",
  "1258-《DNA：基因和遗传的秘密》.jpg",
  "1253-Grace说恒心_4.jpg",
  "1257-《14只老鼠种南瓜》_1.jpg",
  "1259-《DNA：基因和遗传的秘密》_1.jpg",
  "1251-Grace说恒心_2.jpg",
  "1255-《1000把大提琴的合奏》.jpg",
  "1256-《14只老鼠种南瓜》.jpg",
  "1254-Grace说恒心_5.jpg",
  "1261-《好忙的春天》_1.jpg",
  "1267-《我们的一年：澳大利亚的春夏秋冬》1.jpg",
  "1268-《我们的一年：澳大利亚的春夏秋冬》1_1.jpg",
  "1263-《好忙的春天》_3.jpg",
  "1264-《就要做达利》.jpg",
  "1266-《成长第一棒小公民品德养成绘本》（第一辑）·分享.jpg",
  "1269-《我们的一年：澳大利亚的春夏秋冬》1_2.jpg",
  "1260-《好忙的春天》.jpg",
  "1262-《好忙的春天》_2.jpg",
  "1273-《隐形叶子》_1.jpg",
  "1277-一只狮子在巴黎_1.jpg",
  "1272-《隐形叶子》.jpg",
  "1278-一只狮子在巴黎_2.jpg",
  "1279-一只红手套.jpg",
  "1275-《隐形叶子》_3.jpg",
  "1274-《隐形叶子》_2.jpg",
  "1270-《我们的一年：澳大利亚的春夏秋冬》1_3.jpg",
  "1271-《敢于尝试的勇气》.jpg",
  "1287-一点点儿.jpg",
  "1285-一座特别的房子2.jpg",
  "1289-一点点儿_2.jpg",
  "1283-一座图书馆的诞生.jpg",
  "1288-一点点儿_1.jpg",
  "1286-一棵知道很多故事的树.jpg",
  "1281-一幅不可思议的画.jpg",
  "1284-一座特别的房子1.jpg",
  "1280-一只红手套_1.jpg",
  "1282-一幅不可思议的画_1.jpg",
  "1298-七彩下雨天.jpg",
  "1290-一生之旅.jpg",
  "1296-丁丁，钉一下.jpg",
  "1294-一粒种子的旅行.jpg",
  "1292-一粒种子改变世界 袁隆平的故事_1.jpg",
  "1297-七只瞎老鼠.jpg",
  "1299-万圣节的大南瓜.jpg",
  "1295-一粒种子的旅行1.jpg",
  "1293-一粒种子改变世界 袁隆平的故事_2.jpg"
];

// 通过文件名查找并删除数据库记录
async function deleteDatabaseRecordByFilename(filename) {
  try {
    // 首先通过文件名查找记录
    const { data: records, error: searchError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, image_url')
      .eq('filename', filename);
    
    if (searchError) {
      throw new Error(`查找记录失败: ${searchError.message}`);
    }
    
    if (!records || records.length === 0) {
      return { success: false, error: 'RECORD_NOT_FOUND' };
    }
    
    if (records.length > 1) {
      console.warn(`⚠️ 找到多条匹配记录 (${records.length} 条)，将删除第一条`);
    }
    
    const record = records[0];
    const recordId = record.id;
    
    // 删除数据库记录
    const { error: deleteError } = await supabase
      .from('illustrations_optimized')
      .delete()
      .eq('id', recordId);
    
    if (deleteError) {
      throw new Error(`删除数据库记录失败: ${deleteError.message}`);
    }
    
    // 如果存在图片URL，尝试删除存储中的图片文件
    if (record.image_url) {
      try {
        // 从URL中提取文件路径
        const urlParts = record.image_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        // 删除存储中的图片文件
        const { error: storageError } = await supabase.storage
          .from('illustrations')
          .remove([fileName]);
        
        if (storageError) {
          console.warn(`⚠️ 删除存储文件失败 (${fileName}):`, storageError.message);
          // 不抛出错误，因为数据库记录已经删除成功
        }
      } catch (storageError) {
        console.warn(`⚠️ 删除存储文件时出错 (${filename}):`, storageError.message);
        // 不抛出错误，因为数据库记录已经删除成功
      }
    }
    
    return { success: true, recordId };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 批量删除处理
async function batchDeleteProcessedFiles() {
  console.log('🗑️ 批量删除已处理文件 (修复版本)');
  console.log('==========================================');
  console.log(`📁 准备删除 ${successfulFiles.length} 个文件记录`);
  console.log('💡 使用文件名精确匹配查找记录');
  console.log('');
  
  const results = {
    success: 0,
    notFound: 0,
    failed: 0,
    errors: []
  };
  
  // 确认删除操作
  if (process.argv.includes('--auto-confirm')) {
    console.log('🔄 自动确认模式，开始删除...');
  } else {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('⚠️ 确认要删除这些文件记录吗？(y/N): ', resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ 操作已取消');
      return;
    }
  }
  
  console.log('🔄 开始删除操作...\n');
  
  for (let i = 0; i < successfulFiles.length; i++) {
    const filename = successfulFiles[i];
    
    try {
      console.log(`[${i + 1}/${successfulFiles.length}] 删除: ${filename}`);
      
      const result = await deleteDatabaseRecordByFilename(filename);
      
      if (result.success) {
        console.log(`  ✅ 删除成功 (ID: ${result.recordId})`);
        results.success++;
      } else if (result.error === 'RECORD_NOT_FOUND') {
        console.log(`  ⚠️ 记录不存在（可能已被删除）`);
        results.notFound++;
      } else {
        console.log(`  ❌ 删除失败: ${result.error}`);
        results.failed++;
        results.errors.push({
          filename,
          error: result.error
        });
      }
      
    } catch (error) {
      console.log(`  ❌ 删除失败: ${error.message}`);
      results.failed++;
      results.errors.push({
        filename,
        error: error.message
      });
    }
    
    // 添加小延迟避免API限制
    if (i < successfulFiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log('\n📊 删除操作完成');
  console.log('==========================================');
  console.log(`✅ 成功删除: ${results.success} 条记录`);
  console.log(`⚠️ 记录不存在: ${results.notFound} 条记录`);
  console.log(`❌ 删除失败: ${results.failed} 条记录`);
  console.log(`📈 成功率: ${((results.success / successfulFiles.length) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ 失败记录详情:');
    results.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.filename}: ${error.error}`);
    });
  }
  
  // 生成删除报告
  const reportTime = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'reports', `batch-delete-report-${reportTime}.json`);
  
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: successfulFiles.length,
    results,
    deletedFiles: successfulFiles.filter((_, i) => i < results.success),
    method: 'filename_exact_match'
  };
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 删除报告已保存: ${reportPath}`);
  } catch (reportError) {
    console.warn(`⚠️ 保存删除报告失败: ${reportError.message}`);
  }
}

// 主函数
async function main() {
  try {
    await batchDeleteProcessedFiles();
  } catch (error) {
    console.error('❌ 批量删除过程中出错:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  batchDeleteProcessedFiles,
  deleteDatabaseRecordByFilename,
  successfulFiles
};
