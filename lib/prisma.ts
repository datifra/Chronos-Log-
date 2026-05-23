import { PrismaClient } from "../generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL || "";

let clientOptions: any = {};

if (url.startsWith("prisma+postgres://")) {
  // 🚀 Serverless Engine Mode for Prisma Postgres / Accelerate
  clientOptions = {
    accelerateUrl: url,
  };
} else if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
  // 🔌 Direct TCP Connection Mode for Traditional Postgres (using driver adapters)
  const pool = new pg.Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  clientOptions = {
    adapter,
  };
} else {
  // 🌐 Offline Sandbox Fallback
  clientOptions = {
    accelerateUrl: "prisma+postgres://localhost:51213/?api_key=fallback",
  };
}

export const prisma = new PrismaClient(clientOptions);
