import { redirect } from "next/navigation";

import { RegisterForm } from "@/app/(auth)/register/register-form";
import { getCurrentUser } from "@/lib/auth/dal";
import { listCarreras } from "@/lib/data/carreras";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const carreras = await listCarreras();

  return <RegisterForm carreras={carreras} />;
}
