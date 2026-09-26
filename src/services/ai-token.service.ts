// AI Token Pricing Service
// Calculates token costs based on OpenAI API usage with platform fee

// OpenAI Model Pricing (per 1M tokens in USD)
const MODEL_PRICING = {
  'gpt-3.5-turbo': {
    input: 0.50,
    output: 1.50,
    cached_input: 0.05,
    cache_write: 0.25
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
    cached_input: 0.01,
    cache_write: 0.15
  },
  'gpt-5.6-luna': {
    input: 0.20,
    output: 1.20,
    cached_input: 0.02,
    cache_write: 0.25
  },
  'gpt-5.6-sol': {
    input: 4.00,
    output: 20.00,
    cached_input: 0.40,
    cache_write: 5.00
  },
  'gpt-5.6-terra': {
    input: 2.00,
    output: 12.00,
    cached_input: 0.20,
    cache_write: 2.50
  },
  'gpt-5.4-mini': {
    input: 0.75,
    output: 4.50,
    cached_input: 0.075,
    cache_write: 0.625
  },
  'gpt-5.4': {
    input: 2.50,
    output: 15.00,
    cached_input: 0.25,
    cache_write: 2.50
  },
  'gpt-5.5': {
    input: 5.00,
    output: 30.00,
    cached_input: 0.50,
    cache_write: 6.25
  }
};

// Platform configuration
const PLATFORM_CONFIG = {
  fee_percentage: 0.20, // 20% platform fee
  usd_to_ngn_rate: 1500, // Approximate exchange rate
  token_to_ngn_rate: 10, // 1 token = ₦10
};

// Token purchase packages
const TOKEN_PACKAGES = [
  { tokens: 1000, price: 10000, bonus: 0 }, // ₦10,000 for 1,000 tokens
  { tokens: 5000, price: 45000, bonus: 500 }, // ₦45,000 for 5,500 tokens (500 bonus)
  { tokens: 10000, price: 80000, bonus: 2000 }, // ₦80,000 for 12,000 tokens (2,000 bonus)
  { tokens: 25000, price: 180000, bonus: 5000 }, // ₦180,000 for 30,000 tokens (5,000 bonus)
  { tokens: 50000, price: 320000, bonus: 10000 }, // ₦320,000 for 60,000 tokens (10,000 bonus)
];

interface OpenAIUsage {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: {
    cache_write_tokens?: number;
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
  total_tokens: number;
}

interface TokenCost {
  openai_cost_usd: number;
  platform_fee_usd: number;
  total_cost_usd: number;
  total_cost_ngn: number;
  tokens_deducted: number;
  breakdown: {
    input_cost: number;
    output_cost: number;
    cache_cost: number;
  };
}

/**
 * Calculate token cost based on OpenAI usage data
 */
export const calculateTokenCost = (
  model: string,
  usage: OpenAIUsage
): TokenCost => {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING['gpt-5.6-luna'];
  
  // Calculate OpenAI costs
  const input_cost = (usage.input_tokens * pricing.input) / 1000000;
  const output_cost = (usage.output_tokens * pricing.output) / 1000000;
  
  // Cache costs (if available)
  let cache_cost = 0;
  if (usage.input_tokens_details) {
    const cache_write_cost = (usage.input_tokens_details.cache_write_tokens || 0) * pricing.cache_write / 1000000;
    const cached_cost = (usage.input_tokens_details.cached_tokens || 0) * pricing.cached_input / 1000000;
    cache_cost = cache_write_cost + cached_cost;
  }
  
  const openai_cost_usd = input_cost + output_cost + cache_cost;
  
  // Add platform fee (20%)
  const platform_fee_usd = openai_cost_usd * PLATFORM_CONFIG.fee_percentage;
  const total_cost_usd = openai_cost_usd + platform_fee_usd;
  
  // Convert to NGN
  const total_cost_ngn = total_cost_usd * PLATFORM_CONFIG.usd_to_ngn_rate;
  
  // Convert to tokens (1 token = ₦10)
  const tokens_deducted = Math.ceil(total_cost_ngn / PLATFORM_CONFIG.token_to_ngn_rate);
  
  return {
    openai_cost_usd,
    platform_fee_usd,
    total_cost_usd,
    total_cost_ngn,
    tokens_deducted,
    breakdown: {
      input_cost,
      output_cost,
      cache_cost
    }
  };
};

/**
 * Estimate token cost before making API call
 */
export const estimateTokenCost = (
  model: string,
  estimated_input_tokens: number,
  estimated_output_tokens: number
): TokenCost => {
  const usage: OpenAIUsage = {
    input_tokens: estimated_input_tokens,
    output_tokens: estimated_output_tokens,
    total_tokens: estimated_input_tokens + estimated_output_tokens
  };
  
  return calculateTokenCost(model, usage);
};

/**
 * Get token purchase packages
 */
export const getTokenPackages = () => {
  return TOKEN_PACKAGES.map(pkg => ({
    ...pkg,
    total_tokens: pkg.tokens + pkg.bonus,
    effective_rate: pkg.price / (pkg.tokens + pkg.bonus)
  }));
};

/**
 * Calculate bonus tokens for a purchase amount
 */
export const calculateBonusTokens = (base_tokens: number, amount: number): number => {
  // Bonus tiers
  if (amount >= 320000) return 10000; // ₦320,000+
  if (amount >= 180000) return 5000;  // ₦180,000+
  if (amount >= 80000) return 2000;   // ₦80,000+
  if (amount >= 45000) return 500;    // ₦45,000+
  return 0;
};

/**
 * Format token amount for display
 */
export const formatTokenAmount = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};

/**
 * Validate if user has sufficient tokens
 */
export const hasSufficientTokens = (
  userTokens: number,
  requiredTokens: number
): boolean => {
  return userTokens >= requiredTokens;
};

/**
 * Get minimum tokens for different operations
 */
export const MINIMUM_TOKENS = {
  simple_chat: 10,
  complex_chat: 50,
  code_analysis: 100,
  file_analysis: 200,
  voice_interaction: 150
};

/**
 * Default free tokens for new users
 */
export const DEFAULT_FREE_TOKENS = 200;