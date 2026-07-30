import mongoose from 'mongoose';
import config from '../config/env';

async function check() {
    await mongoose.connect(config.mongodb.uri);
    const adminId = new mongoose.Types.ObjectId('6a452a1307e3d0d25f36d84e');
    const count = await mongoose.connection.collection('sessions').countDocuments({ userId: adminId });
    const sessions = await mongoose.connection.collection('sessions')
        .find({ userId: adminId }, { projection: { isRevoked: 1, expiresAt: 1, createdAt: 1, logoutAt: 1 } })
        .toArray();
    console.log('Session count:', count);
    console.log(JSON.stringify(sessions, null, 2));
    await mongoose.disconnect();
    process.exit(0);
}

check().catch(console.error);
