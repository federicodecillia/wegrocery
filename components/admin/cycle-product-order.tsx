"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Announcements,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Pencil, Trash2 } from "lucide-react";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { t } from "@/lib/i18n";
import {
  flattenGroups,
  groupCycleProducts,
  moveGroup,
  moveIndex,
  moveProduct,
  OTHER_CATEGORY,
  type ProductGroup,
  type ProductOrderMode,
} from "@/lib/products/cycle-order";

// Admin → Ciclo → Prodotti: the order the members see (lib/products/cycle-order.ts).
// Alphabetical is the default; Custom lets the admin drag the products (a
// handle from sm up, with the keyboard too) or move them with the arrows,
// inside their category, and move whole categories with the arrows. Every
// move saves the whole order at once.

export type OrderableProduct = {
  productId: string;
  name: string;
  variant: string | null;
  format: string | null;
  unitPrice: string;
  unit: string | null;
  supplierName: string | null;
  category: string | null;
  emoji: string | null;
  pricePerKg?: string | null;
  notes?: string | null;
};

const po = t.admin.productOrder;

export function ProductOrderSwitch({
  mode,
  disabled,
  onChange,
}: {
  mode: ProductOrderMode;
  disabled: boolean;
  onChange: (mode: ProductOrderMode) => void;
}) {
  const options: { id: ProductOrderMode; label: string }[] = [
    { id: "alpha", label: po.alpha },
    { id: "custom", label: po.custom },
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id="product-order-label" className="text-[13px] font-bold text-foreground">
          {po.title}
        </span>
        <div role="group" aria-labelledby="product-order-label" className="flex gap-1 rounded-full bg-tint/[0.05] p-1">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={mode === opt.id}
              disabled={disabled}
              onClick={() => mode !== opt.id && onChange(opt.id)}
              className={`min-h-(--control-h) rounded-full px-4 text-[13px] font-semibold disabled:opacity-60 ${
                mode === opt.id ? "bg-card text-foreground shadow-sm" : "text-secondary-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-label text-secondary-foreground">{mode === "alpha" ? po.alphaHint : po.customHint}</p>
    </div>
  );
}

const iconBtn =
  "inline-flex size-(--control-h) shrink-0 items-center justify-center rounded-lg text-secondary-foreground hover:bg-tint/[0.05] hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

export function SortableProductList({
  products,
  onSave,
  onRemove,
  editingId,
  onEdit,
  renderEditor,
}: {
  /** In the cycle's custom order (getAdminCycleProducts). */
  products: OrderableProduct[];
  onSave: (productIds: string[]) => void;
  onRemove: (productId: string) => void;
  /** The product whose edit form is open under its row. */
  editingId: string | null;
  onEdit: (productId: string) => void;
  renderEditor: (product: OrderableProduct) => ReactNode;
}) {
  // The list follows the props until the admin moves something; the moved
  // layout then stays (the parent remounts it with a new key on each load).
  const [moved, setMoved] = useState<ProductGroup<OrderableProduct>[] | null>(null);
  const loaded = useMemo(() => groupCycleProducts(products, "custom"), [products]);
  const groups = moved ?? loaded;

  function apply(next: ProductGroup<OrderableProduct>[]) {
    const ids = flattenGroups(next);
    if (ids.join() === flattenGroups(groups).join()) return;
    setMoved(next);
    onSave(ids);
  }

  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <section key={g.category || "_"} aria-label={labelOf(g.category)} className="space-y-1">
          <div className="flex items-center justify-between gap-2 px-1">
            <h5 className="text-label font-bold uppercase tracking-wider text-muted-foreground">{labelOf(g.category)}</h5>
            {groups.length > 1 && (
              <div className="flex shrink-0">
                <button
                  type="button"
                  className={iconBtn}
                  disabled={gi === 0}
                  aria-label={po.categoryUp(labelOf(g.category))}
                  onClick={() => apply(moveGroup(groups, gi, -1))}
                >
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  disabled={gi === groups.length - 1}
                  aria-label={po.categoryDown(labelOf(g.category))}
                  onClick={() => apply(moveGroup(groups, gi, 1))}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
          <CategoryList
            group={g}
            onMove={(productId, delta) => apply(moveProduct(groups, productId, delta))}
            onDrop={(from, to) =>
              apply(groups.map((x, i) => (i === gi ? { ...x, products: moveIndex(x.products, from, to) } : x)))
            }
            onRemove={onRemove}
            editingId={editingId}
            onEdit={onEdit}
            renderEditor={renderEditor}
          />
        </section>
      ))}
    </div>
  );
}

function CategoryList({
  group,
  onMove,
  onDrop,
  onRemove,
  editingId,
  onEdit,
  renderEditor,
}: {
  group: ProductGroup<OrderableProduct>;
  onMove: (productId: string, delta: -1 | 1) => void;
  onDrop: (from: number, to: number) => void;
  onRemove: (productId: string) => void;
  editingId: string | null;
  onEdit: (productId: string) => void;
  renderEditor: (product: OrderableProduct) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = group.products.map((p) => p.productId);
  const nameOf = (id: string | number) => group.products.find((p) => p.productId === id)?.name ?? "";
  const positionOf = (id: string | number | undefined) => (id == null ? 0 : ids.indexOf(String(id)) + 1);
  const announcements: Announcements = {
    onDragStart: ({ active }) => po.dndPickedUp(nameOf(active.id)),
    onDragOver: ({ active, over }) => (over ? po.dndOver(nameOf(active.id), positionOf(over.id)) : undefined),
    onDragEnd: ({ active, over }) => (over ? po.dndDropped(nameOf(active.id), positionOf(over.id)) : undefined),
    onDragCancel: ({ active }) => po.dndCancelled(nameOf(active.id)),
  };

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    onDrop(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: po.dndInstructions } }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {group.products.map((p, i) => (
            <SortableRow
              key={p.productId}
              product={p}
              first={i === 0}
              last={i === group.products.length - 1}
              onMove={(delta) => onMove(p.productId, delta)}
              onRemove={() => onRemove(p.productId)}
              editing={editingId === p.productId}
              onEdit={() => onEdit(p.productId)}
              editor={editingId === p.productId ? renderEditor(p) : null}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  product: p,
  first,
  last,
  onMove,
  onRemove,
  editing,
  onEdit,
  editor,
}: {
  product: OrderableProduct;
  first: boolean;
  last: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  editing: boolean;
  onEdit: () => void;
  /** The edit form, shown under the row while it is open. */
  editor: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: p.productId,
  });
  const meta = [p.variant, p.format && `(${p.format})`].filter(Boolean).join(" ");
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative bg-card first:rounded-t-lg last:rounded-b-lg ${
        isDragging ? "z-10 shadow-md ring-1 ring-border" : ""
      }`}
    >
      <div className="flex items-center gap-1 py-1.5 pr-1 pl-2.5 sm:pl-1">
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={po.dragHandle(p.name)}
        className={`${iconBtn.replace("inline-flex ", "")} hidden cursor-grab touch-none items-center justify-center active:cursor-grabbing sm:inline-flex`}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span aria-hidden className="shrink-0 text-base leading-none">
        {p.emoji || getProductEmoji(p.name)}
      </span>
      <div className="min-w-0 flex-1 pl-1">
        <div className="truncate text-[13px] font-medium text-foreground">{p.name}</div>
        <div className="flex items-center gap-2 text-label text-secondary-foreground">
          {meta && <span className="truncate">{meta}</span>}
          <span className="shrink-0 font-bold tabular-nums text-primary-text">{formatEur(parseFloat(p.unitPrice))}</span>
          <PricePerKg value={p.pricePerKg} />
        </div>
      </div>
      <EditButton name={p.name} expanded={editing} onEdit={onEdit} />
      <button type="button" className={iconBtn} disabled={first} aria-label={po.moveUp(p.name)} onClick={() => onMove(-1)}>
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button type="button" className={iconBtn} disabled={last} aria-label={po.moveDown(p.name)} onClick={() => onMove(1)}>
        <ChevronDown className="size-4" aria-hidden />
      </button>
      <RemoveButton name={p.name} onRemove={onRemove} />
      </div>
      {editor && <div className="px-2 pb-2">{editor}</div>}
    </li>
  );
}

/** Opens the edit form of a cycle product under its row. */
export function EditButton({ name, expanded, onEdit }: { name: string; expanded: boolean; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-expanded={expanded}
      aria-label={`${t.admin.common.edit}: ${name}`}
      title={t.admin.common.edit}
      className={`${iconBtn} hover:text-foreground`}
    >
      <Pencil className="size-4" aria-hidden />
    </button>
  );
}

export function PricePerKg({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return <span className="shrink-0 tabular-nums">({formatEur(parseFloat(value))}/kg)</span>;
}

/** The quiet remove button of a cycle product: an icon, red only on hover. */
export function RemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${t.admin.products.removeFromCycle}: ${name}`}
      title={t.admin.products.removeFromCycle}
      className={`${iconBtn} hover:bg-danger-bg hover:text-destructive`}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

function labelOf(category: string): string {
  return !category || category === OTHER_CATEGORY ? t.order.otherCategory : category;
}
