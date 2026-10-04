// The change-password screen sits outside the `(auth)` route group (it needs a
// session, the group's screens need none), but it should look like the sign-in
// screen it follows. Re-using the shell keeps one copy of the markup.
export { default } from "@/app/(auth)/layout";
