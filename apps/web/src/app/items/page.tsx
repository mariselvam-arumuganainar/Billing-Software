"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Topbar from "@/components/Topbar";
import { apiClient } from "@/lib/api";

type Item = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  price: number;
  gstRateDefault: number;
  hsnSac?: string | null;
  stockQty: number;
  isActive: boolean;
  imageUrl?: string | null;
};

type ItemForm = {
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  price: string;
  gstRateDefault: string;
  stockQty: string;
  hsnSac: string;
  imageUrl: string;
};

type BarcodeFilter = "all" | "registered" | "not_registered";

const EMPTY_FORM: ItemForm = {
  name: "",
  sku: "",
  barcode: "",
  unit: "piece",
  price: "",
  gstRateDefault: "0",
  stockQty: "",
  hsnSac: "",
  imageUrl: "",
};

const units = ["piece", "kg", "litre", "gram", "packet", "box", "dozen"];

function getInitial(name: string) {
  const clean = name?.trim() || "?";
  return clean.charAt(0).toUpperCase();
}

function parseNumber(value: string, fallback = 0) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isBarcodeRegistered(barcode?: string | null): boolean {
  return Boolean(barcode && barcode.trim() !== "");
}

function BarcodeStatusBadge({ barcode }: { barcode?: string | null }) {
  const registered = isBarcodeRegistered(barcode);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
        registered
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700"
      }`}
      title={registered ? `Barcode: ${barcode}` : "No barcode registered"}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${registered ? "bg-green-500" : "bg-amber-400"}`}
      />
      {registered ? "Registered" : "Not Registered"}
    </span>
  );
}

