import { beforeEach, describe, expect, it } from "vitest";
import { truncateAll } from "../helpers-testing/db-connection.js";
import { seedBasics } from "../helpers-testing/fixtures-seeders.js";
import { api } from "../helpers-testing/api-request.js";

describe("test harness", () => {
  beforeEach(truncateAll);

  it("seeds base data and the app answers with a seeded token", async () => {
    const f = await seedBasics();

    const me = await api("GET", "/api/auth/me", { token: f.userToken });
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("user1@test.local");
    expect(me.body.role).toBe("USER");

    const approverMe = await api("GET", "/api/auth/me", { token: f.approverToken });
    expect(approverMe.body.role).toBe("APPROVER");
  });
});
