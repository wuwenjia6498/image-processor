#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkAIDescriptions() {
  console.log('🔍 检查数据库中的AI描述样本...\n');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 获取现有的AI描述样本
    const { data: oldSamples, error: oldError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, ai_description, created_at')
      .not('ai_description', 'is', null)
      .order('created_at', { ascending: true })
      .limit(3);

    if (oldError) throw oldError;

    console.log('📋 现有AI描述样本 (较早创建):');
    console.log('=' .repeat(60));
    oldSamples?.forEach((sample, index) => {
      console.log(`\n${index + 1}. 文件: ${sample.filename}`);
      console.log(`   ID: ${sample.id}`);
      console.log(`   创建时间: ${new Date(sample.created_at).toLocaleString()}`);
      console.log(`   AI描述: ${sample.ai_description}`);
      console.log('-'.repeat(60));
    });

    // 获取最新的AI描述样本
    const { data: newSamples, error: newError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, ai_description, created_at')
      .not('ai_description', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);

    if (newError) throw newError;

    console.log('\n📋 最新AI描述样本 (最近创建):');
    console.log('=' .repeat(60));
    newSamples?.forEach((sample, index) => {
      console.log(`\n${index + 1}. 文件: ${sample.filename}`);
      console.log(`   ID: ${sample.id}`);
      console.log(`   创建时间: ${new Date(sample.created_at).toLocaleString()}`);
      console.log(`   AI描述: ${sample.ai_description}`);
      console.log('-'.repeat(60));
    });

    // 检查ID格式
    console.log('\n🔍 ID格式分析:');
    console.log('=' .repeat(60));
    
    const { data: allRecords, error: allError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (allError) throw allError;

    allRecords?.forEach((record, index) => {
      const hasChineseInId = /[\u4e00-\u9fa5]/.test(record.id);
      console.log(`${index + 1}. ID: ${record.id}`);
      console.log(`   文件名: ${record.filename}`);
      console.log(`   包含中文: ${hasChineseInId ? '是' : '否'}`);
      console.log(`   创建时间: ${new Date(record.created_at).toLocaleString()}`);
      console.log('-'.repeat(40));
    });

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

checkAIDescriptions(); 