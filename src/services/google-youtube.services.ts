import path from "path";
import fs from "fs";

// Load client secrets from a local file
const JSON_FILE_PATH: string | undefined = process.env.YOUTUBE_CLIENT_SECRET_PATH;

if (!JSON_FILE_PATH) {
    throw new Error("YOUTUBE_CLIENT_SECRET_PATH environment variable is not set");
}

export const CLIENT_SECRET_PATH = path.join(process.cwd(), JSON_FILE_PATH);

// If modifying these scopes, delete your previously saved credentials
export const SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube"
];

// Load and parse client secrets
export const loadClientSecrets = () => {
    const content = fs.readFileSync(CLIENT_SECRET_PATH, "utf-8");
    return JSON.parse(content);
};

// Create OAuth2 client
export const createOAuth2Client = (google: any) => {
    const credentials = loadClientSecrets();
    // Handle both 'installed' (desktop/mobile) and 'web' (web apps) credential formats
    const clientConfig = credentials.installed || credentials.web;
    
    if (!clientConfig) {
        throw new Error("Invalid client secrets file: missing 'installed' or 'web' key");
    }

    const { client_secret, client_id, redirect_uris } = clientConfig;
    return new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
    );
};
