// @vitest-environment node
import { SignJWT, decodeJwt } from "jose";
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

// FE-32 (UX-22): the choice to stay signed in travels with the session as an
// optional claim, so every re-issue keeps the duration the user chose.
describe("session duration and the mantenerSesion claim (FE-32)", () => {
  const HOUR = 60 * 60;
  const DAY = 24 * HOUR;
  const signRaw = (claims: Record<string, unknown>) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode(SECRET));
  const lifetime = (token: string) => {
    const { exp, iat } = decodeJwt(token);
    return (exp as number) - (iat as number);
  };

  it("lasts 30 days when the claim is true", async () => {
    const token = await signSession({ ...payload, mantenerSesion: true });

    expect(lifetime(token)).toBe(30 * DAY);
  });

  it.each([
    ["absent", {}],
    ["false", { mantenerSesion: false }],
  ])("lasts 8 hours when the claim is %s", async (_label, extra) => {
    const token = await signSession({ ...payload, ...extra });

    expect(lifetime(token)).toBe(8 * HOUR);
  });

  it("returns the two durations from one helper, and the token agrees with it", async () => {
    const { SESSION_MAX_AGE, SESSION_MAX_AGE_KEPT, sessionMaxAge } =
      await import("@/lib/auth/session");

    expect(SESSION_MAX_AGE).toBe(8 * HOUR);
    expect(SESSION_MAX_AGE_KEPT).toBe(30 * DAY);
    expect(sessionMaxAge(false)).toBe(SESSION_MAX_AGE);
    expect(sessionMaxAge(true)).toBe(SESSION_MAX_AGE_KEPT);
    expect(lifetime(await signSession({ ...payload }))).toBe(
      sessionMaxAge(false),
    );
    expect(
      lifetime(await signSession({ ...payload, mantenerSesion: true })),
    ).toBe(sessionMaxAge(true));
  });

  it("preserves the claim through verification", async () => {
    const result = await verifySession(
      await signSession({ ...payload, mantenerSesion: true }),
    );

    expect(result?.mantenerSesion).toBe(true);
  });

  it("verifies a token issued before the claim existed and reads it as unchecked", async () => {
    const old = await signRaw({ ...payload });

    const result = await verifySession(old);

    expect(result).toMatchObject(payload);
    expect(result?.mantenerSesion).toBeUndefined();
    expect(lifetime(old)).toBe(8 * HOUR);
  });

  it.each(["yes", 1, "true", null, {}])(
    "refuses a non-boolean claim (%j)",
    async (claim) => {
      const token = await signRaw({ ...payload, mantenerSesion: claim });

      expect(await verifySession(token)).toBeNull();
    },
  );
});
