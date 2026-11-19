import { redirect } from "next/navigation";

import { RegisterForm } from "@/app/(auth)/register/register-form";
import { RegistrationClosed } from "@/app/(auth)/register/registration-closed";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth/dal";
import { listCarreras } from "@/lib/data/carreras";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  // Closed by default; the register action enforces the same switch.
  if (!env.REGISTRATION_OPEN) return <RegistrationClosed />;

  const carreras = await listCarreras();

  return <RegisterForm carreras={carreras} />;
}
