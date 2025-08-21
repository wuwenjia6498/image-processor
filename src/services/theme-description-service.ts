import { generateImageDescription } from './frontend-ai-service';
import { imageDescriptionToVector } from './unified-embedding';
import OpenAI from 'openai';

// 7个主题维度的定义
export const THEME_DIMENSIONS = {
  theme_philosophy: {
    name: '核心理念与人生主题',
    prompt: '请从核心理念与人生主题的角度分析这张插图，描述其传达的人生智慧、价值观念、成长启示等深层内涵。'
  },
  action_process: {
    name: '行动过程与成长',
    prompt: '请从行动过程与成长的角度分析这张插图，描述图中人物的行为动作、成长历程、学习过程等动态元素。'
  },
  interpersonal_roles: {
    name: '人际角色与情感连接',
    prompt: '请从人际角色与情感连接的角度分析这张插图，描述人物关系、情感交流、社会角色、亲情友情等人际互动。'
  },
  edu_value: {
    name: '阅读带来的价值',
    prompt: '请从阅读带来的价值的角度分析这张插图，描述其教育意义、知识传递、学习启发、认知发展等教育功能。'
  },
  learning_strategy: {
    name: '阅读中的学习方法',
    prompt: '请从阅读中的学习方法的角度分析这张插图，描述阅读方法、学习技巧、思维训练、理解策略等学习相关内容。'
  },
  creative_play: {
    name: '创意表现与想象力',
    prompt: '请从创意表现与想象力的角度分析这张插图，描述创意元素、想象空间、游戏性、趣味性等激发创造力的内容。'
  },
  scene_visuals: {
    name: '场景氛围与画面元素',
    prompt: '请从场景氛围与画面元素的角度分析这张插图，描述画面构图、色彩运用、环境氛围、视觉风格等艺术表现。'
  }
};

// 主题描述结果接口
export interface ThemeDescriptions {
  theme_philosophy: string;
  action_process: string;
  interpersonal_roles: string;
  edu_value: string;
  learning_strategy: string;
  creative_play: string;
  scene_visuals: string;
}

// 主题向量结果接口
export interface ThemeEmbeddings {
  theme_philosophy_embedding: number[] | null;
  action_process_embedding: number[] | null;
  interpersonal_roles_embedding: number[] | null;
  edu_value_embedding: number[] | null;
  learning_strategy_embedding: number[] | null;
  creative_play_embedding: number[] | null;
  scene_visuals_embedding: number[] | null;
}

/**
 * 为图片生成7个主题维度的AI描述（一次性生成）
 */
export async function generateThemeDescriptions(
  file: File, 
  bookTitle: string,
  originalDescription: string
): Promise<ThemeDescriptions> {
  console.log('🎭 开始一次性生成7个主题维度描述...');
  
  try {
    // 构建与后台一致的专业分析提示词
    const allThemesPrompt = `目标：请你扮演一位资深的文本分析和信息提取专家。你的任务是深入分析我提供的这段关于绘本插图的详细描述文字，并从中提取关键信息，为一个JSON对象中的7个核心字段填充内容。

输入：一段关于绘本《${bookTitle}》插图的详细描述文字。

字段填写指南：
- theme_philosophy (核心理念与人生主题)：分析画面传递的静态价值观、人生态度、世界观等。例如：对美的看法、生活的意义、幸福的定义。
- action_process (行动过程与成长)：分析画面中角色的动态行为。描述他们正在做什么、经历什么挑战、如何克服，以及这个过程带来的成长。例如：探索、坚持、犯错、努力。
- interpersonal_roles (人际角色与情感连接)：分析画面中人物之间的关系和情感。是亲子、师生还是朋友？他们之间的互动是关爱、支持、引导还是陪伴？
- edu_value (阅读带来的价值)：思考这本书能带给孩子的宏观教育意义。它如何塑造品格、拓宽视野、培养审美？
- learning_strategy (阅读中的学习方法)：分析画面中是否展现或暗示了具体的学习方法。例如：观察、提问、对比、输出、角色扮演等。
- creative_play (创意表现与想象力)：分析画面中的游戏、幻想、角色扮演等元素。它如何激发孩子的创造力和想象力？
- scene_visuals (场景氛围与画面元素)：描述画面的物理信息。包括场景（室内/外）、季节、天气、光线、色彩运用、艺术风格以及营造出的整体氛围（温馨、宁静、热闹、神秘等）。

输出格式要求：严格按照以下JSON格式输出，不要添加任何额外的解释或说明文字。

{
  "theme_philosophy": "根据上述指南分析得出的核心理念与人生主题",
  "action_process": "根据上述指南分析得出的行动过程与成长",
  "interpersonal_roles": "根据上述指南分析得出的人际角色与情感连接",
  "edu_value": "根据上述指南分析得出的阅读带来的价值",
  "learning_strategy": "根据上述指南分析得出的阅读中的学习方法",
  "creative_play": "根据上述指南分析得出的创意表现与想象力",
  "scene_visuals": "根据上述指南分析得出的场景氛围与画面元素"
}

待分析的描述文字：
${originalDescription}`;

    const themeDescriptions = await generateAllThemesAtOnce(allThemesPrompt, bookTitle, originalDescription);
    console.log('✅ 7个主题维度描述一次性生成完成');
    return themeDescriptions;
    
  } catch (error) {
    console.error('❌ 一次性生成主题描述失败，使用默认描述:', error);
    // 如果一次性生成失败，使用默认描述
    return generateDefaultThemeDescriptions(bookTitle, originalDescription);
  }
}

