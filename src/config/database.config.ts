import { MongoClient } from 'mongodb';


export const connectToDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    const mongoClient = new MongoClient(mongoUri);

    await mongoClient.connect();
    console.log('Connected to MongoDB');
    return mongoClient.db('agents-db');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
};

export const databaseConfig = {
  provide: 'DATABASE_CONNECTION',
  useFactory: async () => {
    return await connectToDatabase();
  },
};
