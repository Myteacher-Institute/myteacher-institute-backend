import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/user.model";
import AITokenPurchase from "../models/ai-token-purchase.model";
import AITokenUsage from "../models/ai-token-usage.model";
import { createPaymentLink } from "../services/flutterwave.services";
import { 
  calculateTokenCost, 
  getTokenPackages, 
  calculateBonusTokens,
  MINIMUM_TOKENS 
} from "../services/ai-token.service";

interface CreateTokenPurchaseReqBody {
  tokens: number;
  amount: number;
  email?: string;
  name?: string;
  redirect_url?: string;
}

interface RecordTokenUsageReqBody {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  requestType?: 'chat' | 'code_analysis' | 'file_analysis' | 'voice' | 'other';
}

const handleGetTokenBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        status: "failed",
        message: "Unauthorized: User ID not found"
      });
    }

    const user = await User.findById(userId).select('aiTokens').lean();
    
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found"
      });
    }

    const totalTokens = user.aiTokens || 0;

    // Get recent usage
    const recentUsage = await AITokenUsage.find({ userId, status: 'success' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      status: "success",
      balance: totalTokens,
      recentUsage
    });

  } catch (error) {
    console.error('Get token balance error --->', (error as Error)?.message ?? error);
    res.status(500).json({
      status: "failed",
      message: "Internal server error"
    });
  }
};

const handleGetTokenPackages = async (req: Request, res: Response) => {
  try {
    const packages = getTokenPackages();

    return res.status(200).json({
      status: "success",
      packages
    });

  } catch (error) {
    console.error('Get token packages error --->', (error as Error)?.message ?? error);
    res.status(500).json({
      status: "failed",
      message: "Internal server error"
    });
  }
};

const handleCreateTokenPurchase = async (req: Request<{}, {}, CreateTokenPurchaseReqBody>, res: Response) => {
  try {
    const userId = req.userId;
    const { tokens, amount, redirect_url } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: "failed",
        message: "Unauthorized: User ID not found"
      });
    }

    if (!tokens || !amount || tokens <= 0 || amount <= 0) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid token purchase amount"
      });
    }

    // Get user data for Flutterwave
    const user = await User.findById(userId).select('email name').lean();
    
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found"
      });
    }

    // Calculate bonus tokens
    const bonusTokens = calculateBonusTokens(tokens, amount);
    const totalTokens = tokens + bonusTokens;

    // Generate transaction reference
    const transactionReference = `AI-TOKEN-${userId}-${Date.now()}`;

    // Use provided redirect_url or default to tutor callback
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Check if redirect_url is already a full URL or a relative path
    const callbackUrl = redirect_url 
      ? (redirect_url.startsWith('http') ? redirect_url : `${baseUrl}${redirect_url}`)
      : `${baseUrl}/tutor/tokens/callback`;

    console.log('Creating payment with redirect_url:', callbackUrl);

    // Create Flutterwave payment link
    const paymentResponse = await createPaymentLink({
      amount: amount,
      currency: 'NGN',
      tx_ref: transactionReference,
      redirect_url: callbackUrl,
      customer: {
        email: user.email,
        name: user.name
      },
      customizations: {
        title: 'AI Token Purchase',
        description: `Purchase ${totalTokens.toLocaleString()} AI tokens`,
        logo: 'https://cdn.iconscout.com/icon/free/png-256/free-education-217-444850.png'
      },
    });

    if (paymentResponse.status !== 'success') {
      return res.status(500).json({
        status: "failed",
        message: "Failed to create payment link"
      });
    }

    // Create pending purchase record
    await AITokenPurchase.create({
      userId: new mongoose.Types.ObjectId(userId),
      tokens,
      bonusTokens,
      totalTokens,
      amountNgn: amount,
      transactionReference,
      status: 'pending'
    });

    return res.status(200).json({
      status: "success",
      message: "Payment link created successfully",
      paymentLink: paymentResponse.data?.link,
      transactionReference,
      totalTokens,
      bonusTokens
    });

  } catch (error) {
    console.error('Create token purchase error --->', (error as Error)?.message ?? error);
    res.status(500).json({
      status: "failed",
      message: "Internal server error"
    });
  }
};

