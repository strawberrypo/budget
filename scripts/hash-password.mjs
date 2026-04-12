import { randomBytes, scryptSync } from "crypto";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run hash-password -- <password>");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const key = scryptSync(password, salt, 64).toString("hex");

console.log(`${salt}:${key}`);
