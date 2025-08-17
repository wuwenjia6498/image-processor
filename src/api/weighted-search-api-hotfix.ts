// 临时修复：禁用精选集搜索，直接使用优化版搜索
// 在 src/api/weighted-search-api.ts 中找到 usePremiumFirst: boolean = true
// 改为 usePremiumFirst: boolean = false

// 或者在调用时显式禁用：
// const results = await performWeightedSearch(queryVector, searchWeights, 10, textContent, false);

export const HOTFIX_DISABLE_PREMIUM = true;

// 如果需要立即修复，请将 weighted-search-api.ts 第124行：
// usePremiumFirst: boolean = true
// 改为：
// usePremiumFirst: boolean = false 