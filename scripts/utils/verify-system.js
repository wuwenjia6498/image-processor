#!/usr/bin/env node

import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// 加载环境变量
dotenv.config({ path: '.env.local' });

console.log('🔍 系统功能验证测试');
console.log('===================\n');

async function verifyEnvironmentVariables() {
  console.log('📋 1. 环境变量检查...');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'PINECONE_API_KEY',
    'PINECONE_INDEX_NAME'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log(`❌ 缺少环境变量: ${missingVars.join(', ')}`);
    return false;
  }
  
  console.log('✅ 所有必需的环境变量都已配置');
  return true;
}

async function verifySupabaseConnection() {
  console.log('\n📊 2. Supabase 连接测试...');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 测试数据库连接
    const { data, error } = await supabase
      .from('illustrations')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`❌ Supabase 数据库连接失败: ${error.message}`);
      return false;
    }
    
    console.log('✅ Supabase 数据库连接成功');
    
    // 测试存储桶连接
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
    
    if (storageError) {
      console.log(`⚠️  Supabase 存储连接失败: ${storageError.message}`);
    } else {
      const illustrationsBucket = buckets.find(b => b.name === 'illustrations');
      if (illustrationsBucket) {
        console.log('✅ Supabase 存储桶连接成功');
      } else {
        console.log('⚠️  illustrations 存储桶不存在');
      }
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Supabase 连接失败: ${error.message}`);
    return false;
  }
}

async function verifyPineconeConnection() {
  console.log('\n🌲 3. Pinecone 连接测试...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    
    const indexName = process.env.PINECONE_INDEX_NAME;
    const index = pinecone.index(indexName);
    
    // 测试索引连接
    const stats = await index.describeIndexStats();
    
    console.log('✅ Pinecone 连接成功');
    console.log(`   索引名称: ${indexName}`);
    console.log(`   向量总数: ${stats.totalVectorCount || 0}`);
    console.log(`   索引维度: ${stats.dimension || 'N/A'}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Pinecone 连接失败: ${error.message}`);
    return false;
  }
}

async function verifyDataFiles() {
  console.log('\n📁 4. 数据文件检查...');
  
  const requiredFiles = [
    'data/metadata.csv',
    'data/images/01.jpg',
    'data/images/02.jpg',
    'data/images/03.jpg',
    'data/images/04.jpg',
    'data/images/05.jpg'
  ];
  
  let allFilesExist = true;
  
  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
    } else {
      console.log(`❌ ${file} 不存在`);
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

async function verifyModelFiles() {
  console.log('\n🤖 5. AI模型文件检查...');
  
  const modelPaths = [
    'models/vit-gpt2-image-captioning',
    'models/clip-vit-base-patch32'
  ];
  
  let modelsReady = true;
  
  for (const modelPath of modelPaths) {
    const fullPath = path.join(process.cwd(), modelPath);
    const configPath = path.join(fullPath, 'config.json');
    
    if (fs.existsSync(configPath)) {
      const files = fs.readdirSync(fullPath, { recursive: true });
      const fileCount = files.filter(f => typeof f === 'string').length;
      console.log(`✅ ${modelPath} (${fileCount} 个文件)`);
    } else {
      console.log(`❌ ${modelPath} 配置文件不存在`);
      modelsReady = false;
    }
  }
  
  return modelsReady;
}

async function verifySystemIntegration() {
  console.log('\n🔗 6. 系统集成测试...');
  
  try {
    // 创建测试向量
    const testVector = Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
    const testId = `test-${Date.now()}`;
    
    // 测试 Pinecone 写入
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    await index.upsert([{
      id: testId,
      values: testVector,
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    }]);
    
    console.log('✅ Pinecone 写入测试成功');
    
    // 测试 Supabase 写入
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await supabase
      .from('illustrations')
      .upsert({
        id: testId,
        filename: 'test.jpg',
        book_title: '系统测试',
        ai_description: '这是一个系统测试记录',
        vector_embedding: testVector,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.log(`⚠️  Supabase 写入测试失败: ${error.message}`);
    } else {
      console.log('✅ Supabase 写入测试成功');
    }
    
    // 清理测试数据
    await index.deleteOne(testId);
    await supabase.from('illustrations').delete().eq('id', testId);
    
    console.log('✅ 测试数据清理完成');
    
    return true;
  } catch (error) {
    console.log(`❌ 系统集成测试失败: ${error.message}`);
    return false;
  }
}

async function generateSystemReport() {
  console.log('\n📊 系统验证报告');
  console.log('================');
  
  const results = {
    environment: await verifyEnvironmentVariables(),
    supabase: await verifySupabaseConnection(),
    pinecone: await verifyPineconeConnection(),
    dataFiles: await verifyDataFiles(),
    modelFiles: await verifyModelFiles(),
    integration: await verifySystemIntegration()
  };
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 测试结果: ${passedTests}/${totalTests} 项通过`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 系统验证完全通过！');
    console.log('✅ 您的系统已准备好投入使用');
    console.log('\n📝 下一步建议:');
    console.log('   1. 运行 npm run process 开始处理图片');
    console.log('   2. 监控处理日志确保一切正常');
    console.log('   3. 检查 Pinecone 和 Supabase 中的数据');
  } else {
    console.log('\n⚠️  系统验证未完全通过');
    console.log('❌ 需要解决以下问题:');
    
    Object.entries(results).forEach(([test, passed]) => {
      if (!passed) {
        console.log(`   - ${test} 测试失败`);
      }
    });
    
    console.log('\n💡 建议:');
    console.log('   1. 检查失败的测试项目');
    console.log('   2. 参考 NETWORK_SETUP.md 进行故障排除');
    console.log('   3. 运行 npm run network-check 进行网络诊断');
  }
  
  return results;
}

// 运行验证
generateSystemReport().catch(error => {
  console.error('❌ 验证过程中出现错误:', error);
  process.exit(1);
}); 