/**
 * 为7个主题描述生成对应的向量嵌入
 */
export async function generateThemeEmbeddings(
  themeDescriptions: ThemeDescriptions
): Promise<ThemeEmbeddings> {
  console.log('🧮 开始生成7个主题向量嵌入...');
  
  const embeddings: Partial<ThemeEmbeddings> = {};
  
  // 为每个主题描述生成向量
  for (const [key, description] of Object.entries(themeDescriptions)) {
    try {
      console.log(`🔢 生成向量: ${THEME_DIMENSIONS[key as keyof ThemeDescriptions].name}`);
      
      const vector = await imageDescriptionToVector(description);
      embeddings[`${key}_embedding` as keyof ThemeEmbeddings] = vector;
      
      console.log(`✅ 向量生成成功: ${vector.length}维`);
      
      // 添加短暂延迟
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(`❌ 生成向量失败 (${key}):`, error);
      embeddings[`${key}_embedding` as keyof ThemeEmbeddings] = null;
    }
  }
  
  console.log('✅ 7个主题向量嵌入生成完成');
  return embeddings as ThemeEmbeddings;
}

/**
 * 生成回退描述（当AI生成失败时使用）
 */
function generateFallbackDescription(
  themeKey: keyof ThemeDescriptions, 
  bookTitle: string, 
  originalDescription: string
): string {
  const fallbacks = {
    theme_philosophy: `这幅来自《${bookTitle}》的插图蕴含着深刻的人生智慧和成长启示。`,
    action_process: `插图展现了《${bookTitle}》中人物的行动过程和成长历程。`,
    interpersonal_roles: `画面描绘了《${bookTitle}》中温馨的人际关系和情感连接。`,
    edu_value: `这幅插图具有重要的教育价值，能够启发读者的学习和思考。`,
    learning_strategy: `插图展示了有效的阅读学习策略和思维方法。`,
    creative_play: `画面充满创意和想象力，激发读者的创造性思维。`,
    scene_visuals: `插图运用精美的视觉元素营造出独特的艺术氛围。`
  };
  
  return fallbacks[themeKey];
}

/**
 * 一次性生成所有7个主题描述
 */
async function generateAllThemesAtOnce(
  allThemesPrompt: string,
  bookTitle: string,
  originalDescription: string
): Promise<ThemeDescriptions> {
  try {
    // 初始化OpenAI客户端
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const baseURL = import.meta.env.VITE_OPENAI_BASE_URL;
    
    if (!apiKey) {
      throw new Error('VITE_OPENAI_API_KEY environment variable is required');
    }
    
    const config: any = {
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    };
    
    if (baseURL) {
      config.baseURL = baseURL;
    }
    
    const openai = new OpenAI(config);
    
    console.log('🤖 调用GPT-4生成7个主题维度描述...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-2024-11-20',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的文本分析专家，擅长从绘本插图描述中提取深层含义。请严格按照JSON格式返回结果。'
        },
        {
          role: 'user',
          content: allThemesPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    const responseText = response.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      throw new Error('AI返回空响应');
    }
    
    console.log('🔍 解析AI返回的JSON结果...');
    
    // 解析JSON响应
    const parsedResult = JSON.parse(responseText);
    
    // 验证和清理结果
    const themeDescriptions: ThemeDescriptions = {
      theme_philosophy: parsedResult.theme_philosophy || `这幅来自《${bookTitle}》的插图蕴含着深刻的人生智慧和成长启示。`,
      action_process: parsedResult.action_process || `插图展现了《${bookTitle}》中人物的行动过程和成长历程。`,
      interpersonal_roles: parsedResult.interpersonal_roles || `画面描绘了《${bookTitle}》中温馨的人际关系和情感连接。`,
      edu_value: parsedResult.edu_value || `这幅插图具有重要的教育价值，能够启发读者的学习和思考。`,
      learning_strategy: parsedResult.learning_strategy || `插图展示了有效的阅读学习策略和思维方法。`,
      creative_play: parsedResult.creative_play || `画面充满创意和想象力，激发读者的创造性思维。`,
      scene_visuals: parsedResult.scene_visuals || `插图运用精美的视觉元素营造出独特的艺术氛围。`
    };
    
    console.log('✅ 7个主题描述解析成功');
    return themeDescriptions;
    
  } catch (error) {
    console.error('一次性生成主题描述失败:', error);
    throw error;
  }
}

/**
 * 一站式生成主题数据（描述 + 向量）
 */
export async function generateCompleteThemeData(
  file: File,
  bookTitle: string,
  originalDescription: string
): Promise<{ descriptions: ThemeDescriptions; embeddings: ThemeEmbeddings }> {
  console.log('🎯 开始生成完整的主题数据（描述 + 向量）...');
  
  // 1. 生成7个主题描述
  const descriptions = await generateThemeDescriptions(file, bookTitle, originalDescription);
  
  // 2. 为描述生成向量嵌入
  const embeddings = await generateThemeEmbeddings(descriptions);
  
  console.log('🎉 完整主题数据生成完成！');
  
  return { descriptions, embeddings };
}