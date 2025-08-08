import mongoose from 'mongoose'
import logger from '../app/utils/logger.js';

// Laravel-style database configuration
class DatabaseConfig {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    
    // Database configuration options (Laravel-style config)
    this.config = {
      development: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/Bank_api',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 10, // Maximum number of connections
          serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
          socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
          family: 4, // Use IPv4, skip trying IPv6
          bufferCommands: false, // Disable mongoose buffering
          bufferMaxEntries: 0, // Disable mongoose buffering
          retryWrites: true,
          retryReads: true,
          writeConcern: {
            w: 'majority',
            j: true,
            wtimeout: 1000
          }
        }
      },
      
      test: {
        uri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/Bank_api',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          family: 4,
          bufferCommands: false,
          bufferMaxEntries: 0
        }
      },
      
      production: {
        uri: process.env.MONGODB_URI,
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 20, // Increased pool size for production
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          family: 4,
          bufferCommands: false,
          bufferMaxEntries: 0,
          retryWrites: true,
          retryReads: true,
          ssl: true, // Enable SSL for production
          sslValidate: true,
          writeConcern: {
            w: 'majority',
            j: true,
            wtimeout: 1000
          },
          readPreference: 'primary',
          authSource: 'admin'
        }
      }
    };
  }

  // Get current environment configuration
  getCurrentConfig() {
    const env = process.env.NODE_ENV || 'development';
    return this.config[env];
  }

  // Connect to MongoDB (Laravel-style database connection)
  async connect() {
    try {
      if (this.isConnected) {
        logger.info('Database already connected');
        return this.connection;
      }

      const config = this.getCurrentConfig();
      
      if (!config.uri) {
        throw new Error(`Database URI not configured for environment: ${process.env.NODE_ENV || 'development'}`);
      }

      logger.info('Connecting to MongoDB...', {
        environment: process.env.NODE_ENV || 'development',
        host: this.maskConnectionString(config.uri)
      });

      // Set mongoose options globally
      mongoose.set('strictQuery', true);
      
      // Connect to MongoDB
      this.connection = await mongoose.connect(config.uri, config.options);
      this.isConnected = true;

      logger.info('MongoDB connected successfully', {
        host: this.maskConnectionString(config.uri),
        database: this.connection.connection.name,
        readyState: this.connection.connection.readyState
      });

      // Set up connection event listeners
      this.setupEventListeners();

      return this.connection;
    } catch (error) {
      logger.error('MongoDB connection error:', {
        error: error.message,
        stack: error.stack
      });
      
      // Exit process with failure
      process.exit(1);
    }
  }

  // Disconnect from MongoDB
  async disconnect() {
    try {
      if (!this.isConnected) {
        logger.info('Database not connected');
        return;
      }

      await mongoose.connection.close();
      this.isConnected = false;
      this.connection = null;

      logger.info('MongoDB disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Setup connection event listeners (Laravel-style event handling)
  setupEventListeners() {
    const connection = mongoose.connection;

    // Connection events
    connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    connection.on('error', (error) => {
      logger.error('Mongoose connection error:', {
        error: error.message,
        stack: error.stack
      });
    });

    connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });

    connection.on('reconnected', () => {
      logger.info('Mongoose reconnected to MongoDB');
      this.isConnected = true;
    });

    connection.on('timeout', () => {
      logger.error('Mongoose connection timeout');
    });

    connection.on('close', () => {
      logger.info('Mongoose connection closed');
      this.isConnected = false;
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT. Gracefully shutting down database connection...');
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM. Gracefully shutting down database connection...');
      await this.disconnect();
      process.exit(0);
    });
  }

  // Check database connection health
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'disconnected',
          message: 'Database not connected'
        };
      }

      // Ping the database
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'connected',
        message: 'Database connection is healthy',
        database: mongoose.connection.name,
        host: this.maskConnectionString(this.getCurrentConfig().uri),
        readyState: mongoose.connection.readyState,
        collections: await this.getCollectionStats()
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      
      return {
        status: 'error',
        message: 'Database health check failed',
        error: error.message
      };
    }
  }

  // Get collection statistics
  async getCollectionStats() {
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const stats = {};

      for (const collection of collections) {
        const collectionStats = await mongoose.connection.db.collection(collection.name).stats();
        stats[collection.name] = {
          documents: collectionStats.count || 0,
          size: collectionStats.size || 0,
          indexes: collectionStats.nindexes || 0
        };
      }

      return stats;
    } catch (error) {
      logger.error('Error getting collection stats:', error);
      return {};
    }
  }

  // Mask sensitive information in connection string
  maskConnectionString(uri) {
    if (!uri) return 'N/A';
    
    // Replace password with asterisks
    return uri.replace(/:([^:@]+)@/, ':***@');
  }

  // Create database indexes (Laravel-style migrations)
  async createIndexes() {
    try {
      logger.info('Creating database indexes...');

      // User indexes
      await mongoose.connection.collection('users').createIndex(
        { email: 1 }, 
        { unique: true, background: true }
      );
      
      await mongoose.connection.collection('users').createIndex(
        { phoneNumber: 1 }, 
        { background: true }
      );
      
      await mongoose.connection.collection('users').createIndex(
        { status: 1 }, 
        { background: true }
      );

      // Account indexes
      await mongoose.connection.collection('accounts').createIndex(
        { accountNumber: 1 }, 
        { unique: true, background: true }
      );
      
      await mongoose.connection.collection('accounts').createIndex(
        { userId: 1 }, 
        { background: true }
      );
      
      await mongoose.connection.collection('accounts').createIndex(
        { status: 1 }, 
        { background: true }
      );
      
      await mongoose.connection.collection('accounts').createIndex(
        { accountType: 1 }, 
        { background: true }
      );

      // Transaction indexes
      await mongoose.connection.collection('transactions').createIndex(
        { transactionId: 1 }, 
        { unique: true, background: true }
      );
      
      await mongoose.connection.collection('transactions').createIndex(
        { fromAccount: 1 }, 
        { background: true }
      );
      
      await mongoose.connection.collection('transactions').createIndex(
        { toAccount: 1 }, 
        { background: true }
      );
      
      await mongoose.connection.collection('transactions').createIndex(
        { status: 1 }, 
        { background: true }
      );
      
      await mongoose.connection.collection('transactions').createIndex(
        { createdAt: -1 }, 
        { background: true }
      );
      
      await mongoose.connection.collection('transactions').createIndex(
        { type: 1 }, 
        { background: true }
      );

      // Compound indexes for better query performance
      await mongoose.connection.collection('transactions').createIndex(
        { fromAccount: 1, createdAt: -1 }, 
        { background: true }
      );
      
      await mongoose.connection.collection('transactions').createIndex(
        { fromAccount: 1, status: 1 }, 
        { background: true }
      );

      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Error creating database indexes:', error);
      throw error;
    }
  }

  // Drop database (for testing purposes)
  async dropDatabase() {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Cannot drop database in production environment');
      }

      await mongoose.connection.dropDatabase();
      logger.info('Database dropped successfully');
    } catch (error) {
      logger.error('Error dropping database:', error);
      throw error;
    }
  }

  // Get connection status
  getConnectionStatus() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      status: states[mongoose.connection.readyState] || 'unknown',
      host: this.maskConnectionString(this.getCurrentConfig().uri),
      database: mongoose.connection.name
    };
  }

  // Seed database with initial data (Laravel-style seeding)
  async seedDatabase() {
    try {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Skipping database seeding in production environment');
        return;
      }

      logger.info('Seeding database with initial data...');

      // Check if data already exists
      const User = require('../models/User');
      const existingUsers = await User.countDocuments();

      if (existingUsers > 0) {
        logger.info('Database already contains data, skipping seeding');
        return;
      }

      // Create admin user
      const bcrypt = require('bcryptjs');
      const adminPassword = await bcrypt.hash('Admin123!', 12);

      await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@bankingapi.com',
        password: adminPassword,
        phoneNumber: '+1234567890',
        dateOfBirth: new Date('1990-01-01'),
        ssn: '123-45-6789',
        role: 'admin',
        status: 'active',
        isEmailVerified: true,
        address: {
          street: '123 Admin St',
          city: 'Admin City',
          state: 'AC',
          zipCode: '12345',
          country: 'USA'
        }
      });

      logger.info('Database seeded successfully');
    } catch (error) {
      logger.error('Error seeding database:', error);
      throw error;
    }
  }
}

// Create singleton instance
const databaseConfig = new DatabaseConfig();

// Export connection function (Laravel-style)
const connectDB = async () => {
  return await databaseConfig.connect();
};

// Export other methods
module.exports = {
  connectDB,
  disconnect: () => databaseConfig.disconnect(),
  healthCheck: () => databaseConfig.healthCheck(),
  createIndexes: () => databaseConfig.createIndexes(),
  dropDatabase: () => databaseConfig.dropDatabase(),
  getConnectionStatus: () => databaseConfig.getConnectionStatus(),
  seedDatabase: () => databaseConfig.seedDatabase(),
  
  // Export the instance for advanced usage
  instance: databaseConfig
};
