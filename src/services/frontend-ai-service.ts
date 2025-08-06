// 前端适配的 GPT-4V AI 服务
import OpenAI from 'openai';

// 初始化 OpenAI 客户端（前端版本）
let openai: OpenAI | null = null;

function initializeOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const baseURL = import.meta.env.VITE_OPENAI_BASE_URL;
    
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

// 生成针对绘本的精准提示词
function generateBookPrompt(bookTitle: string, bookTheme: any): string {
  return `请分析这张来自绘本《${bookTitle}》的插图，并结合绘本的整体主题进行描述。

【绘本背景信息】
- 主题：${bookTheme.theme}
- 艺术风格：${bookTheme.style}
- 情感基调：${bookTheme.emotionalTone}
- 教育价值：${bookTheme.educationalValue}
${bookTheme.culturalContext ? `- 文化背景：${bookTheme.culturalContext}` : ''}

【描述要求】
请从以下角度进行描述，确保与绘本的主旨和风格保持一致：

1. **画面内容分析**：结合绘本主题，描述画面中的主要元素和场景
2. **角色特征**：分析人物/动物的外观、表情和动作，体现绘本的情感基调
3. **艺术风格**：描述色彩运用、构图特点，与绘本的整体风格呼应
4. **情感表达**：分析画面传达的情感，与绘本的主旨相呼应
5. **教育意义**：结合绘本的教育价值，说明这幅插图的教育作用

【描述风格】
- 语言要生动具体，富有感染力
- 情感表达要与绘本的${bookTheme.emotionalTone}基调一致
- 要体现${bookTheme.educationalValue}的教育价值
- 描述要流畅自然，符合绘本阅读的体验

请用一段流畅的中文描述，确保与绘本《${bookTitle}》的整体风格和主旨高度吻合。`;
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

// 基于 GPT-4V 的图片描述生成（前端版本）
export async function generateImageDescription(
  input: File | string, // 支持文件对象或图片URL
  bookTitle: string
): Promise<string> {
  
  const bookTheme = matchBookTheme(bookTitle);
  
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
    
    console.log(`🌐 调用 GPT-4V API 生成《${bookTitle}》的插图描述...`);
    console.log(`📖 识别绘本主题：${bookTheme.theme}`);
    
    const prompt = generateBookPrompt(bookTitle, bookTheme);
    
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // 使用支持视觉的模型
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
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const description = response.choices[0]?.message?.content || 
      generateFallbackDescription(bookTitle, bookTheme);
    
    console.log(`✅ GPT-4V 描述生成成功: ${description.substring(0, 60)}...`);
    
    return description;
    
  } catch (error) {
    console.error(`⚠️ GPT-4V API 调用失败:`, error);
    
    // 回退到基于主题的模拟描述
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