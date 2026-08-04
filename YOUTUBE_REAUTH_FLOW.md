# YouTube Re-Authentication Flow

## Problem
When YouTube session expires, the system was returning an error message requiring manual re-authentication but not providing the authentication URL automatically.

## Solution
Modified the YouTube upload controller to automatically generate and return the authentication URL when re-authentication is required.

## Changes Made

### 1. Updated YouTube Upload Controller (`src/controllers/youtube-upload.controller.ts`)

#### Modified Error Handling (Lines 140-161)
When no refresh token is stored, the system now:
- Generates a new OAuth2 authentication URL
- Returns the auth URL in the response
- Sets status to `reauth_required` with 401 status code

```typescript
if (!instructor.youtubeTokens.refreshToken) {
    // Generate auth URL for automatic re-authentication
    const oAuth2Client = createOAuth2Client(google);
    const state = signState({ instructorId });
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        state,
    });
    
    cleanup();
    return res.status(401).json({
        status: "reauth_required",
        message: "YouTube re-authentication required. Your session has expired. Please connect YouTube again.",
        authUrl,
        requiresReauth: true
    });
}
```

#### Enhanced Token Refresh Error Handling (Lines 172-194)
When token refresh fails (e.g., invalid_grant), the system now:
- Catches the refresh error
- Generates a new authentication URL
- Returns the auth URL for automatic re-authentication

```typescript
if (needsRefresh) {
    try {
        await refreshAccessToken(oAuth2Client, instructor);
    } catch (refreshError) {
        console.error('Token refresh failed, triggering re-authentication:', refreshError);
        
        // Generate auth URL for automatic re-authentication
        const state = signState({ instructorId });
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: SCOPES,
            state,
        });
        
        cleanup();
        return res.status(401).json({
            status: "reauth_required",
            message: "YouTube re-authentication required. Your session has expired. Please connect YouTube again.",
            authUrl,
            requiresReauth: true
        });
    }
}
```

#### Enhanced General Error Handling (Lines 200-237)
Added catch for authentication-related errors during upload:
- Detects auth-related error messages
- Generates authentication URL automatically
- Returns `reauth_required` status with auth URL

### 2. Updated YouTube Types (`src/types/youtube.type.ts`)

Added new status type and optional fields for re-authentication:

```typescript
export interface YouTubeUploadResT {
    status: "success" | "failed" | "reauth_required";  // Added "reauth_required"
    message: string;
    videoId?: string | null;
    videoUrl?: string;
    authUrl?: string;        // Added
    requiresReauth?: boolean; // Added
}
```

### 3. Enhanced Refresh Token Error Message (Lines 50-54)
Updated error message to indicate re-authentication is required:

```typescript
catch (error) {
    console.error('Token refresh error --->', error);
    // If refresh fails (e.g., invalid_grant), the refresh token might be revoked or invalid
    // This should trigger re-authentication in the caller
    throw new Error('Failed to refresh access token - re-authentication required');
}
```

## Re-Authentication Flow

### When Re-Authentication is Triggered

1. **No Refresh Token**: When instructor doesn't have a refresh token stored
2. **Token Refresh Fails**: When the access token refresh fails (e.g., invalid_grant)
3. **Auth Errors**: When YouTube API returns authentication/authorization errors during upload

### Response Format

When re-authentication is required, the API returns:

```json
{
  "status": "reauth_required",
  "message": "YouTube re-authentication required. Your session has expired. Please connect YouTube again.",
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "requiresReauth": true
}
```

### Frontend Integration

The frontend should:

1. Check for `status === "reauth_required"` in the upload response
2. Check for `requiresReauth === true`
3. Use the provided `authUrl` to redirect the user to YouTube authentication
4. Handle the OAuth callback to complete re-authentication
5. Retry the upload after successful re-authentication

## Benefits

- **Automatic Re-authentication**: No need for users to manually navigate to auth endpoint
- **Better UX**: Seamless flow when session expires
- **Consistent Error Handling**: All auth-related errors now provide the same re-authentication path
- **Type Safety**: Updated TypeScript types include new re-authentication fields

## Testing

The changes have been implemented and are ready for testing. Test scenarios include:

1. Upload video with expired access token (should return auth URL)
2. Upload video with missing refresh token (should return auth URL)
3. Upload video with revoked refresh token (should return auth URL)
4. Successful re-authentication flow (should enable subsequent uploads)
