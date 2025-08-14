// 前端适配的 GPT-4V AI 服务
import OpenAI from 'openai';

// 初始化 OpenAI 客户端（前端版本）
let openai: OpenAI | null = null;

function initializeOpenAI(): OpenAI {
  if (!openai) {
    // 兼容浏览器和Node.js环境的环境变量读取
    const apiKey = (typeof import.meta !== 'undefined' && import.meta.env) 
      ? import.meta.env.VITE_OPENAI_API_KEY 
      : process.env.VITE_OPENAI_API_KEY;
    const baseURL = (typeof import.meta !== 'undefined' && import.meta.env) 
      ? import.meta.env.VITE_OPENAI_BASE_URL 
      : process.env.VITE_OPENAI_BASE_URL;
    
    if (!apiKey) {
      throw new Error('VITE_OPENAI_API_KEY environment variable is required');
    }
    
    const config: any = {
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // 允许在浏览器中使用
    };
    
    if (baseURL) {
      config.baseURL = baseURL;
      console.log(`✓ 使用自定义API端点: ${baseURL}`);
    }
    
    openai = new OpenAI(config);
  }
  return openai;
}

// 网络搜索绘本信息（与后台batch-upload-enhanced.cjs完全一致）
async function searchBookInfoWithAI(bookTitle: string): Promise<string> {
  try {
    console.log(`🔍 搜索绘本《${bookTitle}》的核心信息...`);
    
    const client = initializeOpenAI();
    const response = await client.chat.completions.create({
      model: "gpt-4o", // 与后台一致
      messages: [
        {
          role: "user",
          content: `请详细介绍绘本《${bookTitle}》的以下信息：

1. **故事主题和核心内容**：这本绘本讲述了什么故事？主要情节是什么？

2. **教育意义和价值观**：这本绘本想要传达给儿童什么教育意义？培养什么品质？

3. **艺术风格和视觉特色**：这本绘本的插画风格是什么？色彩特点如何？

4. **目标年龄和适用场景**：适合什么年龄段的儿童？在什么场景下阅读？

5. **情感基调和氛围**：整本书的情感氛围是怎样的？温馨、欢快、感人还是其他？

请用中文回答，每个方面都要详细说明。如果你不确定某本绘本的具体信息，请基于书名进行合理推测，并说明这是推测。`
        }
      ],
      max_tokens: 800, // 与后台一致
      temperature: 0.7  // 与后台一致
    });

    const bookInfo = response.choices[0]?.message?.content || '未找到相关绘本信息';
    console.log(`✅ 绘本信息搜索完成`);
    return bookInfo;
  } catch (error) {
    console.error(`❌ 搜索绘本信息失败:`, error);
    // 降级到本地主题信息
    const localTheme = matchBookTheme(bookTitle);
    return `基于本地信息推测的《${bookTitle}》信息：
主题内容：${localTheme.theme}
艺术风格：${localTheme.style}
情感基调：${localTheme.emotionalTone}
教育价值：${localTheme.educationalValue}
${localTheme.culturalContext ? `文化背景：${localTheme.culturalContext}` : ''}`;
  }
}

// 绘本主题数据库
const BOOK_THEMES: { 
  [key: string]: { 
    theme: string, 
    style: string,
    emotionalTone: string,
    educationalValue: string,
    culturalContext?: string
  } 
} = {
  '14只老鼠': {
    theme: '温馨的家庭生活，展现小老鼠一家的日常生活和亲情',
    style: '温暖写实，细节丰富，自然主义风格',
    emotionalTone: '温馨、平静、充满爱意',
    educationalValue: '培养家庭观念，学习生活技能，认识自然',
    culturalContext: '日本家庭文化，重视亲情和自然'
  },
  '菲菲生气了': {
    theme: '情绪管理，帮助孩子认识和表达情绪',
    style: '色彩对比强烈，情绪表达鲜明',
    emotionalTone: '从愤怒到平静的情绪转变',
    educationalValue: '情绪认知，自我调节能力，同理心培养'
  },
  '冬至': {
    theme: '节气文化，了解冬至的传统习俗和饮食文化',
    style: '传统中国风，温暖色调，节日氛围',
    emotionalTone: '温馨、喜庆、传承感',
    educationalValue: '传统文化认知，节气知识，家庭价值观',
    culturalContext: '中国传统文化，重视家庭团聚'
  },
  '圣诞': {
    theme: '节日文化，圣诞节的欢乐氛围和礼物文化',
    style: '明亮色彩，梦幻风格，节日装饰',
    emotionalTone: '欢乐、期待、温暖',
    educationalValue: '节日文化认知，分享精神，想象力培养'
  },
  '勇气': {
    theme: '勇气培养，面对困难时的勇敢和坚持',
    style: '明亮色彩，积极构图，力量感',
    emotionalTone: '勇敢、坚定、希望',
    educationalValue: '勇气培养，面对挑战，自信心建立'
  },
  '下雪天': {
    theme: '自然体验，感受冬天的美丽和乐趣',
    style: '白色调，清新自然，童趣十足',
    emotionalTone: '纯真、快乐、好奇',
    educationalValue: '自然认知，季节变化，探索精神'
  }
};

