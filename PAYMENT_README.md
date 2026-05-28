# Flutterwave Payment Integration Guide

This guide explains how to integrate Flutterwave payment gateway for course purchases in the MyTeacher Institute backend.

## Overview

The payment system allows users to purchase courses using Flutterwave payment gateway. The system creates transaction records, processes payments, and automatically adds purchased courses to the user's profile upon successful payment.

## Architecture

```
Payment Flow:
1. User requests payment link for a course
2. System creates pending transaction record
3. System generates Flutterwave payment link
4. User completes payment on Flutterwave
5. System verifies payment transaction
6. On success: System adds course to user's coursesBought array
7. Transaction status updated to 'successful'
```

## Setup

### 1. Environment Variables

Add the following variables to your `.env` file:

```env
# Flutterwave Payment Gateway
FLUTTERWAVE_CLIENT_ID=your_client_id
FLUTTERWAVE_CLIENT_SECRET=your_secret_key
FLUTTERWAVE_ENCRYPTION_KEY=your_encryption_key

# Frontend URL (for payment redirects)
FRONTEND_URL=http://localhost:3000
```

### 2. Get Flutterwave Credentials

1. Sign up at [Flutterwave](https://flutterwave.com/)
2. Go to Settings > API Keys
3. Copy your Public Key (CLIENT_ID)
4. Copy your Secret Key (CLIENT_SECRET)
5. Copy your Encryption Key

## API Endpoints

### Base URL
```
http://localhost:YOUR_PORT/api/payment
```

### 1. Create Payment Link

**Endpoint:** `POST /api/payment/create`  
**Authentication:** Required (Bearer Token)  
**Description:** Creates a Flutterwave payment link for course purchase

**Request Body:**
```json
{
  "courseId": "course_object_id",
  "amount": 99.99,
  "currency": "NGN",
  "paymentMethod": "flutterwave",
  "redirectUrl": "http://localhost:3000/payment/callback"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Payment link created successfully",
  "paymentLink": "https://checkout.flutterwave.com/...",
  "transactionReference": "MYT-user123-course456-1234567890-abc123"
}
```

### 2. Verify Payment

**Endpoint:** `GET /api/payment/verify`  
**Authentication:** Required (Bearer Token)  
**Description:** Verifies payment transaction and adds course to user's purchases

**Query Parameters:**
- `transaction_id` (required): Flutterwave transaction ID
- `tx_ref` (required): Transaction reference from payment creation

**Example:**
```
GET /api/payment/verify?transaction_id=123456&tx_ref=MYT-user123-course456-1234567890-abc123
```

**Response:**
```json
{
  "status": "success",
  "message": "Payment verified successfully",
  "transaction": {
    "_id": "transaction_id",
    "userId": "user_id",
    "courseId": "course_id",
    "amount": 99.99,
    "currency": "NGN",
    "status": "successful",
    "transactionReference": "MYT-user123-course456-1234567890-abc123",
    "flutterwaveTransactionId": "123456",
    "paymentMethod": "flutterwave",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Get User Transaction History

**Endpoint:** `GET /api/payment/history`  
**Authentication:** Required (Bearer Token)  
**Description:** Retrieves all transactions for the authenticated user

**Response:**
```json
{
  "status": "success",
  "message": "Transactions retrieved successfully",
  "transactions": [
    {
      "_id": "transaction_id",
      "userId": "user_id",
      "courseId": {
        "courseName": "JavaScript Basics",
        "description": "Learn JavaScript",
        "price": 99.99
      },
      "amount": 99.99,
      "status": "successful",
      "transactionReference": "MYT-...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 4. Get Transaction by Reference

**Endpoint:** `GET /api/payment/:tx_ref`  
**Authentication:** Required (Bearer Token)  
**Description:** Retrieves a specific transaction by reference

**Response:**
```json
{
  "status": "success",
  "message": "Transaction retrieved successfully",
  "transaction": {
    "_id": "transaction_id",
    "userId": "user_id",
    "courseId": {
      "courseName": "JavaScript Basics",
      "description": "Learn JavaScript",
      "price": 99.99
    },
    "amount": 99.99,
    "status": "successful",
    "transactionReference": "MYT-..."
  }
}
```

## Transaction Model

```typescript
{
  userId: ObjectId,           // Reference to User
  courseId: ObjectId,         // Reference to Course
  amount: Number,             // Payment amount
  currency: String,           // Currency code (default: 'NGN')
  status: String,             // 'pending' | 'successful' | 'failed' | 'cancelled'
  transactionReference: String, // Unique transaction reference
  flutterwaveTransactionId: String, // Flutterwave transaction ID
  paymentMethod: String,      // Payment method (default: 'flutterwave')
  createdAt: Date,
  updatedAt: Date
}
```

## Integration Example

### Frontend Implementation

```javascript
// 1. Create payment link
const createPayment = async (courseId, amount) => {
  const response = await fetch('http://localhost:5000/api/payment/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      courseId,
      amount,
      currency: 'NGN',
      redirectUrl: `${window.location.origin}/payment/callback`
    })
  });
  
  const result = await response.json();
  
  // Redirect to Flutterwave payment page
  if (result.status === 'success') {
    window.location.href = result.paymentLink;
  }
};

// 2. Handle payment callback (on your redirect URL)
const handlePaymentCallback = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const transaction_id = urlParams.get('transaction_id');
  const tx_ref = urlParams.get('tx_ref');
  
  if (transaction_id && tx_ref) {
    const response = await fetch(`http://localhost:5000/api/payment/verify?transaction_id=${transaction_id}&tx_ref=${tx_ref}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      alert('Payment successful! Course added to your library.');
      // Redirect to course page
    } else {
      alert('Payment failed. Please try again.');
    }
  }
};
```

## Postman Collection

### Setup
1. Add your JWT token to environment variables
2. Set BASE_URL to `http://localhost:5000`

### Requests

#### 1. Create Payment
```
POST {{BASE_URL}}/api/payment/create
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
  Content-Type: application/json
Body (raw JSON):
{
  "courseId": "YOUR_COURSE_ID",
  "amount": 99.99,
  "currency": "NGN",
  "redirectUrl": "http://localhost:3000/payment/callback"
}
```

#### 2. Verify Payment
```
GET {{BASE_URL}}/api/payment/verify?transaction_id=FLW_TX_ID&tx_ref=YOUR_TX_REF
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
```

#### 3. Get Transaction History
```
GET {{BASE_URL}}/api/payment/history
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
```

## Security Notes

1. **Never commit credentials**: Ensure `.env` file is in `.gitignore`
2. **Use HTTPS**: Always use HTTPS in production
3. **Validate amounts**: Server validates course prices before payment
4. **Duplicate checks**: System prevents duplicate course purchases
5. **Transaction verification**: Always verify payments before granting access

## Error Handling

### Common Errors

**401 Unauthorized**
```json
{
  "status": "failed",
  "message": "Unauthorized: User ID not found"
}
```
**Solution:** Ensure you're sending a valid JWT token

**400 Bad Request - Course not found**
```json
{
  "status": "failed",
  "message": "Course not found"
}
```
**Solution:** Verify the course ID exists in the database

**400 Bad Request - Already purchased**
```json
{
  "status": "failed",
  "message": "You have already purchased this course"
}
```
**Solution:** User already owns this course

**500 Internal Server Error**
```json
{
  "status": "failed",
  "message": "Internal server error"
}
```
**Solution:** Check server logs for details

## Testing

### Test Mode
Flutterwave provides test mode for development. Use test credentials from your Flutterwave dashboard.

### Test Cards
Flutterwave provides test card numbers for testing:
- Success: `4187427415564246`
- Fail: `4187427415564246` (with specific amount)

## User Model Updates

The User model already includes the `coursesBought` field:

```typescript
coursesBought: {
  type: [mongoose.Schema.Types.ObjectId],
  ref: 'course'
}
```

Upon successful payment, the course ID is automatically added to this array.

## Transaction Status Flow

1. **pending**: Initial state when payment link is created
2. **successful**: Payment verified and course added to user
3. **failed**: Payment failed or verification failed
4. **cancelled**: User cancelled the payment
