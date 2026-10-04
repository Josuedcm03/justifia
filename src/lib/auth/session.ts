import { jwtVerify, SignJWT } from "jose";

import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

export const SESSION_COOKIE = "justifia_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 h, en segundos

export type SessionPayload = {
  sub: string;
  login: string;
  rol: RolUsuario;
  nombre: string;
  /**
   * Forced-password-change marker (FPC). Optional so a JWT issued before the
   * flag existed stays valid and reads as "no change required" (design D14).
   */
  debeCambiarClave?: boolean;
};

function getKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET no está definido o tiene menos de 32 caracteres.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getKey());
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sub === "string" &&
    typeof v.login === "string" &&
    typeof v.nombre === "string" &&
    typeof v.rol === "string" &&
    (rolesUsuario as readonly string[]).includes(v.rol) &&
    (v.debeCambiarClave === undefined ||
      typeof v.debeCambiarClave === "boolean")
  );
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });
    return isSessionPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}