const handleRecordTokenUsage = async (req: Request<{}, {}, RecordTokenUsageReqBody>, res: Response) => {
  try {
    const userId = req.userId;
    const {
      model,
      inputTokens,
      outputTokens,
      cachedTokens = 0,
      cacheWriteTokens = 0,
      reasoningTokens = 0,
      requestType = 'chat'
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: "failed",
        message: "Unauthorized: User ID not found"
      });
    }

    const totalTokens = inputTokens + outputTokens;

    // Calculate cost
    const cost = calculateTokenCost(model, {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      input_tokens_details: {
        cache_write_tokens: cacheWriteTokens,
        cached_tokens: cachedTokens
      },
      output_tokens_details: {
        reasoning_tokens: reasoningTokens
      },
      total_tokens: totalTokens
    });

    // Check if user has sufficient tokens
    const user = await User.findById(userId).select('aiTokens').lean();
    
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found"
      });
    }

    if ((user.aiTokens || 0) < cost.tokens_deducted) {
      return res.status(402).json({
        status: "failed",
        message: "Insufficient tokens",
        requiredTokens: cost.tokens_deducted,
        availableTokens: user.aiTokens || 0
      });
    }

    // Deduct tokens
    await User.findByIdAndUpdate(userId, {
      $inc: { aiTokens: -cost.tokens_deducted }
    });

    // Record usage
    await AITokenUsage.create({
      userId: new mongoose.Types.ObjectId(userId),
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      cachedTokens,
      cacheWriteTokens,
      reasoningTokens,
      openaiCostUsd: cost.openai_cost_usd,
      platformFeeUsd: cost.platform_fee_usd,
      totalCostUsd: cost.total_cost_usd,
      totalCostNgn: cost.total_cost_ngn,
      tokensDeducted: cost.tokens_deducted,
      requestType,
      status: 'success'
    });

    return res.status(200).json({
      status: "success",
      message: "Token usage recorded successfully",
      remainingTokens: (user.aiTokens || 0) - cost.tokens_deducted,
      tokensDeducted: cost.tokens_deducted,
      cost
    });

  } catch (error) {
    console.error('Record token usage error --->', (error as Error)?.message ?? error);
    res.status(500).json({
      status: "failed",
      message: "Internal server error"
    });
  }
};

const handleGetTokenUsageHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        status: "failed",
        message: "Unauthorized: User ID not found"
      });
    }

    const usageHistory = await AITokenUsage.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Calculate totals
    const totalTokensUsed = usageHistory.reduce((sum, record) => sum + record.tokensDeducted, 0);
    const totalCostNgn = usageHistory.reduce((sum, record) => sum + record.totalCostNgn, 0);

    return res.status(200).json({
      status: "success",
      usageHistory,
      totals: {
        totalTokensUsed,
        totalCostNgn,
        totalRequests: usageHistory.length
      }
    });

  } catch (error) {
    console.error('Get token usage history error --->', (error as Error)?.message ?? error);
    res.status(500).json({
      status: "failed",
      message: "Internal server error"
    });
  }
};

const handleVerifyTokenPurchase = async (req: Request, res: Response) => {
  try {
    const { tx_ref, transaction_id } = req.query;

    console.log('Verification request:', { tx_ref, transaction_id });

    if (!tx_ref) {
      return res.status(400).json({
        status: "failed",
        message: "Transaction reference is required"
      });
    }

    // Find the purchase record
    const purchase = await AITokenPurchase.findOne({ transactionReference: tx_ref as string });

    if (!purchase) {
      return res.status(404).json({
        status: "failed",
        message: "Purchase record not found"
      });
    }

    if (purchase.status === 'successful') {
      return res.status(200).json({
        status: "success",
        message: "Purchase already verified",
        purchase
      });
    }

    // Verify with Flutterwave
    let verification;
    const Flutterwave = require('flutterwave-node-v3');
    const flw = new Flutterwave(process.env.FLUTTERWAVE_CLIENT_ID, process.env.FLUTTERWAVE_CLIENT_SECRET);
    
    if (transaction_id) {
      // Verify by transaction ID if available
      verification = await flw.Transaction.verify({ id: transaction_id as string });
    } else {
      // Fallback: verify by transaction reference
      verification = await (flw.Transaction as any).verify_by_tx({ tx_ref: tx_ref as string });
    }

    console.log('Flutterwave verification result:', verification);

    if ((verification.status === 'success' || verification.status === 'successful') && verification.data?.status === 'successful') {
      // Update purchase status
      await AITokenPurchase.updateOne(
        { transactionReference: tx_ref as string },
        {
          status: 'successful',
          flutterwaveTransactionId: (transaction_id || verification.data?.id) as string,
          paidAt: new Date()
        }
      );

      // Add tokens to user balance
      await User.findByIdAndUpdate(purchase.userId, {
        $inc: { aiTokens: purchase.totalTokens }
      });

      // Get updated purchase
      const updatedPurchase = await AITokenPurchase.findOne({ transactionReference: tx_ref as string });

      return res.status(200).json({
        status: "success",
        message: "Token purchase verified successfully",
        purchase: updatedPurchase
      });
    } else {
      await AITokenPurchase.updateOne(
        { transactionReference: tx_ref as string },
        { status: 'failed' }
      );

      return res.status(400).json({
        status: "failed",
        message: "Payment verification failed"
      });
    }

  } catch (error) {
    console.error('Verify token purchase error --->', (error as Error)?.message ?? error);
    res.status(500).json({
      status: "failed",
      message: "Internal server error"
    });
  }
};

export {
  handleGetTokenBalance,
  handleGetTokenPackages,
  handleCreateTokenPurchase,
  handleRecordTokenUsage,
  handleGetTokenUsageHistory,
  handleVerifyTokenPurchase
};