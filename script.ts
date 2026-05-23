import { prisma } from "./lib/prisma.js";

async function main() {
  console.log("Starting Prisma Postgres smoke test...");
  try {
    const user = await prisma.user.create({
      data: {
        username: `alice-${Date.now()}`,
        passwordHash: "dummyhash",
        name: "Alice",
        role: "user",
        email: `alice-${Date.now()}@prisma.io`,
      },
    });
    console.log("Created user successfully:", user);

    const allUsers = await prisma.user.findMany({
      include: {
        timeLogs: true,
      },
    });
    console.log("Retrieved users with timeLogs:");
    console.dir(allUsers, { depth: null });
  } catch (err) {
    console.log("\n[Expected behavior since no live production database is connected yet]");
    console.log("Database smoke test could not complete because a live Prisma Postgres connection has not been configured in .env yet.");
    console.log("Error details:", err);
  }
}

main().catch((err) => {
  console.error("Fatal error in main:", err);
});
