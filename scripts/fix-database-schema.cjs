#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少Supabase配置信息');
  console.error('请检查 .env.local 文件中的 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDatabaseSchema() {
  console.log('🔧 开始修复数据库表结构...');
  
  try {
    // 执行SQL修复脚本
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- 检查并添加 ai_description 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'illustrations_optimized' 
                AND column_name = 'ai_description'
            ) THEN
                ALTER TABLE illustrations_optimized 
                ADD COLUMN ai_description TEXT;
                RAISE NOTICE '✅ ai_description 字段已添加';
            ELSE
                RAISE NOTICE '✅ ai_description 字段已存在';
            END IF;
        END $$;
        
        -- 显示当前表结构
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'illustrations_optimized' 
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      console.error('❌ 数据库修复失败:', error);
      
      // 尝试直接查询表结构
      console.log('📋 尝试查询当前表结构...');
      const { data: columns, error: columnError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'illustrations_optimized')
        .order('ordinal_position');
        
      if (columnError) {
        console.error('❌ 查询表结构失败:', columnError);
      } else {
        console.log('📊 当前表结构:');
        columns.forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type})`);
        });
      }
    } else {
      console.log('✅ 数据库结构修复完成');
      console.log('📊 表结构信息:', data);
    }
    
  } catch (error) {
    console.error('❌ 修复过程出错:', error);
  }
}

fixDatabaseSchema();
