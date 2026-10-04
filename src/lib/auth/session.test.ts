// @vitest-environment node
import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

let signSession: typeof import("@/lib/auth/session").signSession;
let verifySession: typeof import("@/lib/auth/session").verifySession;

const SECRET = "test-secret-with-more-than-32-characters!!";
const payload = {
  sub: "1",
  login: "admin",
  rol: "administrador" as const,
  nombre: "Admin",
};

beforeAll(async () => {
  process.env.AUTH_SECRET = SECRET;
  ({ signSession, verifySession } = await import("@/lib/auth/session"));
});

describe("session JWT", () => {
  it("signs and verifies a payload roundtrip", async () => {
    const token = await signSession(payload);
    const result = await verifySession(token);
    expect(result).toMatchObject(payload);
  });

  it("rejects a tampered token", async () => {
    const token = await signSession(payload);
    const tampered = token.slice(0, -3) + "abc";
    expect(await verifySession(tampered)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(0)
      .setExpirationTime(1)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(expired)).toBeNull();
  });

  it("rejects a token with an unknown role", async () => {
    const bad = await new SignJWT({ ...payload, rol: "superuser" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(bad)).toBeNull();
  });
});

describe("session debeCambiarClave flag (FPC)", () => {
  const signRaw = (claims: Record<string, unknown>) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode(SECRET));

  it("accepts a pre-existing token that has no flag (F6)", async () => {
    const result = await verifySession(await signRaw({ ...payload }));
    expect(result).toMatchObject(payload);
    expect(result?.debeCambiarClave).toBeUndefined();
  });

  it.each([true, false])("accepts and preserves %s", async (flag) => {
    const token = await signSession({ ...payload, debeCambiarClave: flag });
    const result = await verifySession(token);
    expect(result?.debeCambiarClave).toBe(flag);
  });

  it.each(["yes", 1, "true", null])(
    "rejects a non-boolean flag (%s)",
    async (flag) => {
      const token = await signRaw({ ...payload, debeCambiarClave: flag });
      expect(await verifySession(token)).toBeNull();
    },
  );
});
