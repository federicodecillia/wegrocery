import { getAllSuppliersAdmin, getAllCatalogProducts } from "@/lib/db/queries";
import { t } from "@/lib/i18n";
import { CreateToggle } from "./create-toggle";
import { FornitoriForm, FornitoriList } from "./fornitori-forms";

export async function TabFornitori() {
  const [suppliers, catalogBySupplier] = await Promise.all([
    getAllSuppliersAdmin(),
    getAllCatalogProducts(),
  ]);
  const productCounts = Object.fromEntries(
    Object.entries(catalogBySupplier).map(([id, list]) => [id, list.filter((p) => p.active).length]),
  );

  return (
    <div className="space-y-4">
      <CreateToggle label={t.admin.suppliers.addSupplier}>
        <FornitoriForm />
      </CreateToggle>
      <FornitoriList suppliers={suppliers} productCounts={productCounts} />
    </div>
  );
}
