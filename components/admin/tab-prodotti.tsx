import { getAllSuppliers, getCatalogBySupplier } from "@/lib/db/queries";
import { SupplierCatalogList } from "./supplier-catalog-list";

export async function TabProdotti({ supplierId }: { supplierId?: string }) {
  const suppliers = await getAllSuppliers();

  const suppliersWithCatalog = await Promise.all(
    suppliers.map(async (s) => {
      const products = await getCatalogBySupplier(s.supplierId);
      return { supplier: s, products };
    })
  );

  return (
    <div className="space-y-6">
      <SupplierCatalogList initialData={suppliersWithCatalog} initialSupplierId={supplierId} />
    </div>
  );
}
