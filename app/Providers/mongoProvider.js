// dbProvider.js
import { MongoClient } from "mongodb"
// import { config } from "../../config/index.js";
import dotenv from 'dotenv'

dotenv.config()

let client;
let db;

async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/";
  client = new MongoClient(uri);

  try {
    await client.connect();
    db = client.db();
    console.log("Connected to MongoDB successfully");
    return db;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

function getDB() {
  if (!db) {
    throw new Error("Database not connected. Call connectDB first.");
  }
  return db;
}

async function closeDB() {
  if (client) {
    await client.close();
    console.log("MongoDB connection closed");
  }
}

export { connectDB, getDB, closeDB };
