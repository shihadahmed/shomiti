import mongoose from 'mongoose';
import config from './env.js';

mongoose.set('strictQuery', true);

let mongodInstance = null;

async function startMemoryServer() {
  if (config.isProduction || !config.isLocal) return null;
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create({
      instance: {
        dbName: 'shomiti',
      },
    });
    const uri = mongodInstance.getUri();
    console.info('[db] MongoDB Memory Server started');
    return uri;
  } catch (error) {
    console.warn('[db] Failed to start MongoDB Memory Server:', error.message);
    return null;
  }
}

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

  // Try explicit URI first (Atlas), fall back to memory server for local dev
  let connectionUri = uri;
  let useMemoryServer = false;

  if (config.isLocal && (!uri || uri.includes('127.0.0.1') || uri.includes('localhost'))) {
    useMemoryServer = true;
  } else if (config.isLocal && uri) {
    // For local dev with Atlas URI, try it first but allow fallback
    useMemoryServer = true;
  }

  if (useMemoryServer) {
    const memoryUri = await startMemoryServer();
    if (memoryUri) {
      connectionUri = memoryUri;
      console.info('[db] Using MongoDB Memory Server for local development');
    } else if (!uri || uri.includes('127.0.0.1') || uri.includes('localhost')) {
      connectionUri = 'mongodb://127.0.0.1:27017/shomiti';
    }
  }

  try {
    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 15000,
      autoIndex: !config.isProduction,
    });
  } catch (error) {
    // If Atlas fails in local dev, try memory server
    if (config.isLocal && useMemoryServer && connectionUri !== 'mongodb://127.0.0.1:27017/shomiti') {
      console.warn('[db] Atlas connection failed, falling back to memory server:', error.message);
      const memoryUri = await startMemoryServer();
      if (memoryUri) {
        connectionUri = memoryUri;
        await mongoose.connect(connectionUri, {
          serverSelectionTimeoutMS: 15000,
          autoIndex: !config.isProduction,
        });
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  return mongoose.connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
    mongodInstance = null;
  }
}

export default connectDB;
