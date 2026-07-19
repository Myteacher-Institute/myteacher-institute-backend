# Google Drive API Setup Instructions

## How to Get Google Drive API Credentials

### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top and select "New Project"
3. Enter a project name (e.g., "MyTeacher Institute") and click "Create"
4. Wait for the project to be created, then select it

### Step 2: Enable Google Drive API
1. In the left sidebar, go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

### Step 3: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Fill in the following:
   - **Name**: MyTeacher Institute Drive
   - **Authorized redirect URIs**: Add your callback URL
     - Development: `http://localhost:4000/google/drive/callback`
     - Production: `https://your-domain.com/google/drive/callback`
5. Click "Create"
6. Copy the **Client ID** and **Client Secret** - you'll need these for your .env file

### Step 4: Update .env File
Add the following to your `.env` file:

```env
GOOGLE_DRIVE_CLIENT_ID=your-client-id-here
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret-here
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:4000/google/drive/callback
```

### Step 5: Important Notes
- Keep your credentials secure - never commit them to version control
- The redirect URI must match exactly what you configured in Google Cloud Console
- For production, use environment-specific credentials
- Consider using Google Cloud Storage instead of Drive for large file storage if needed

### Alternative: Using Service Account (for server-side only)
If you don't need user-specific Drive access, you can use a Service Account:

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service account"
3. Create the service account and download the JSON key file
4. Share the Drive folder with the service account email
5. Use the service account credentials in your backend

This approach is simpler for server-side file uploads without user authentication.
