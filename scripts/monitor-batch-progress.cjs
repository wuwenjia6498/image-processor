#!/usr/bin/env node

/**
 * 批量上传进度监控脚本
 * 功能：
 * 1. 实时监控批量上传进度
 * 2. 显示详细的统计信息
 * 3. 监控系统资源使用情况
 * 4. 提供进度预估和ETA
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: '.env.local' });

// 监控配置
const MONITOR_CONFIG = {
  REFRESH_INTERVAL: 5000, // 5秒刷新一次
  HISTORY_SIZE: 20, // 保留20个历史数据点
  DISPLAY_LINES: 25 // 显示行数
};

// 监控状态
let monitorState = {
  isRunning: true,
  startTime: new Date(),
  history: [],
  lastStats: null
};

// 初始化Supabase客户端
let supabase;

function initializeSupabase() {
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  } catch (error) {
    console.error('❌ Supabase初始化失败:', error.message);
    process.exit(1);
  }
}

// 清屏函数
function clearScreen() {
  process.stdout.write('\x1B[2J\x1B[0f');
}

// 获取系统资源使用情况
function getSystemStats() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    cpuCount: cpus.length,
    memoryUsage: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentage: ((usedMem / totalMem) * 100).toFixed(1)
    },
    loadAverage: os.loadavg(),
    uptime: os.uptime()
  };
}

// 从数据库获取处理统计
async function getDatabaseStats() {
  try {
    // 获取总记录数
    const { count: totalCount, error: countError } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    // 获取最近处理的记录
    const { data: recentRecords, error: recentError } = await supabase
      .from('illustrations_optimized')
      .select('created_at, filename, book_title')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentError) throw recentError;
    
    // 获取今天处理的记录数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount, error: todayError } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    if (todayError) throw todayError;
    
    return {
      totalRecords: totalCount || 0,
      todayRecords: todayCount || 0,
      recentRecords: recentRecords || [],
      timestamp: new Date()
    };
  } catch (error) {
    return {
      totalRecords: 0,
      todayRecords: 0,
      recentRecords: [],
      error: error.message,
      timestamp: new Date()
    };
  }
}

// 读取最新的处理报告
function getLatestReport() {
  try {
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      return null;
    }
    
    const reportFiles = fs.readdirSync(reportDir)
      .filter(file => file.startsWith('batch-upload-report-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (reportFiles.length === 0) {
      return null;
    }
    
    const latestReportPath = path.join(reportDir, reportFiles[0]);
    const report = JSON.parse(fs.readFileSync(latestReportPath, 'utf8'));
    
    return {
      ...report,
      reportFile: reportFiles[0]
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 计算处理速度和ETA
function calculateProgress(currentStats, history) {
  if (history.length < 2) return null;
  
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  
  const timeDiff = (latest.timestamp - previous.timestamp) / 1000; // 秒
  const recordDiff = latest.totalRecords - previous.totalRecords;
  
  const processingRate = recordDiff / timeDiff; // 记录/秒
  
  return {
    processingRate: processingRate,
    recordsPerMinute: processingRate * 60,
    recordsPerHour: processingRate * 3600
  };
}

// 格式化数字显示
function formatNumber(num) {
  return num.toLocaleString();
}

// 格式化文件大小
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化时间
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}时${minutes}分${secs}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${secs}秒`;
  } else {
    return `${secs}秒`;
  }
}

// 创建进度条
function createProgressBar(current, total, width = 30) {
  if (total === 0) return '▓'.repeat(width);
  
  const percentage = Math.min(current / total, 1);
  const filled = Math.floor(percentage * width);
  const empty = width - filled;
  
  return '▓'.repeat(filled) + '░'.repeat(empty) + ` ${(percentage * 100).toFixed(1)}%`;
}

// 显示监控界面
async function displayMonitoringInterface() {
  clearScreen();
  
  const systemStats = getSystemStats();
  const dbStats = await getDatabaseStats();
  const reportStats = getLatestReport();
  const currentTime = new Date();
  
  // 添加到历史记录
  monitorState.history.push(dbStats);
  if (monitorState.history.length > MONITOR_CONFIG.HISTORY_SIZE) {
    monitorState.history.shift();
  }
  
  const progress = calculateProgress(dbStats, monitorState.history);
  const monitorDuration = (currentTime - monitorState.startTime) / 1000;
  
  console.log('🖼️  ===== 批量图片上传监控面板 =====');
  console.log(`⏰ 监控时间: ${currentTime.toLocaleString()}`);
  console.log(`🕐 监控运行: ${formatDuration(monitorDuration)}`);
  console.log('');
  
  // 数据库统计
  console.log('📊 数据库统计:');
  if (dbStats.error) {
    console.log(`   ❌ 数据库连接错误: ${dbStats.error}`);
  } else {
    console.log(`   📈 总记录数: ${formatNumber(dbStats.totalRecords)}`);
    console.log(`   📅 今日新增: ${formatNumber(dbStats.todayRecords)}`);
    
    if (progress) {
      console.log(`   ⚡ 处理速度: ${progress.recordsPerMinute.toFixed(2)} 记录/分钟`);
      console.log(`   📊 小时速率: ${progress.recordsPerHour.toFixed(0)} 记录/小时`);
    }
  }
  console.log('');
  
  // 最新报告统计
  console.log('📄 最新处理报告:');
  if (reportStats) {
    if (reportStats.error) {
      console.log(`   ❌ 报告读取错误: ${reportStats.error}`);
    } else {
      console.log(`   📁 报告文件: ${reportStats.reportFile}`);
      console.log(`   📊 总文件数: ${formatNumber(reportStats.total || 0)}`);
      console.log(`   ✅ 成功处理: ${formatNumber(reportStats.success || 0)}`);
      console.log(`   ❌ 处理失败: ${formatNumber(reportStats.failed || 0)}`);
      console.log(`   ⏭️ 跳过文件: ${formatNumber(reportStats.skipped || 0)}`);
      
      if (reportStats.total > 0) {
        const successRate = ((reportStats.success || 0) / reportStats.total * 100).toFixed(1);
        console.log(`   📈 成功率: ${successRate}%`);
        
        // 进度条
        const progressBar = createProgressBar(
          (reportStats.success || 0) + (reportStats.failed || 0) + (reportStats.skipped || 0),
          reportStats.total
        );
        console.log(`   📊 进度: ${progressBar}`);
      }
      
      if (reportStats.startTime) {
        const reportDuration = reportStats.endTime ? 
          (new Date(reportStats.endTime) - new Date(reportStats.startTime)) / 1000 :
          (currentTime - new Date(reportStats.startTime)) / 1000;
        console.log(`   ⏱️ 处理时长: ${formatDuration(reportDuration)}`);
      }
    }
  } else {
    console.log('   ℹ️ 未找到处理报告');
  }
  console.log('');
  
  // 系统资源统计
  console.log('💻 系统资源:');
  console.log(`   🖥️ CPU核心: ${systemStats.cpuCount}`);
  console.log(`   📊 负载平均: ${systemStats.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
  console.log(`   🧠 内存使用: ${formatBytes(systemStats.memoryUsage.used)} / ${formatBytes(systemStats.memoryUsage.total)} (${systemStats.memoryUsage.percentage}%)`);
  console.log(`   ⏳ 系统运行: ${formatDuration(systemStats.uptime)}`);
  console.log('');
  
  // 最近处理的文件
  if (dbStats.recentRecords && dbStats.recentRecords.length > 0) {
    console.log('📝 最近处理的文件:');
    dbStats.recentRecords.slice(0, 5).forEach((record, index) => {
      const timeAgo = new Date() - new Date(record.created_at);
      const timeAgoStr = timeAgo < 60000 ? 
        `${Math.floor(timeAgo / 1000)}秒前` :
        `${Math.floor(timeAgo / 60000)}分钟前`;
      console.log(`   ${index + 1}. ${record.filename} (${record.book_title}) - ${timeAgoStr}`);
    });
    console.log('');
  }
  
  // 操作提示
  console.log('🎛️  操作指南:');
  console.log('   • 按 Ctrl+C 退出监控');
  console.log('   • 按 R + Enter 刷新显示');
  console.log('   • 按 H + Enter 显示帮助');
  console.log('');
  console.log(`⏰ 下次刷新: ${MONITOR_CONFIG.REFRESH_INTERVAL / 1000}秒后`);
  console.log('═'.repeat(60));
}

// 显示帮助信息
function showHelp() {
  clearScreen();
  console.log('🖼️  批量图片上传监控 - 帮助信息');
  console.log('═'.repeat(50));
  console.log('');
  console.log('📋 功能说明:');
  console.log('   • 实时监控数据库中的图片记录数量');
  console.log('   • 显示最新的批量处理报告状态');
  console.log('   • 监控系统资源使用情况');
  console.log('   • 计算处理速度和进度预估');
  console.log('');
  console.log('🎛️  操作说明:');
  console.log('   Ctrl+C     - 退出监控');
  console.log('   R + Enter  - 立即刷新显示');
  console.log('   H + Enter  - 显示此帮助信息');
  console.log('   Q + Enter  - 退出监控');
  console.log('');
  console.log('📊 数据说明:');
  console.log('   • 总记录数: 数据库中的图片总数');
  console.log('   • 今日新增: 今天新增的图片记录');
  console.log('   • 处理速度: 基于历史数据计算的平均速度');
  console.log('   • 成功率: 批量处理的成功比例');
  console.log('');
  console.log('按任意键返回监控界面...');
  
  return new Promise(resolve => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

// 处理用户输入
function handleUserInput() {
  process.stdin.setRawMode(false);
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', async (input) => {
    const command = input.toString().trim().toLowerCase();
    
    switch (command) {
      case 'r':
        await displayMonitoringInterface();
        break;
      case 'h':
        await showHelp();
        await displayMonitoringInterface();
        break;
      case 'q':
        console.log('\n👋 监控已退出');
        process.exit(0);
        break;
    }
  });
}

// 主监控函数
async function startMonitoring() {
  console.log('🚀 启动批量上传监控...\n');
  
  // 初始化
  initializeSupabase();
  handleUserInput();
  
  // 首次显示
  await displayMonitoringInterface();
  
  // 定时刷新
  const refreshInterval = setInterval(async () => {
    if (monitorState.isRunning) {
      await displayMonitoringInterface();
    }
  }, MONITOR_CONFIG.REFRESH_INTERVAL);
  
  // 优雅退出处理
  process.on('SIGINT', () => {
    clearInterval(refreshInterval);
    console.log('\n\n👋 监控已停止');
    process.exit(0);
  });
}

// 命令行参数处理
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('批量上传监控工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/monitor-batch-progress.js');
    console.log('');
    console.log('功能:');
    console.log('  • 实时监控批量上传进度');
    console.log('  • 显示处理统计和系统资源');
    console.log('  • 提供进度预估和ETA');
    console.log('');
    console.log('快捷键:');
    console.log('  Ctrl+C     - 退出');
    console.log('  R + Enter  - 刷新');
    console.log('  H + Enter  - 帮助');
    console.log('  Q + Enter  - 退出');
    return;
  }
  
  startMonitoring().catch(error => {
    console.error('❌ 监控启动失败:', error.message);
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = { startMonitoring }; 