import OpenAI from 'openai';

// 前端环境变量配置
const apiKey: string = import.meta.env.VITE_OPENAI_API_KEY || 'sk-proj-xxx';
const baseURL: string = import.meta.env.VITE_OPENAI_BASE_URL || 'https://aihubmix.com/v1';

export const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL, // 使用第三方API服务
  dangerouslyAllowBrowser: true, // 允许在浏览器环境中使用
});

// 检查API密钥是否有效
export function isOpenAIAvailable(): boolean {
  return Boolean(apiKey && apiKey !== 'sk-proj-xxx' && apiKey.startsWith('sk-'));
} 