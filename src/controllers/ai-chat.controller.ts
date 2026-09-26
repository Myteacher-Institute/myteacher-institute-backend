import { Request, Response } from "express";
import mongoose from "mongoose";
import axios from 'axios';
import User from "../models/user.model";
import AITokenUsage from "../models/ai-token-usage.model";
import { calculateTokenCost } from "../services/ai-token.service";

interface ChatRequest {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

const handleAIChat = async (req: Request<{}, {}, ChatRequest>, res: Response) => {
  try {
    const userId = req.userId;
    const { message, conversationHistory = [] } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: "failed",
        message: "Unauthorized: User ID not found"
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: "failed",
        message: "Message is required"
      });
    }

    // Get user's token balance
    const user = await User.findById(userId).select('aiTokens').lean();
    
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found"
      });
    }

    const userTokens = user.aiTokens || 0;

    // Check if user has minimum tokens for a simple chat (10 tokens)
    if (userTokens < 10) {
      return res.status(402).json({
        status: "failed",
        message: "Insufficient tokens. Please purchase more tokens to continue.",
        requiredTokens: 10,
        availableTokens: userTokens
      });
    }

    // Prepare messages for OpenAI
    const messages = [
      {
        role: "system",
        content: "You are a helpful AI learning assistant for MyTeacher Institute. Help users find courses, learn skills, and achieve their educational goals. Be concise, friendly, and provide practical advice."
      },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      {
        role: "user",
        content: message
      }
    ];

    // Call OpenAI API
    console.log('Calling OpenAI API with message:', message);
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const aiResponse = openaiResponse.data.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";
    const usage = openaiResponse.data.usage;

    // Calculate token cost
    const cost = calculateTokenCost('gpt-3.5-turbo', {
      input_tokens: usage?.prompt_tokens || 0,
      output_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
      input_tokens_details: {
        cached_tokens: usage?.prompt_tokens_details?.cached_tokens || 0,
        cache_write_tokens: usage?.prompt_tokens_details?.cache_write_tokens || 0
      },
      output_tokens_details: {
        reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens || 0
      }
    });

    // Check if user has sufficient tokens for this request
    if (userTokens < cost.tokens_deducted) {
      return res.status(402).json({
        status: "failed",
        message: "Insufficient tokens for this request. The response would require more tokens than you have available.",
        requiredTokens: cost.tokens_deducted,
        availableTokens: userTokens
      });
    }

    // Deduct tokens
    await User.findByIdAndUpdate(userId, {
      $inc: { aiTokens: -cost.tokens_deducted }
    });

    // Record usage
    await AITokenUsage.create({
      userId: new mongoose.Types.ObjectId(userId),
      model: 'gpt-3.5-turbo',
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      cachedTokens: usage?.prompt_tokens_details?.cached_tokens || 0,
      cacheWriteTokens: usage?.prompt_tokens_details?.cache_write_tokens || 0,
      reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens || 0,
      openaiCostUsd: cost.openai_cost_usd,
      platformFeeUsd: cost.platform_fee_usd,
      totalCostUsd: cost.total_cost_usd,
      totalCostNgn: cost.total_cost_ngn,
      tokensDeducted: cost.tokens_deducted,
      requestType: 'chat',
      status: 'success'
    });

    return res.status(200).json({
      status: "success",
      response: aiResponse,
      tokensUsed: cost.tokens_deducted,
      remainingTokens: userTokens - cost.tokens_deducted,
      cost
    });

  } catch (error) {
    console.error('AI chat error --->', (error as Error)?.message ?? error);
    
    // Handle OpenAI API errors
    if (axios.isAxiosError(error)) {
      console.error('OpenAI API error details:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      if (error.response?.status === 401) {
        return res.status(500).json({
          status: "failed",
          message: "OpenAI API authentication failed. Please check the API key configuration."
        });
      }
      if (error.response?.status === 429) {
        return res.status(429).json({
          status: "failed",
          message: "OpenAI API rate limit exceeded. Please try again in a few moments."
        });
      }
      if (error.response?.status === 400) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid request to OpenAI API"
        });
      }
    }
    
    res.status(500).json({
      status: "failed",
      message: "Internal server error"
    });
  }
};

export { handleAIChat };