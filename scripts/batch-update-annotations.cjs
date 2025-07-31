#!/usr/bin/env node

// 批量更新待标注字段
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 绘本主题数据库
const BOOK_THEMES = {
  '14只老鼠': {
    theme: '温馨的家庭生活，展现小老鼠一家的日常生活和亲情',
    keywords: ['家庭', '亲情', '日常生活', '温馨', '自然'],
    age: '幼儿',
    textType: '睡前故事'
  },
  '菲菲生气了': {
    theme: '情绪管理，帮助孩子认识和表达情绪',
    keywords: ['情绪管理', '愤怒', '平静', '自我调节'],
    age: '幼儿',
    textType: '情绪教育'
  },
  '清明节': {
    theme: '传统文化教育，了解清明节的意义和习俗',
    keywords: ['传统文化', '清明节', '祭祖', '春游'],
    age: '小学低年级',
    textType: '传统文化教育'
  },
  '冬至': {
    theme: '节气文化，了解冬至的传统习俗和饮食文化',
    keywords: ['节气', '冬至', '饺子', '传统文化'],
    age: '小学低年级',
    textType: '传统文化教育'
  },
  '圣诞老人': {
    theme: '节日文化，圣诞节的欢乐氛围和礼物文化',
    keywords: ['圣诞节', '礼物', '欢乐', '节日'],
    age: '幼儿',
    textType: '节日故事'
  },
  '三个强盗': {
    theme: '善恶对比，从强盗到善良的转变故事',
    keywords: ['善恶', '转变', '善良', '对比'],
    age: '小学低年级',
    textType: '哲理故事'
  },
  '生气': {
    theme: '情绪认知，帮助孩子理解和管理愤怒情绪',
    keywords: ['情绪', '愤怒', '管理', '认知'],
    age: '幼儿',
    textType: '情绪教育'
  },
  '没事': {
    theme: '安全感，父母的爱和保护给孩子带来的安全感',
    keywords: ['安全感', '父母之爱', '保护', '信任'],
    age: '幼儿',
    textType: '睡前故事'
  }
};

// 智能匹配绘本主题
function matchBookTheme(bookTitle) {
  const title = bookTitle.toLowerCase();
  
  // 精确匹配
  for (const [key, theme] of Object.entries(BOOK_THEMES)) {
    if (title.includes(key.toLowerCase())) {
      return theme;
    }
  }
  
  // 模糊匹配
  if (title.includes('老鼠')) {
    return BOOK_THEMES['14只老鼠'];
  }
  if (title.includes('生气') || title.includes('愤怒')) {
    return BOOK_THEMES['生气'];
  }
  if (title.includes('圣诞')) {
    return BOOK_THEMES['圣诞老人'];
  }
  if (title.includes('强盗') || title.includes('坏人')) {
    return BOOK_THEMES['三个强盗'];
  }
  if (title.includes('没事') || title.includes('接住')) {
    return BOOK_THEMES['没事'];
  }
  if (title.includes('和尚')) {
    return { age: '小学低年级', textType: '传统文化教育' };
  }
  if (title.includes('空间站')) {
    return { age: '小学低年级', textType: '科普知识' };
  }
  if (title.includes('餐厅')) {
    return { age: '幼儿', textType: '生活教育' };
  }
  
  // 默认主题
  return {
    theme: '儿童绘本，传递积极正面的价值观',
    keywords: ['儿童', '绘本', '教育', '成长'],
    age: '幼儿',
    textType: '睡前故事'
  };
}

async function batchUpdateAnnotations() {
  try {
    console.log('🔄 开始批量更新待标注字段...\n');
    
    // 配置Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ 环境变量未正确配置');
      return;
    }
    
    console.log('✅ 环境变量配置正确');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. 获取所有待标注的记录
    console.log('🔍 查询待标注的记录...');
    const { data: pendingRecords, error: queryError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, age_orientation, text_type_fit')
      .or('age_orientation.eq.待标注,text_type_fit.eq.待标注');
    
    if (queryError) {
      console.log(`❌ 查询失败: ${queryError.message}`);
      return;
    }
    
    console.log(`📊 找到 ${pendingRecords.length} 条待标注记录`);
    
    if (pendingRecords.length === 0) {
      console.log('✅ 没有需要更新的记录');
      return;
    }
    
    // 2. 批量更新
    console.log('\n🔄 开始批量更新...');
    let successCount = 0;
    let errorCount = 0;
    
    for (const record of pendingRecords) {
      try {
        const bookTitle = record.book_title || record.filename;
        const theme = matchBookTheme(bookTitle);
        
        console.log(`   📝 更新: ${record.filename}`);
        console.log(`      📖 绘本标题: ${bookTitle}`);
        console.log(`      👶 年龄定位: ${theme.age}`);
        console.log(`      📝 文本类型: ${theme.textType}`);
        
        const { error: updateError } = await supabase
          .from('illustrations_optimized')
          .update({
            age_orientation: theme.age,
            text_type_fit: theme.textType,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
        
        if (updateError) {
          console.log(`      ❌ 更新失败: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`      ✅ 更新成功`);
          successCount++;
        }
        
        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`      ❌ 处理失败: ${error.message}`);
        errorCount++;
      }
    }
    
    // 3. 统计结果
    console.log('\n📊 批量更新完成！');
    console.log(`   ✅ 成功更新: ${successCount} 条`);
    console.log(`   ❌ 更新失败: ${errorCount} 条`);
    console.log(`   📈 成功率: ${((successCount / pendingRecords.length) * 100).toFixed(1)}%`);
    
    // 4. 验证更新结果
    console.log('\n🔍 验证更新结果...');
    const { data: updatedRecords, error: verifyError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, age_orientation, text_type_fit')
      .limit(10);
    
    if (!verifyError) {
      console.log('📊 更新后的数据样本:');
      updatedRecords.forEach(record => {
        console.log(`   📖 ${record.filename}:`);
        console.log(`      age_orientation: ${record.age_orientation}`);
        console.log(`      text_type_fit: ${record.text_type_fit}`);
      });
    }
    
    console.log('\n🎉 批量更新完成！');
    console.log('\n💡 提示: 现在您可以运行增强版图片处理来获得更完整的体验:');
    console.log('   npm run process-enhanced');
    
  } catch (error) {
    console.error('❌ 批量更新过程中发生错误:', error);
  }
}

batchUpdateAnnotations(); 