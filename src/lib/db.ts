import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI environment variable is not defined");
}

export const client = new MongoClient(uri);
export const db = client.db();
