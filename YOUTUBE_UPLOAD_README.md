# YouTube Upload API Integration Guide

This guide explains how to integrate YouTube video upload functionality with the course creation system.

## Overview

The YouTube upload API allows instructors to upload videos directly to their YouTube channel when creating courses. The system uses OAuth2 authentication and stores tokens securely in the database.

## Architecture

```
Course Creation Flow:
1. Instructor creates course with video files
2. Videos are uploaded to YouTube via API
3. YouTube video IDs are stored in course
4. Course is saved with YouTube video references
```

## API Endpoints

### Base URL
```
http://localhost:YOUR_PORT/youtube
```

### 1. Get YouTube Authentication URL
**Endpoint:** `GET /youtube/auth`  
**Authentication:** Required (Bearer Token)  
**Description:** Generates an OAuth2 authorization URL for the instructor

**Response:**
```json
{
  "status": "success",
  "message": "Authentication URL generated",
  "authUrl": "https://accounts.google.com/o/oauth2/auth?access_type=offline&scope=https://www.googleapis.com/auth/youtube.upload&response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&state=eyJpbnN0cnVjdG9ySWQiOiI2NjY1YjM4YjE1ZjJmM2MwZmEzZjJmZmYifQ=="
}
```

### 2. OAuth Callback
**Endpoint:** `GET /youtube/callback`  
**Authentication:** Not Required  
**Description:** Handles the OAuth callback from Google and saves tokens to database

**Query Parameters:**
- `code` (required): Authorization code from Google
- `state` (required): Base64-encoded instructor ID

**Response:**
```json
{
  "status": "success",
  "message": "Authentication successful",
  "tokens": {
    "access_token": "ya29.a0AfH6...",
    "refresh_token": "1//0g...",
    "expiry_date": 1716740000000
  }
}
```

### 3. Upload Video to YouTube
**Endpoint:** `POST /youtube/upload`  
**Authentication:** Required (Bearer Token)  
**Description:** Uploads a video to the instructor's YouTube channel

**Request Body:**
```json
{
  "videoPath": "/path/to/video.mp4",
  "title": "Course Introduction",
  "description": "Welcome to this course",
  "tags": ["education", "tutorial"],
  "privacyStatus": "private"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Video uploaded successfully to YouTube",
  "videoId": "dQw4w9WgXcQ",
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

## Integration with Course Creation

### Option 1: Upload Videos Before Course Creation

**Step 1: Authenticate with YouTube**
```bash
curl -X GET http://localhost:3000/youtube/auth \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Step 2: Complete OAuth Flow**
- Open the returned `authUrl` in browser
- Authorize the application
- Google redirects to callback automatically

**Step 3: Upload Video**
```bash
curl -X POST http://localhost:3000/youtube/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "/uploads/course-intro.mp4",
    "title": "Course Introduction",
    "description": "Welcome to the course",
    "tags": ["education"],
    "privacyStatus": "private"
  }'
```

**Step 4: Create Course with YouTube Video ID**
```bash
curl -X POST http://localhost:3000/api/course/add \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "courseName": "JavaScript Basics",
    "description": "Learn JavaScript from scratch",
    "courseVideos": [
      {
        "youtubeId": "dQw4w9WgXcQ",
        "title": "Course Introduction",
        "duration": "10:30"
      }
    ],
    "price": 99.99,
    "duration": "5 hours",
    "certificate": true
  }'
```

### Option 2: Upload During Course Creation (Recommended)

Modify the course creation flow to automatically upload videos:

**Frontend Example:**
```javascript
// 1. Create course with local video files
const courseData = {
  courseName: "JavaScript Basics",
  description: "Learn JavaScript from scratch",
  courseVideos: [
    {
      localPath: "/uploads/intro.mp4",
      title: "Course Introduction",
      duration: "10:30"
    }
  ],
  price: 99.99,
  duration: "5 hours",
  certificate: true
};

// 2. Upload each video to YouTube
const youtubeVideos = [];
for (const video of courseData.courseVideos) {
  const uploadResponse = await fetch('http://localhost:3000/youtube/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      videoPath: video.localPath,
      title: video.title,
      description: `Part of ${courseData.courseName}`,
      privacyStatus: 'private'
    })
  });
  
  const uploadResult = await uploadResponse.json();
  youtubeVideos.push({
    youtubeId: uploadResult.videoId,
    title: video.title,
    duration: video.duration
  });
}

// 3. Create course with YouTube video IDs
const finalCourseData = {
  ...courseData,
  courseVideos: youtubeVideos
};

const createResponse = await fetch('http://localhost:3000/api/course/add', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(finalCourseData)
});
```

## Postman Collection

### Setup
1. Import the environment variables:
   - `BASE_URL`: `http://localhost:3000`
   - `JWT_TOKEN`: Your authentication token

### Collection Requests

#### 1. Get YouTube Auth URL
```
GET {{BASE_URL}}/youtube/auth
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
```

#### 2. Upload Video
```
POST {{BASE_URL}}/youtube/upload
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
  Content-Type: application/json
Body (raw JSON):
{
  "videoPath": "C:/Users/HP/Desktop/video.mp4",
  "title": "My Course Video",
  "description": "Course description",
  "tags": ["education", "tutorial"],
  "privacyStatus": "private"
}
```

