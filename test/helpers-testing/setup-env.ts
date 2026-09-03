// Global Setup Test
process.env.NODE_ENV = "test";
process.env.PG_HOSTNAME ||= "localhost";
process.env.PG_PORT ||= "5433";
process.env.PG_USERNAME ||= "postgres";
process.env.PG_PASSWORD ||= "postgres";
process.env.PG_DATABASE = "inventory_procurement_test";
process.env.JWT_SECRET_KEY ||= "test-secret-key-please-change";
process.env.BCRYPT_ROUNDS ||= "4";
