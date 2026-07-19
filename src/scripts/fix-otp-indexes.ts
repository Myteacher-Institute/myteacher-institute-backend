import mongoose from 'mongoose';
import config from '../config/env';
import Otp from '../models/otp.model';

/**
 * Script to fix OTP indexes after schema changes
 * This drops the old TTL index and recreates it with the correct expireAfterSeconds value
 */
async function fixOtpIndexes() {
    try {
        console.log('🔧 Connecting to MongoDB...');
        await mongoose.connect(config.mongodb.uri);
        console.log('✓ Connected to MongoDB');

        console.log('🔍 Checking existing indexes...');
        const indexes = await Otp.collection.getIndexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        // Drop the old TTL index if it exists
        console.log('🗑️  Dropping old indexes...');
        try {
            await Otp.collection.dropIndex('expiresAt_1');
            console.log('✓ Dropped old expiresAt_1 index');
        } catch (error: any) {
            if (error.codeName === 'IndexNotFound') {
                console.log('ℹ️  Index expiresAt_1 not found, skipping...');
            } else {
                throw error;
            }
        }

        // Ensure the new indexes are created
        console.log('📝 Creating new indexes...');
        await Otp.createIndexes();
        console.log('✓ New indexes created successfully');

        console.log('🔍 Verifying new indexes...');
        const newIndexes = await Otp.collection.getIndexes();
        console.log('Updated indexes:', JSON.stringify(newIndexes, null, 2));

        console.log('✅ OTP indexes fixed successfully!');
        
    } catch (error) {
        console.error('❌ Error fixing OTP indexes:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
        process.exit(0);
    }
}

fixOtpIndexes();