#### 3. Create Course with YouTube Video
```
POST {{BASE_URL}}/api/course/add
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
  Content-Type: application/json
Body (raw JSON):
{
  "courseName": "JavaScript Basics",
  "description": "Learn JavaScript",
  "courseVideos": [
    {
      "youtubeId": "dQw4w9WgXcQ",
      "title": "Introduction",
      "duration": "10:30"
    }
  ],
  "price": 99.99,
  "duration": "5 hours",
  "certificate": true
}
```

## OAuth Flow Diagram

```
1. Instructor requests auth URL
   GET /youtube/auth (with JWT token)
   ↓
2. System returns auth URL with instructorId in state
   ↓
3. Instructor opens auth URL in browser
   ↓
4. Google shows consent screen
   ↓
5. Instructor grants permissions
   ↓
6. Google redirects to callback with code
   GET /youtube/callback?code=...&state=...
   ↓
7. System exchanges code for tokens
   ↓
8. System saves tokens to instructor's database record
   ↓
9. System returns success response
   ↓
10. Instructor can now upload videos
    POST /youtube/upload
```

## Token Management

### Automatic Refresh
The system automatically refreshes expired access tokens using the refresh token stored in the database. This happens transparently during video upload.

### Token Storage
Tokens are stored in the Instructor document:
```javascript
{
  youtubeTokens: {
    accessToken: "ya29.a0AfH6...",
    refreshToken: "1//0g...",
    expiryDate: 1716740000000
  }
}
```

### Security
- Tokens are stored in MongoDB (encrypted database)
- Each instructor has their own tokens
- OAuth state parameter prevents CSRF attacks
- Refresh tokens allow long-term access without re-authentication

## Error Handling

### Common Errors

**401 Unauthorized**
```json
{
  "status": "failed",
  "message": "Unauthorized: Instructor ID not found"
}
```
**Solution:** Ensure you're logged in and sending a valid JWT token.

**400 YouTube Authentication Required**
```json
{
  "status": "failed",
  "message": "YouTube authentication required. Please authenticate first."
}
```
**Solution:** Complete the OAuth flow by calling `/youtube/auth` first.

**404 Video File Not Found**
```json
{
  "status": "failed",
  "message": "Video file not found"
}
```
**Solution:** Ensure the video file exists at the specified path on the server.

**500 Token Refresh Failed**
```json
{
  "status": "failed",
  "message": "Internal server error"
}
```
**Solution:** Re-authenticate with YouTube by calling `/youtube/auth` again.

## Frontend Integration Example

### React Component

```jsx
import React, { useState } from 'react';

const CourseCreator = () => {
  const [courseData, setCourseData] = useState({
    courseName: '',
    description: '',
    videos: []
  });
  const [uploading, setUploading] = useState(false);

  const handleYouTubeAuth = async () => {
    try {
      const response = await fetch('http://localhost:3000/youtube/auth', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      // Open auth URL in new window
      window.open(data.authUrl, '_blank');
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  const uploadVideoToYouTube = async (videoFile) => {
    try {
      const response = await fetch('http://localhost:3000/youtube/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoPath: videoFile.path,
          title: videoFile.title,
          description: videoFile.description,
          privacyStatus: 'private'
        })
      });
      const data = await response.json();
      return data.videoId;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const createCourse = async () => {
    setUploading(true);
    try {
      // Upload all videos to YouTube
      const youtubeVideos = await Promise.all(
        courseData.videos.map(video => uploadVideoToYouTube(video))
      );

      // Create course with YouTube IDs
      const response = await fetch('http://localhost:3000/api/course/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...courseData,
          courseVideos: youtubeVideos.map((youtubeId, index) => ({
            youtubeId,
            title: courseData.videos[index].title,
            duration: courseData.videos[index].duration
          }))
        })
      });

      const data = await response.json();
      console.log('Course created:', data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <button onClick={handleYouTubeAuth}>
        Connect YouTube Account
      </button>
      {/* Course form */}
      <button onClick={createCourse} disabled={uploading}>
        {uploading ? 'Creating Course...' : 'Create Course'}
      </button>
    </div>
  );
};

export default CourseCreator;
```

## Configuration

### Environment Variables
No additional environment variables required. The system uses the `client_secret_google_youtube.json` file for OAuth credentials.

### Google Cloud Console Setup
1. Create a project in Google Cloud Console
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Add `http://localhost` as authorized redirect URI
5. Add your email as a test user (for testing mode)
6. Download client secrets and save as `client_secret_google_youtube.json`

## Troubleshooting

### OAuth Flow Issues
- **Problem:** "Access blocked" error
- **Solution:** Add your email as a test user in Google Cloud Console OAuth consent screen

### Token Issues
- **Problem:** Tokens expire frequently
- **Solution:** The system auto-refreshes tokens. If issues persist, re-authenticate.

### Upload Issues
- **Problem:** Video upload fails
- **Solution:** Ensure video file exists on server and path is correct. Check file size (YouTube has limits).

## Support

For issues or questions, check the console logs for detailed error messages.
