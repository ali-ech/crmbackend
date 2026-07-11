import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise;

export async function connectDB() {
  mongoose.set('strictQuery', true);

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    }).then((instance) => {
      console.log(`MongoDB connected (${instance.connection.name})`);
      return instance.connection;
    }).catch((err) => {
      connectionPromise = undefined;
      console.error('MongoDB connection failed:', err.message);
      throw err;
    });
  }

  return connectionPromise;
}
