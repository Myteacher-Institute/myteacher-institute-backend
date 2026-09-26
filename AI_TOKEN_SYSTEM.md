# AI Token System Implementation

## Overview
A complete token-based system for AI usage with funding through Flutterwave and automatic token deduction based on OpenAI API costs.

## 📊 OpenAI Token Pricing Research

Based on current OpenAI API pricing (2025):

**GPT-5.6-luna** (used in your example):
- **Input**: $0.20 per 1M tokens
- **Output**: $1.20 per 1M tokens
- **Cached Input**: $0.02 per 1M tokens
- **Cache Write**: $0.25 per 1M tokens

**Your Example Cost:**
- 131 tokens total = ~$0.00015 OpenAI cost
- With 20% platform fee = ~$0.00018 total
- Converted to NGN (~₦1500/USD) = ~₦0.27
- Token deduction (~₦10/token) = 1 token

## 🏗️ Backend Implementation

### 1. User Model Update
**File**: `src/models/user.model.ts`
- Added `aiTokens` field (Number, default: 200)
- Every new user gets 200 free tokens to start chatting

### 2. Token Pricing Service
**File**: `src/services/ai-token.service.ts`

**Key Functions:**
- `calculateTokenCost()`: Calculates cost from OpenAI usage data
- `estimateTokenCost()`: Pre-request cost estimation
- `getTokenPackages()`: Returns available purchase packages
- `calculateBonusTokens()`: Calculates bonus tokens for purchases
- `hasSufficientTokens()`: Validates user balance

**Pricing Logic:**
```typescript
// 1. Calculate OpenAI cost
input_cost = (input_tokens * model.input_price) / 1M
output_cost = (output_tokens * model.output_price) / 1M
cache_cost = (cached_tokens * cached_price) / 1M

// 2. Add 20% platform fee
platform_fee = total_openai_cost * 0.20
total_cost_usd = total_openai_cost + platform_fee

// 3. Convert to NGN and tokens
total_cost_ngn = total_cost_usd * 1500
tokens_deducted = ceil(total_cost_ngn / 10)  // 1 token = ₦10
```

### 3. Database Models

**AITokenUsage Model** (`src/models/ai-token-usage.model.ts`):
- Tracks every AI request
- Stores token usage, costs, and status
- Includes caching and reasoning token details

**AITokenPurchase Model** (`src/models/ai-token-purchase.model.ts`):
- Tracks token purchases
- Links to Flutterwave transactions
- Includes bonus tokens

### 4. API Routes
**File**: `src/routes/ai-token.routes.ts`

**Endpoints:**
- `GET /api/ai-token/balance` - Get user's token balance
- `GET /api/ai-token/packages` - Get available purchase packages
- `POST /api/ai-token/purchase` - Create Flutterwave payment
- `GET /api/ai-token/verify` - Verify payment (callback)
- `POST /api/ai-token/usage` - Record token usage after AI response
- `GET /api/ai-token/history` - Get usage history

### 5. Controller
**File**: `src/controllers/ai-token.controller.ts`

**Key Functions:**
- `handleGetTokenBalance()`: Returns balance + recent usage
- `handleCreateTokenPurchase()`: Creates Flutterwave payment link
- `handleRecordTokenUsage()`: Deducts tokens after AI response
- `handleVerifyTokenPurchase()`: Verifies Flutterwave payment
- `handleGetTokenUsageHistory()`: Returns usage statistics

## 🎨 Frontend Implementation

### 1. Token Purchase Modal
**File**: `app/components/constants/Students/TokenPurchaseModal.tsx`

**Features:**
- Displays available token packages
- Shows current balance
- Integrates with Flutterwave payment
- Bonus token indicators
- Pricing information

### 2. AI Tutor Page Integration
**File**: `app/components/AiLearn.tsx`

**Added:**
- Token balance display in header
- "Buy Tokens" button
- Token purchase modal integration
- Real-time balance updates

### 3. Frontend Service
**File**: `services/ai-token.service.ts`

**Functions:**
- `getBalance()`: Fetch user's token balance
- `getPackages()`: Get purchase packages
- `createPurchase()`: Initiate payment
- `recordUsage()`: Record token usage
- `getUsageHistory()`: Get usage statistics

## 💰 Token Packages

