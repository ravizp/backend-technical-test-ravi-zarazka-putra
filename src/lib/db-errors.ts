// Postgres error interface
interface PgError {
  code: string;
  constraint_name?: string;
}

// Type guard for Postgres error
function asPgError(err: unknown): PgError | null {
  for (let cur = err, depth = 0; cur != null && depth < 5; depth++) {
    if (typeof cur === "object" && typeof (cur as PgError).code === "string") {
      return cur as PgError;
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}

// Check if an error is a Postgres unique constraint violation
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const pg = asPgError(err);
  if (!pg || pg.code !== "23505") return false;
  return constraint ? pg.constraint_name === constraint : true;
}
