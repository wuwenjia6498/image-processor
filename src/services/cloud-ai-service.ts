// @ts-ignore - OpenAI package will be installed
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// 初始化OpenAI客户端
let openai: OpenAI | null = null;

function initializeOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    // 支持AIHUBMIX等第三方平台
    const config: any = {
      apiKey: process.env.OPENAI_API_KEY,
    };
    
    // 如果配置了自定义API端点（如AIHUBMIX）
    if (process.env.OPENAI_BASE_URL) {
      config.baseURL = process.env.OPENAI_BASE_URL;
      console.log(`✓ 使用自定义API端点: ${process.env.OPENAI_BASE_URL}`);
    }
    
    openai = new OpenAI(config);
  }
  return openai;
}

// 使用OpenAI GPT-4V生成图像描述
export async function generateOpenAIDescription(imagePath: string, bookTitle: string): Promise<string> {
  try {
    const client = initializeOpenAI();
    
    // 读取并编码图片为base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    
    console.log('  🌐 调用OpenAI GPT-4V API...');
    
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // 使用更经济的模型
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `请用中文详细描述这张来自绘本《${bookTitle}》的插图。描述应该包括：
1. 画面的主要内容和场景
2. 人物或动物的外观和动作
3. 色彩和艺术风格
4. 画面的情感氛围
请用一段话描述，不要使用列表格式。`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const description = response.choices[0]?.message?.content || `来自《${bookTitle}》的精美插图`;
    console.log(`  ✅ OpenAI描述生成成功: ${description.substring(0, 50)}...`);
    return description;
    
  } catch (error) {
    console.log(`  ⚠️ OpenAI API调用失败: ${error instanceof Error ? error.message : '未知错误'}`);
    // 回退到简单描述
    return `这是一幅来自《${bookTitle}》的精美插图，展现了丰富的色彩和细腻的笔触。`;
  }
}

// 使用OpenAI生成图像向量嵌入
export async function generateOpenAIEmbedding(imagePath: string): Promise<number[]> {
  try {
    console.log('  🌐 调用OpenAI Embedding API...');
    
    // 注意：OpenAI目前不直接支持图像embedding，我们需要先生成描述再生成embedding
    // 或者使用本地CLIP作为备用
    console.log('  ⚠️ OpenAI暂不支持直接图像embedding，使用模拟向量');
    
    // 生成1536维的模拟向量（与text-embedding-3-small兼容）
    return generateMockEmbedding();
    
  } catch (error) {
    console.log(`  ⚠️ OpenAI Embedding API调用失败: ${error instanceof Error ? error.message : '未知错误'}`);
    // 回退到模拟向量
    return generateMockEmbedding();
  }
}

// 生成1536维的模拟向量（与text-embedding-3-small兼容）
function generateMockEmbedding(): number[] {
  return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
}

// 检查是否应该使用云端AI服务
export function shouldUseCloudAI(): boolean {
  return process.env.USE_CLOUD_AI === 'true' && !!process.env.OPENAI_API_KEY;
}

// 混合AI服务：优先使用云端，失败时回退到本地或模拟
export async function generateHybridDescription(
  imagePath: string, 
  bookTitle: string, 
  localCaptioner: any = null
): Promise<string> {
  
  // 优先使用云端AI
  if (shouldUseCloudAI()) {
    try {
      return await generateOpenAIDescription(imagePath, bookTitle);
    } catch (error) {
      console.log('  🔄 云端AI失败，尝试本地模型...');
    }
  }
  
  // 回退到本地模型
  if (localCaptioner) {
    try {
      const result = await localCaptioner(imagePath);
      if (Array.isArray(result) && result.length > 0) {
        return result[0]?.generated_text || `AI生成的${bookTitle}描述`;
      }
    } catch (error) {
      console.log('  🔄 本地模型失败，使用模拟描述...');
    }
  }
  
  // 最终回退到模拟描述
  const descriptions = [
    `这是一幅来自《${bookTitle}》的精美插图，展现了丰富的色彩和细腻的笔触。`,
    `《${bookTitle}》中的这幅插图充满了想象力，描绘了生动的场景。`,
    `这张图片来自绘本《${bookTitle}》，画面构图巧妙，色彩搭配和谐。`,
    `《${bookTitle}》的插图风格独特，这幅作品展现了艺术家的精湛技艺。`,
    `这是《${bookTitle}》中的一个精彩瞬间，通过插图生动地表达了故事情节。`
  ];
  
  const filename = path.basename(imagePath);
  const index = filename.charCodeAt(0) % descriptions.length;
  return descriptions[index];
}

export async function generateHybridEmbedding(
  imagePath: string,
  localEmbedder: any = null
): Promise<number[]> {
  
  // 优先使用云端AI（目前OpenAI不支持直接图像embedding）
  if (shouldUseCloudAI()) {
    try {
      return await generateOpenAIEmbedding(imagePath);
    } catch (error) {
      console.log('  🔄 云端embedding失败，尝试本地模型...');
    }
  }
  
  // 回退到本地模型
  if (localEmbedder) {
    try {
      const embedding = await localEmbedder(imagePath, { pooling: 'mean', normalize: true });
      const result = Array.from(embedding.data) as number[];
      if (Array.isArray(result) && result.length === 1536) {
        return result;
      }
    } catch (error) {
      console.log('  🔄 本地embedding失败，使用模拟向量...');
    }
  }
  
  // 最终回退到模拟向量
  return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
} 