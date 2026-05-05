import { getAllSuppliers, getCatalogBySupplier } from "@/lib/db/queries";
import { SupplierCatalogList } from "./supplier-catalog-list";

export async function TabProdotti() {
  const suppliers = await getAllSuppliers();

  const suppliersWithCatalog = await Promise.all(
    suppliers.map(async (s) => {
      const products = await getCatalogBySupplier(s.supplierId);
      return { supplier: s, products };
    })
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-4 shadow-sm border border-pm-border">
        <div>
          <h2 className="text-[16px] font-bold text-pm-near-black">Catalogo Prodotti</h2>
          <p className="text-[12px] text-pm-gray">Lista unica filtrabile per fornitore, categoria e raggruppamento.</p>
        </div>
      </div>

      <SupplierCatalogList initialData={suppliersWithCatalog} />
    </div>
  );
}
