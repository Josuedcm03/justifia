// Sin "server-only": bcrypt es una función pura, también se usa desde el
// script de seed (fuera de Next). Nunca se importa en el bundle de cliente.
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
