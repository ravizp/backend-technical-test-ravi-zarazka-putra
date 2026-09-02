import { z } from "zod";

// Load `.env` into process.env when the file exists. No extra dependency:
// process.loadEnvFile is built into Node >= 20.12. Real shell / CI vars still win.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — rely on the ambient environment
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  PG_HOSTNAME: z.string().min(1).default("localhost"),
  PG_PORT: z.coerce.number().int().positive().default(5432),
  PG_USERNAME: z.string().min(1, "PG_USERNAME is required"),
  PG_PASSWORD: z.string().min(1, "PG_PASSWORD is required"),
  PG_DATABASE: z.string().min(1, "PG_DATABASE is required"),

  JWT_SECRET_KEY: z.string().min(8, "JWT_SECRET_KEY must be at least 8 characters"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env: Env = parsed.data;

// Construct the database URL from the validated environment variables.
export const databaseUrl = `postgres://${encodeURIComponent(env.PG_USERNAME)}:${encodeURIComponent(
  env.PG_PASSWORD,
)}@${env.PG_HOSTNAME}:${env.PG_PORT}/${env.PG_DATABASE}`;
