// A constant bcrypt hash that no password verifies against. The sign-in checks a
// typed password against it when the identifier matches no account or an inactive
// one, so both cost the same password check as a wrong password (FE-23, design
// D13; no rate limiter exists, so timing is equalized instead).
//
// It was produced with `bcrypt.hash(<a sentence nobody types>, 12)`, the cost of
// `hashPassword`; `dummy-hash.test.ts` pins that the two costs match. Like
// `password.ts` it has no "server-only", because it holds no secret: the hash
// is of a throwaway string and protects no account.
export const DUMMY_PASSWORD_HASH =
  "$2b$12$C4MDO7qyzsBBhmy8FdxkKu/bQnsY5hfg1DQ0iSmzBOP/exiQAS5t6";