function ItemVisual({
  name,
  imageUrl,
  size = "md",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const classes =
    size === "sm"
      ? "h-10 w-10 text-sm"
      : size === "lg"
        ? "h-20 w-20 text-2xl"
        : "h-12 w-12 text-base";

  if (imageUrl) {
    return (
      <div
        className={`${classes} overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shrink-0`}
      >
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`${classes} rounded-xl bg-teal-100 text-teal-700 border border-teal-200 shrink-0 flex items-center justify-center font-black`}
      title={name}
    >
      {getInitial(name)}
    </div>
  );
}

export default function ItemMasterPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [barcodeFilter, setBarcodeFilter] = useState<BarcodeFilter>("all");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [savingItem, setSavingItem] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/items");
      setItems(res.data.items ?? []);
    } catch (error) {
      console.error("Failed to fetch items", error);
      alert("Failed to load items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      if (barcodeFilter === "registered" && !isBarcodeRegistered(item.barcode)) return false;
      if (barcodeFilter === "not_registered" && isBarcodeRegistered(item.barcode)) return false;

      if (!q) return true;
      const name = item.name?.toLowerCase() ?? "";
      const sku = item.sku?.toLowerCase() ?? "";
      const hsn = item.hsnSac?.toLowerCase() ?? "";
      const barcode = item.barcode?.toLowerCase() ?? "";
      return name.includes(q) || sku.includes(q) || hsn.includes(q) || barcode.includes(q);
    });
  }, [items, search, barcodeFilter]);

  const barcodeStats = useMemo(() => {
    const registered = items.filter((i) => isBarcodeRegistered(i.barcode)).length;
    return { registered, notRegistered: items.length - registered, total: items.length };
  }, [items]);

  const closeModal = () => {
    setShowModal(false);
    setModalMode("create");
    setEditingItemId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingItemId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (item: Item) => {
    setModalMode("edit");
    setEditingItemId(item.id);
    setForm({
      name: item.name ?? "",
      sku: item.sku ?? "",
      barcode: item.barcode ?? "",
      unit: item.unit ?? "piece",
      price: String(item.price ?? ""),
      gstRateDefault: String(item.gstRateDefault ?? 0),
      stockQty: String(item.stockQty ?? 0),
      hsnSac: item.hsnSac ?? "",
      imageUrl: item.imageUrl ?? "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setFormError("Please upload JPG, PNG, or WEBP image only.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFormError("Please upload an image smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, imageUrl: String(reader.result || "") }));
      setFormError("");
    };
    reader.onerror = () => {
      setFormError("Failed to read selected image.");
    };
    reader.readAsDataURL(file);
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Scanners in keyboard-wedge mode emit Enter after the barcode value.
    // Intercept it here so the form doesn't submit prematurely.
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Item name is required.");
      return;
    }

    if (!form.unit.trim()) {
      setFormError("Unit is required.");
      return;
    }

    if (form.price === "" || Number.isNaN(parseFloat(form.price))) {
      setFormError("Please enter a valid price.");
      return;
    }

    if (
      form.gstRateDefault === "" ||
      Number.isNaN(parseFloat(form.gstRateDefault))
    ) {
      setFormError("Please enter a valid GST rate.");
      return;
    }

    if (form.stockQty !== "" && Number.isNaN(parseFloat(form.stockQty))) {
      setFormError("Please enter a valid stock quantity.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      unit: form.unit.trim(),
      price: parseNumber(form.price, 0),
      gstRateDefault: parseNumber(form.gstRateDefault, 0),
      stockQty: parseNumber(form.stockQty, 0),
      hsnSac: form.hsnSac.trim() || null,
      imageUrl: form.imageUrl || null,
    };

    try {
      setSavingItem(true);

      if (modalMode === "create") {
        await apiClient.post("/items", payload);
      } else if (editingItemId) {
        await apiClient.put(`/items/${editingItemId}`, payload);
      }

      closeModal();
      await fetchItems();
    } catch (error: any) {
      console.error("Failed to save item", error);
      setFormError(
        error?.response?.data?.error ||
          error?.response?.data?.details ||
          "Failed to save item.",
      );
    } finally {
      setSavingItem(false);
    }
  };

  const handleToggleStatus = async (item: Item) => {
    const nextActive = !item.isActive;
    const confirmed = window.confirm(
      nextActive
        ? `Enable "${item.name}"? It will become available again.`
        : `Disable "${item.name}"? It will be hidden from POS catalog.`,
    );

    if (!confirmed) return;

    try {
      setStatusUpdatingId(item.id);
      await apiClient.patch(`/items/${item.id}/status`, {
        isActive: nextActive,
      });
      await fetchItems();
    } catch (error: any) {
      console.error("Failed to update item status", error);
      alert(error?.response?.data?.error || "Failed to update item status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleCopyBarcode = async (barcode: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopiedBarcode(itemId);
      setTimeout(() => setCopiedBarcode(null), 1500);
    } catch {
      // clipboard API unavailable in some contexts
    }
  };

  const colSpan = 9;

  return (
    <div className="dark-app flex flex-col min-h-screen">
      <Topbar />

      <main className="flex-1 flex flex-col overflow-hidden relative" style={{ minHeight: 0 }}>
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm shrink-0">
          <h2 className="text-2xl font-bold text-slate-800">Item Master</h2>
          <button
            onClick={openCreateModal}
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-md transition-all active:scale-95 flex items-center"
          >
            <span className="mr-2">＋</span>
            Add New Item
          </button>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          {/* Search + barcode filter bar */}
          <div className="mb-5 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search by name, SKU, HSN, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[240px] max-w-md px-4 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm"
            />

            <div className="flex items-center gap-2">
              {(["all", "registered", "not_registered"] as BarcodeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setBarcodeFilter(f)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    barcodeFilter === f
                      ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-300 hover:border-teal-400 hover:text-teal-700"
                  }`}
                >
                  {f === "all"
                    ? `All (${barcodeStats.total})`
                    : f === "registered"
                      ? `Barcode Registered (${barcodeStats.registered})`
                      : `Not Registered (${barcodeStats.notRegistered})`}
                </button>
              ))}
            </div>
          </div>

          {/* Pending barcode notice */}
          {barcodeStats.notRegistered > 0 && barcodeFilter === "all" && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <svg
                className="w-4 h-4 shrink-0 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                <strong>{barcodeStats.notRegistered}</strong>{" "}
                item{barcodeStats.notRegistered !== 1 ? "s" : ""} without a barcode.{" "}
                <button
                  onClick={() => setBarcodeFilter("not_registered")}
                  className="underline font-semibold hover:text-amber-900"
                >
                  View and complete registration
                </button>
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">SKU / HSN</th>
                  <th className="px-6 py-4">Barcode</th>
                  <th className="px-6 py-4 text-center">Barcode Status</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-right">GST %</th>
                  <th className="px-6 py-4 text-right">Stock</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={colSpan} className="text-center p-8 text-slate-500">
                      Loading items...
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <ItemVisual name={item.name} imageUrl={item.imageUrl} />
                          <div>
                            <div className="font-semibold text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Unit: {item.unit}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-700">{item.sku || "-"}</div>
                        <div className="text-xs text-slate-400 mt-0.5">HSN: {item.hsnSac || "-"}</div>
                      </td>

                      <td className="px-6 py-4">
                        {item.barcode ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono text-slate-700 tracking-wide">
                              {item.barcode}
                            </span>
                            <button
                              onClick={() => handleCopyBarcode(item.barcode!, item.id)}
                              title="Copy barcode"
                              className="text-slate-400 hover:text-teal-600 transition-colors"
                            >
                              {copiedBarcode === item.id ? (
                                <svg
                                  className="w-3.5 h-3.5 text-teal-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <BarcodeStatusBadge barcode={item.barcode} />
                      </td>

                      <td className="px-6 py-4 text-right font-bold text-slate-800">
                        ₹ {item.price.toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-right text-slate-600">
                        {item.gstRateDefault}%
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            item.stockQty > 20
                              ? "bg-green-100 text-green-800"
                              : item.stockQty > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.stockQty}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            item.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {item.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleToggleStatus(item)}
                            disabled={statusUpdatingId === item.id}
                            className={`text-sm font-semibold ${
                              item.isActive
                                ? "text-red-600 hover:text-red-800"
                                : "text-emerald-600 hover:text-emerald-800"
                            } disabled:opacity-50`}
                          >
                            {statusUpdatingId === item.id
                              ? "Updating..."
                              : item.isActive
                                ? "Disable"
                                : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading && filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-400">
                      {barcodeFilter === "not_registered"
                        ? "All items have a barcode registered. Great job!"
                        : "No items found. Adjust your search or filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">
                  {modalMode === "create" ? "Create New Item" : "Edit Item"}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-600 text-xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSaveItem}>
                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-lg">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Item Image */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Item Image (Optional)
                      </label>
                      <div className="flex items-start gap-4">
                        <ItemVisual
                          name={form.name || "Item"}
                          imageUrl={form.imageUrl}
                          size="lg"
                        />
                        <div className="flex-1 space-y-3">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleImageChange}
                            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:font-semibold hover:file:bg-teal-100"
                          />
                          <p className="text-xs text-slate-400">
                            Image is optional. If not uploaded, Item Master and POS will show the first letter of the item name.
                          </p>
                          {form.imageUrl && (
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
                              className="text-sm font-semibold text-red-600 hover:text-red-700"
                            >
                              Remove image
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Item Name */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Item Name
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        placeholder="e.g. Apple"
                        required
                      />
                    </div>

                    {/* Barcode */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Barcode
                        <span className="ml-2 text-slate-400 normal-case font-normal">
                          (Optional — scan or type)
                        </span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 7V5a1 1 0 011-1h1M4 17v2a1 1 0 001 1h1M19 5h-1a1 1 0 00-1 1v2M19 19h-1a1 1 0 01-1-1v-2M8 5v14M12 5v14M16 5v14"
                            />
                          </svg>
                        </div>
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={form.barcode}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, barcode: e.target.value }))
                          }
                          onKeyDown={handleBarcodeKeyDown}
                          className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono text-sm"
                          placeholder="Scan or enter barcode"
                          autoComplete="off"
                          spellCheck={false}
                        />
                        {form.barcode && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({ ...prev, barcode: "" }))
                            }
                            className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-red-500"
                            title="Clear barcode"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Click this field and scan with a barcode scanner, or type manually.
                        Each barcode must be unique across all items.
                      </p>
                    </div>

                    {/* SKU + Unit */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        SKU Code
                      </label>
                      <input
                        type="text"
                        value={form.sku}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, sku: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        placeholder="APL-001"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Unit
                      </label>
                      <select
                        value={form.unit}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, unit: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                      >
                        {units.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Price + GST */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.price}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, price: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        placeholder="10.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        GST Rate %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.gstRateDefault}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            gstRateDefault: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        placeholder="e.g. 5 or 12 or 18"
                        required
                      />
                    </div>

                    {/* Opening Stock + HSN */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Opening Stock
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.stockQty}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            stockQty: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        placeholder="100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        HSN / SAC
                      </label>
                      <input
                        type="text"
                        value={form.hsnSac}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            hsnSac: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        placeholder="0808"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingItem}
                    className="px-5 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 shadow-md transition-colors disabled:opacity-50"
                  >
                    {savingItem
                      ? "Saving..."
                      : modalMode === "create"
                        ? "Save Item"
                        : "Update Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
