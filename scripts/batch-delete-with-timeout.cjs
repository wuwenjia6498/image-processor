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

// 剩余需要删除的文件（跳过已删除的前3个）
const remainingFiles = [
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

// 带超时的数据库操作
async function withTimeout(promise, timeoutMs = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('操作超时')), timeoutMs)
    )
  ]);
}

// 通过文件名查找并删除数据库记录（带超时）
async function deleteDatabaseRecordByFilename(filename) {
  try {
    console.log(`  🔍 查找记录: ${filename}`);
    
    // 查找记录（10秒超时）
    const searchResult = await withTimeout(
      supabase
        .from('illustrations_optimized')
        .select('id, filename, image_url')
        .eq('filename', filename),
      10000
    );
    
    const { data: records, error: searchError } = searchResult;
    
    if (searchError) {
      throw new Error(`查找记录失败: ${searchError.message}`);
    }
    
    if (!records || records.length === 0) {
      return { success: false, error: 'RECORD_NOT_FOUND' };
    }
    
    const record = records[0];
    const recordId = record.id;
    
    console.log(`  🗑️ 删除记录 ID: ${recordId}`);
    
    // 删除数据库记录（10秒超时）
    const deleteResult = await withTimeout(
      supabase
        .from('illustrations_optimized')
        .delete()
        .eq('id', recordId),
      10000
    );
    
    const { error: deleteError } = deleteResult;
    
    if (deleteError) {
      throw new Error(`删除数据库记录失败: ${deleteError.message}`);
    }
    
    // 删除存储文件（如果存在）
    if (record.image_url) {
      try {
        const urlParts = record.image_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        console.log(`  🗂️ 删除存储文件: ${fileName}`);
        
        const storageResult = await withTimeout(
          supabase.storage
            .from('illustrations')
            .remove([fileName]),
          10000
        );
        
        const { error: storageError } = storageResult;
        
        if (storageError) {
          console.warn(`    ⚠️ 删除存储文件失败: ${storageError.message}`);
        }
      } catch (storageError) {
        console.warn(`    ⚠️ 删除存储文件时出错: ${storageError.message}`);
      }
    }
    
    return { success: true, recordId };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 批量删除处理
async function batchDeleteRemainingFiles() {
  console.log('🗑️ 继续批量删除剩余文件');
  console.log('==========================================');
  console.log(`📁 准备删除 ${remainingFiles.length} 个剩余文件记录`);
  console.log('⏱️ 每个操作设置10秒超时');
  console.log('');
  
  const results = {
    success: 0,
    notFound: 0,
    failed: 0,
    timeout: 0,
    errors: []
  };
  
  console.log('🔄 开始删除操作...\n');
  
  for (let i = 0; i < remainingFiles.length; i++) {
    const filename = remainingFiles[i];
    
    try {
      console.log(`[${i + 1}/${remainingFiles.length}] 处理: ${filename}`);
      
      const result = await deleteDatabaseRecordByFilename(filename);
      
      if (result.success) {
        console.log(`  ✅ 删除成功 (ID: ${result.recordId})`);
        results.success++;
      } else if (result.error === 'RECORD_NOT_FOUND') {
        console.log(`  ⚠️ 记录不存在（可能已被删除）`);
        results.notFound++;
      } else if (result.error.includes('超时')) {
        console.log(`  ⏱️ 操作超时，跳过此文件`);
        results.timeout++;
        results.errors.push({
          filename,
          error: result.error
        });
      } else {
        console.log(`  ❌ 删除失败: ${result.error}`);
        results.failed++;
        results.errors.push({
          filename,
          error: result.error
        });
      }
      
    } catch (error) {
      console.log(`  ❌ 处理失败: ${error.message}`);
      results.failed++;
      results.errors.push({
        filename,
        error: error.message
      });
    }
    
    // 每5个文件显示一次进度
    if ((i + 1) % 5 === 0) {
      console.log(`\n📊 进度: ${i + 1}/${remainingFiles.length} (${((i + 1) / remainingFiles.length * 100).toFixed(1)}%)`);
      console.log(`✅ 成功: ${results.success} | ⚠️ 不存在: ${results.notFound} | ❌ 失败: ${results.failed} | ⏱️ 超时: ${results.timeout}\n`);
    }
    
    // 添加延迟避免API限制
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 删除操作完成');
  console.log('==========================================');
  console.log(`✅ 成功删除: ${results.success} 条记录`);
  console.log(`⚠️ 记录不存在: ${results.notFound} 条记录`);
  console.log(`❌ 删除失败: ${results.failed} 条记录`);
  console.log(`⏱️ 操作超时: ${results.timeout} 条记录`);
  console.log(`📈 成功率: ${((results.success / remainingFiles.length) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ 失败记录详情:');
    results.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.filename}: ${error.error}`);
    });
  }
  
  // 生成删除报告
  const reportTime = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'reports', `batch-delete-remaining-${reportTime}.json`);
  
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: remainingFiles.length,
    results,
    method: 'filename_exact_match_with_timeout'
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
    await batchDeleteRemainingFiles();
  } catch (error) {
    console.error('❌ 批量删除过程中出错:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