| Tokens | Price (NGN) | Bonus | Total | Effective Rate |
|--------|------------|-------|-------|----------------|
| 1,000  | ₦10,000    | 0     | 1,000 | ₦10.00/token |
| 5,000  | ₦45,000    | 500   | 5,500 | ₦8.18/token |
| 10,000 | ₦80,000    | 2,000 | 12,000| ₦6.67/token |
| 25,000 | ₦180,000   | 5,000 | 30,000| ₦6.00/token |
| 50,000 | ₦320,000   | 10,000| 60,000| ₦5.33/token |

## 🔗 Integration with AI Requests

### How to Integrate Token Deduction

When implementing the AI tutor chat on `/tutor`, follow this flow:

```typescript
// 1. Before making AI request
const checkTokens = async () => {
  const balance = await aiTokenService.getBalance();
  const estimatedCost = estimateTokenCost('gpt-5.6-luna', inputTokens, estimatedOutputTokens);
  
  if (balance.balance < estimatedCost.tokensDeducted) {
    // Show "Insufficient tokens" modal
    openTokenPurchaseModal();
    return false;
  }
  return true;
};

// 2. Make AI request to OpenAI
const aiResponse = await openai.responses.create({
  model: 'gpt-5.6-luna',
  messages: conversation,
  // ... other parameters
});

// 3. After receiving response, record usage
const usage = aiResponse.usage; // { input_tokens, output_tokens, total_tokens }

await aiTokenService.recordUsage({
  model: 'gpt-5.6-luna',
  inputTokens: usage.input_tokens,
  outputTokens: usage.output_tokens,
  cachedTokens: usage.input_tokens_details?.cached_tokens || 0,
  cacheWriteTokens: usage.input_tokens_details?.cache_write_tokens || 0,
  reasoningTokens: usage.output_tokens_details?.reasoning_tokens || 0,
  requestType: 'chat'
});

// 4. Update local balance display
setTokenBalance(prev => prev - tokensDeducted);
```

### OpenAI Response Structure (from your example)

```typescript
{
  "usage": {
    "input_tokens": 12,
    "output_tokens": 119,
    "total_tokens": 131,
    "input_tokens_details": {
      "cache_write_tokens": 0,
      "cached_tokens": 0
    },
    "output_tokens_details": {
      "reasoning_tokens": 98
    }
  }
}
```

## 🚀 Next Steps for Tutor Page Integration

### On `/tutor` page (chat interface):

1. **Add token balance check before sending message**
   - Check if user has sufficient tokens
   - If not, show purchase modal
   - If yes, proceed with AI request

2. **Make OpenAI API call**
   - Use OpenAI SDK or fetch
   - Get response with usage data

3. **Record token usage after response**
   - Call `/api/ai-token/usage` endpoint
   - Pass token usage from OpenAI response
   - Update local balance display

4. **Handle insufficient tokens**
   - Show friendly error message
   - Offer to purchase more tokens
   - Prevent API calls when balance is low

5. **Add token cost indicator**
   - Show estimated cost before sending
   - Display actual cost after response
   - Help users understand token consumption

## 🔐 Security Considerations

- Rate limiting on purchase endpoints (10 per 15 minutes)
- Rate limiting on usage recording (60 per minute)
- Server-side token validation
- Secure Flutterwave integration
- Protected routes with authentication middleware

## 📝 Environment Variables Needed

Add to `.env`:
```
FLUTTERWAVE_PUBLIC_KEY=your_public_key
FLUTTERWAVE_SECRET_KEY=your_secret_key
FRONTEND_URL=http://localhost:3000
```

## 🧪 Testing Checklist

- [ ] User can view token balance
- [ ] User can purchase tokens via Flutterwave
- [ ] Payment verification works correctly
- [ ] Tokens are credited after successful payment
- [ ] Token deduction works after AI response
- [ ] Insufficient tokens blocks AI requests
- [ ] Bonus tokens are calculated correctly
- [ ] Usage history is recorded accurately
- [ ] Platform fee (20%) is applied correctly

## 📊 Monitoring

Track:
- Total tokens purchased
- Total tokens used
- Revenue from token sales
- Average tokens per request
- Cost per user
- Failed payment attempts

## 🎯 User Experience Flow

1. User visits `/tutor` page
2. Sees current token balance in header
3. Types message to AI
4. System checks if tokens available
5. If yes → sends to OpenAI → receives response → deducts tokens
6. If no → shows purchase modal → user buys tokens → balance updated → can now chat
7. User can view usage history to track spending
8. User can purchase more tokens anytime

## 💡 Optimization Tips

- Implement prompt caching to reduce costs
- Use appropriate model for task complexity
- Show estimated costs before expensive operations
- Provide token usage analytics to users
- Offer bulk purchase discounts
- Consider implementing token expiration for inactive accounts