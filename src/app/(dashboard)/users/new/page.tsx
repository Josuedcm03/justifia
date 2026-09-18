import { NewUserForm } from "@/app/(dashboard)/users/new/new-user-form";
import { requireRole } from "@/lib/auth/dal";
import { listCarreras } from "@/lib/data/carreras";

export default async function NewUserPage() {
  await requireRole("administrador");
  const carreras = await listCarreras();

  return (
    <div className="flex justify-center">
      <NewUserForm carreras={carreras} />
    </div>
  );
}
