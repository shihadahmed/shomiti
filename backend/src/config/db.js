import mongoose from 'mongoose';
import config from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB(uri = config.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  mongoose.connection.on('connected', () => {
    console.info('[db] connected');
  });
  mongoose.connection.on('error', (error) => {
    console.error('[db] connection error:', error.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    autoIndex: !config.isProduction,
  });

  return mongoose.connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

export default connectDB;
