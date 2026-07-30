import mongoose from 'mongoose';
import config from '../config/env';

async function clearSessions() {
    await mongoose.connect(config.mongodb.uri);
    const adminId = new mongoose.Types.ObjectId('6a452a1307e3d0d25f36d84e');
    const result = await mongoose.connection.collection('sessions').deleteMany({ userId: adminId });
    console.log(`Deleted ${result.deletedCount} sessions for admin ${adminId}`);
    await mongoose.disconnect();
    process.exit(0);
}

clearSessions().catch(console.error);
