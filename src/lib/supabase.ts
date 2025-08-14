import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 获取环境变量（兼容Node.js和浏览器环境）
function getEnvVar(key: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  return process.env[key] || '';
}

// Supabase配置
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// 单例模式的Supabase客户端
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL 和 Key 必须在环境变量中配置');
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false // 避免多实例会话冲突
      },
      global: {
        headers: {
          'X-Client-Info': 'image-processor-client',
          'Connection': 'keep-alive'
        },
        // 设置全局超时
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            // 设置35秒超时（略长于数据库函数超时）
            signal: AbortSignal.timeout(35000)
          });
        }
      },
      db: {
        schema: 'public'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  }
  
  return supabaseInstance;
}

// 导出默认实例（向后兼容）
export const supabase = getSupabaseClient(); 