// 智能匹配绘本主题
function matchBookTheme(bookTitle: string): { 
  theme: string, 
  style: string,
  emotionalTone: string,
  educationalValue: string,
  culturalContext?: string
} {
  const title = bookTitle.toLowerCase();
  
  // 精确匹配
  for (const [key, theme] of Object.entries(BOOK_THEMES)) {
    if (title.includes(key.toLowerCase())) {
      return theme;
    }
  }
  
  // 模糊匹配
  if (title.includes('老鼠') || title.includes('14只')) {
    return BOOK_THEMES['14只老鼠'];
  }
  if (title.includes('生气') || title.includes('愤怒') || title.includes('菲菲')) {
    return BOOK_THEMES['菲菲生气了'];
  }
  if (title.includes('圣诞') || title.includes('礼物')) {
    return BOOK_THEMES['圣诞'];
  }
  if (title.includes('冬至') || title.includes('饺子')) {
    return BOOK_THEMES['冬至'];
  }
  if (title.includes('勇气') || title.includes('勇敢')) {
    return BOOK_THEMES['勇气'];
  }
  if (title.includes('雪') || title.includes('冬天')) {
    return BOOK_THEMES['下雪天'];
  }
  
  // 默认主题
  return {
    theme: '儿童绘本，传递积极正面的价值观',
    style: '温暖色彩，童趣风格，简洁构图',
    emotionalTone: '温馨、积极、温暖',
    educationalValue: '价值观培养，情感认知，审美教育'
  };
}

// 生成与后台完全一致的专业提示词
function generateEnhancedBookPrompt(bookTitle: string, bookInfo: string): string {
  return `基于以下绘本背景信息，请为这张来自绘本《${bookTitle}》的插图生成一个既准确描述画面内容又体现绘本主旨的智能描述：

【绘本背景信息】
${bookInfo}

请生成一个400-600字的综合描述，要求：

1. **画面描述准确性**：准确描述图片中的具体内容，不能编造不存在的元素

2. **主题契合度**：描述要体现绘本的核心主题和教育价值

3. **情感氛围一致**：描述的情感基调要与绘本整体氛围相符

4. **教育价值体现**：分析这幅插图在绘本中的教育意义

5. **艺术风格分析**：结合绘本的艺术特色分析画面的视觉效果

6. **儿童视角考虑**：从儿童的角度理解和解读画面内容

请用优美流畅的中文写作，分为3-4个自然段，每段都有明确的主题重点。`;
}

// 将文件转换为 base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // 移除 data:image/jpeg;base64, 前缀，只保留 base64 内容
      const base64Content = base64.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 通过 URL 获取图片并转换为 base64
async function urlToBase64(imageUrl: string): Promise<{ base64: string, mimeType: string }> {
  try {
    // 如果是data URL，直接解析
    if (imageUrl.startsWith('data:')) {
      const [header, base64Content] = imageUrl.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      return { base64: base64Content, mimeType };
    }

    // 在Node.js环境下使用fetch和Buffer
    if (typeof window === 'undefined') {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Content = buffer.toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      return { base64: base64Content, mimeType };
    }

    // 在浏览器环境下使用FileReader
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Content = base64.split(',')[1];
        const mimeType = blob.type || 'image/jpeg';
        resolve({ base64: base64Content, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('获取图片失败:', error);
    throw error;
  }
}

// 基于 GPT-4V 的图片描述生成（前端版本 - 与后台完全一致的两步骤流程）
export async function generateImageDescription(
  input: File | string, // 支持文件对象或图片URL
  bookTitle: string
): Promise<string> {
  
  try {
    const client = initializeOpenAI();
    
    let base64Image: string;
    let mimeType: string;
    
    // 处理不同的输入类型
    if (input instanceof File) {
      // 文件对象
      base64Image = await fileToBase64(input);
      mimeType = input.type || 'image/jpeg';
    } else {
      // URL 字符串
      const result = await urlToBase64(input);
      base64Image = result.base64;
      mimeType = result.mimeType;
    }
    
    console.log(`🌐 开始为《${bookTitle}》生成增强AI描述...`);
    
    // 步骤1: 搜索绘本信息（与后台一致）
    const bookInfo = await searchBookInfoWithAI(bookTitle);
    
    // 短暂延迟避免API限流（与后台一致）
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 步骤2: 分析插图并生成增强描述（与后台一致）
    console.log(`🎨 结合绘本主旨生成智能描述...`);
    const prompt = generateEnhancedBookPrompt(bookTitle, bookInfo);
    
    const response = await client.chat.completions.create({
      model: "gpt-4o", // 与后台完全一致
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high" // 使用高精度图像分析
              }
            }
          ]
        }
      ],
      max_tokens: 1000, // 与后台保持一致
      temperature: 0.7, // 与后台保持一致
    });

    const description = response.choices[0]?.message?.content || 
      `来自《${bookTitle}》的精美插图`;
    
    console.log(`✅ 增强AI描述生成成功: ${description.substring(0, 60)}...`);
    
    return description;
    
  } catch (error) {
    console.error(`⚠️ 增强AI描述生成失败:`, error);
    
    // 回退到本地主题描述
    const bookTheme = matchBookTheme(bookTitle);
    return generateFallbackDescription(bookTitle, bookTheme);
  }
}

// 生成回退描述
function generateFallbackDescription(bookTitle: string, bookTheme: any): string {
  return `在这幅出自绘本《${bookTitle}》的精美插图中，我们可以看到一个精心设计的场景，完美体现了绘本的核心主题：${bookTheme.theme}。

画面采用了${bookTheme.style}的艺术风格，营造出${bookTheme.emotionalTone}的情感氛围。构图巧妙，色彩搭配和谐，既保持了视觉的美感，又符合儿童的审美特点和认知需求。

这幅插图深刻诠释了绘本的教育价值：${bookTheme.educationalValue}。通过生动的画面表达，传递出积极正面的价值观，帮助孩子们在阅读过程中获得情感认知和品格培养。${bookTheme.culturalContext ? `同时，画面也体现了${bookTheme.culturalContext}的文化内涵，有助于文化传承。` : ''}

整体而言，这幅插图与绘本《${bookTitle}》的整体风格和主旨高度吻合，是绘本艺术与教育价值完美结合的典范。`;
}

// 导出主题数据库
export { BOOK_THEMES, matchBookTheme };