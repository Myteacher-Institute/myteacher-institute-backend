// Utility functions for the application
// Add helper functions, validators, formatters, etc. here

export const logger = {
    info: (message: string): void => console.log(`ℹ️  ${message}`),
    error: (message: string): void => console.error(`❌ ${message}`),
    success: (message: string): void => console.log(`✓ ${message}`),
    warn: (message: string): void => console.warn(`⚠️  ${message}`),
};

export default logger;
