#!/usr/bin/env node

// 只更新AI描述，不重新上传图片
const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env.local' });

// 绘本主题数据库
const BOOK_THEMES = {
  '14只老鼠': {
    theme: '温馨的家庭生活，展现小老鼠一家的日常生活和亲情',
    keywords: ['家庭', '亲情', '日常生活', '温馨', '自然'],
    age: '幼儿',
    textType: '睡前故事'
  },
  '你好！空间站': {
    theme: '太空探索，激发孩子对科学和宇宙的好奇心',
    keywords: ['太空', '科学', '探索', '宇宙', '科技'],
    age: '小学低年级',
    textType: '科普知识'
  },
  '三个和尚': {
    theme: '传统文化，团结合作的精神',
    keywords: ['传统文化', '团结', '合作', '寺院', '和尚'],
    age: '小学低年级',
    textType: '传统文化教育'
  },
  '下雪天': {
    theme: '冬季的乐趣，童真童趣',
    keywords: ['冬季', '雪', '童趣', '玩耍', '快乐'],
    age: '幼儿',
    textType: '睡前故事'
  },
  '不可思议的旅程': {
    theme: '奇幻冒险，想象力的培养',
    keywords: ['奇幻', '冒险', '想象力', '旅程', '梦想'],
    age: '幼儿',
    textType: '睡前故事'
  },
  '一家好认真好认真的餐厅': {
    theme: '认真工作的态度，生活教育',
    keywords: ['工作', '认真', '生活', '教育', '态度'],
    age: '幼儿',
    textType: '生活教育'
  },
  '停电以后': {
    theme: '社区互助，邻里关系',
    keywords: ['社区', '互助', '邻里', '夜晚', '温馨'],
    age: '幼儿',
    textType: '睡前故事'
  },
  '先左脚，再右脚': {
    theme: '家庭亲情，成长陪伴',
    keywords: ['家庭', '亲情', '成长', '陪伴', '温馨'],
    age: '幼儿',
    textType: '睡前故事'
  },
  '兔子滑雪': {
    theme: '冬季运动，友谊和快乐',
    keywords: ['冬季', '滑雪', '友谊', '快乐', '运动'],
    age: '幼儿',
    textType: '睡前故事'
  },
  '冬至·饺子宴': {
    theme: '节气文化，了解冬至的传统习俗和饮食文化',
    keywords: ['节气', '冬至', '饺子', '传统文化'],
    age: '小学低年级',
    textType: '传统文化教育'
  },
  '100个圣诞老人': {
    theme: '节日文化，圣诞节的欢乐氛围和礼物文化',
    keywords: ['圣诞节', '礼物', '欢乐', '节日'],
    age: '幼儿',
    textType: '节日故事'
  }
};

// 智能匹配绘本主题
function matchBookTheme(bookTitle) {
  const title = bookTitle.toLowerCase();
  for (const [key, theme] of Object.entries(BOOK_THEMES)) {
    if (title.includes(key.toLowerCase())) {
      return theme;
    }
  }
  
  // 模糊匹配
  for (const [key, theme] of Object.entries(BOOK_THEMES)) {
    const keyWords = key.toLowerCase().split(/[\s·]+/);
    if (keyWords.some(word => title.includes(word))) {
      return theme;
    }
  }
  
  // 默认主题
  return {
    theme: '儿童绘本，传递积极正面的价值观',
    keywords: ['儿童', '绘本', '教育', '成长'],
    age: '幼儿',
    textType: '睡前故事'
  };
}

// 生成增强版AI描述
async function generateEnhancedDescription(originalDescription, bookTitle) {
  const bookTheme = matchBookTheme(bookTitle);
  
  // 基于原始描述和绘本主题生成增强描述
  const enhancedDescription = `在绘本《${bookTitle}》的插图中，${originalDescription}这幅插图完美地契合了绘本"${bookTheme.theme}"的主题，通过${bookTheme.keywords.join('、')}等元素，传递出积极正面的价值观，适合${bookTheme.age}儿童阅读，具有重要的教育意义。`;
  
  return {
    description: enhancedDescription,
    ageOrientation: bookTheme.age,
    textTypeFit: bookTheme.textType,
    bookTheme: bookTheme.theme,
    keywords: bookTheme.keywords
  };
}

async function updateAIDescriptionsOnly() {
  try {
    console.log('🔄 开始更新AI描述（不重新上传图片）...\n');
    
    // 配置Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 配置Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const index = pinecone.index('image-processor-project');
    
    // 查询所有记录
    console.log('📊 查询数据库记录...');
    const { data: records, error: queryError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, ai_description, age_orientation, text_type_fit');
    
    if (queryError) {
      console.log(`❌ 查询失败: ${queryError.message}`);
      return;
    }
    
    console.log(`✅ 找到 ${records.length} 条记录\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const record of records) {
      console.log(`🖼️ 处理: ${record.filename}`);
      
      // 检查是否已经是增强版描述
      const isEnhanced = record.ai_description && (
        record.ai_description.includes('主题') || 
        record.ai_description.includes('教育意义') || 
        record.ai_description.includes('价值观') ||
        record.ai_description.includes('适合') ||
        record.ai_description.includes('传递')
      );
      
      if (isEnhanced) {
        console.log(`   ⏭️ 已是增强版描述，跳过`);
        skippedCount++;
        continue;
      }
      
      // 生成增强版描述
      const bookTitle = record.book_title || record.filename;
      const enhancedResult = await generateEnhancedDescription(
        record.ai_description || '画面展现了一个温馨的场景',
        bookTitle
      );
      
      console.log(`   📖 绘本标题: ${bookTitle}`);
      console.log(`   ✅ 年龄定位: ${enhancedResult.ageOrientation}`);
      console.log(`   ✅ 文本类型: ${enhancedResult.textTypeFit}`);
      console.log(`   ✅ 绘本主题: ${enhancedResult.bookTheme}`);
      console.log(`   ✅ 关键词: ${enhancedResult.keywords.join('、')}`);
      
      // 更新Supabase
      const { error: updateError } = await supabase
        .from('illustrations_optimized')
        .update({
          ai_description: enhancedResult.description,
          age_orientation: enhancedResult.ageOrientation,
          text_type_fit: enhancedResult.textTypeFit,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);
      
      if (updateError) {
        console.log(`   ❌ Supabase更新失败: ${updateError.message}`);
        continue;
      }
      
      // 更新Pinecone
      try {
        await index.update({
          id: record.id,
          setMetadata: {
            description: enhancedResult.description,
            age_orientation: enhancedResult.ageOrientation,
            text_type_fit: enhancedResult.textTypeFit,
            book_theme: enhancedResult.bookTheme,
            keywords: enhancedResult.keywords,
            updated_at: new Date().toISOString()
          }
        });
        console.log(`   ✅ Pinecone更新成功`);
      } catch (pineconeError) {
        console.log(`   ⚠️ Pinecone更新失败: ${pineconeError.message}`);
      }
      
      console.log(`   ✅ 更新完成\n`);
      updatedCount++;
      
      // 添加延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('📊 更新统计:');
    console.log(`   ✅ 成功更新: ${updatedCount} 条记录`);
    console.log(`   ⏭️ 跳过（已是增强版）: ${skippedCount} 条记录`);
    console.log(`   📊 总记录数: ${records.length} 条`);
    
    console.log('\n🎉 AI描述更新完成！');
    
  } catch (error) {
    console.error('❌ 更新过程中发生错误:', error);
  }
}

updateAIDescriptionsOnly(); 