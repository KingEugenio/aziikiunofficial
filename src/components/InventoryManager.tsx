import React, { useState } from "react";
import { Plus, Trash as Trash2, Warning as AlertTriangle, Package, Phone, User, Tag, Warehouse, CheckCircle, Truck, FileCsv as FileSpreadsheet, X } from "@phosphor-icons/react";
import { InventoryItem, Business } from "../types";
import ConfirmModal from "./ConfirmModal";

interface InventoryManagerProps {
  currentBusiness: Business;
  inventory: InventoryItem[];
  currencySymbol: string;
  onAddInventoryItem: (item: InventoryItem) => Promise<InventoryItem>;
  onUpdateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<InventoryItem>;
  onDeleteInventoryItem: (id: string) => Promise<void>;
  onStockAdjustment: (id: string, delta: number) => void;
}

export default function InventoryManager({
  currentBusiness,
  inventory,
  currencySymbol,
  onAddInventoryItem,
  onUpdateInventoryItem,
  onDeleteInventoryItem,
  onStockAdjustment
}: InventoryManagerProps) {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Bulk CSV States
  const [showBulkImport, setShowBulkImport] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [notif, setNotif] = useState<string | null>(null);

  // Form values
  const [name, setName] = useState<string>("");
  const [sku, setSku] = useState<string>(`SKU-${Math.floor(Math.random() * 90005) + 10000}`);
  const [quantity, setQuantity] = useState<number>(35);
  const [minStockAlert, setMinStockAlert] = useState<number>(10);
  const [unitCost, setUnitCost] = useState<number>(20);
  const [unitPrice, setUnitPrice] = useState<number>(35);
  const [supplierName, setSupplierName] = useState<string>("");
  const [supplierContact, setSupplierContact] = useState<string>("");

  const handleParseInventoryCSV = (rawText: string) => {
    try {
      const lines = rawText.split("\n");
      if (lines.length < 2) {
        setCsvError("Error: CSV must contain a header and at least one stock row!");
        return;
      }
      
      let importedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"(.*)"$/, '$1').trim());
        if (cols.length < 1 || !cols[0]) continue;

        const importedName = cols[0];
        const importedSku = cols[1] || `SKU-B-${Math.floor(Math.random() * 90000) + 10000}`;
        const importedQty = Number(cols[2]) || 0;
        const importedMin = Number(cols[3]) || 5;
        const importedCost = Number(cols[4]) || 0;
        const importedPrice = Number(cols[5]) || 0;
        const importedSupplier = cols[6] || "Direct Wholesale";
        const importedContact = cols[7] || "+233...";

        onAddInventoryItem({
          id: "item-csv-" + Math.random().toString(36).substr(2, 9),
          name: importedName,
          sku: importedSku,
          quantity: importedQty,
          minStockAlert: importedMin,
          unitCost: importedCost,
          unitPrice: importedPrice,
          supplierName: importedSupplier,
          supplierContact: importedContact,
          businessId: currentBusiness.id
        }).catch((err) => {
          console.error(`Failed to import row for ${importedName}:`, err);
          setCsvError(`Some items failed to save (e.g. "${importedName}") - check your connection and try again.`);
        });
        importedCount++;
      }

      setCsvError(null);
      setNotif(`Successfully imported ${importedCount} stock items to Warehouse!`);
      setShowBulkImport(false);
      setTimeout(() => setNotif(null), 4000);
    } catch (err: any) {
      setCsvError(`CSV Import Error: ${err.message}`);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleParseInventoryCSV(text);
      };
      reader.readAsText(file);
    } else {
      setCsvError("Error: Drop file must be a valid .csv format!");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const resetForm = () => {
    setName("");
    setSku(`SKU-${Math.floor(Math.random() * 90000) + 10000}`);
    setQuantity(35);
    setMinStockAlert(10);
    setUnitCost(20);
    setUnitPrice(35);
    setSupplierName("");
    setSupplierContact("");
    setIsAdding(false);
    setEditingItemId(null);
    setSaveError(null);
  };

  const openEditForm = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setName(item.name);
    setSku(item.sku);
    setQuantity(item.quantity);
    setMinStockAlert(item.minStockAlert);
    setUnitCost(item.unitCost);
    setUnitPrice(item.unitPrice);
    setSupplierName(item.supplierName === "Direct Wholesale" ? "" : item.supplierName);
    setSupplierContact(item.supplierContact === "+233 24..." ? "" : item.supplierContact);
    setSaveError(null);
    setIsAdding(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      if (editingItemId) {
        const updated = await onUpdateInventoryItem(editingItemId, {
          name,
          sku,
          quantity,
          minStockAlert,
          unitCost,
          unitPrice,
          supplierName: supplierName || "Direct Wholesale",
          supplierContact: supplierContact || "+233 24...",
        });
        setNotif(`${updated.name} updated successfully.`);
      } else {
        // Awaited on purpose - same reasoning as CustomerCRM.tsx's save
        // flow: only clear the form and show "saved" once the server has
        // actually confirmed the item exists, so what the person sees
        // saved is guaranteed to be what's now in the list below.
        const created = await onAddInventoryItem({
          id: "item-" + Math.random().toString(36).substr(2, 9),
          name,
          sku,
          quantity,
          minStockAlert,
          unitCost,
          unitPrice,
          supplierName: supplierName || "Direct Wholesale",
          supplierContact: supplierContact || "+233 24...",
          businessId: currentBusiness.id
        });
        setNotif(`${created.name} added to stock successfully.`);
      }
      resetForm();
      setTimeout(() => setNotif(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save this item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const [pendingDeleteItem, setPendingDeleteItem] = useState<InventoryItem | null>(null);

  const handleDeleteItem = async (item: InventoryItem) => {
    setPendingDeleteItem(null);
    setDeletingId(item.id);
    try {
      await onDeleteInventoryItem(item.id);
      setNotif(`${item.name} was removed from stock.`);
      setTimeout(() => setNotif(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't delete this item. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const businessInventory = inventory.filter(p => p.businessId === currentBusiness.id);
  const lowStockItems = businessInventory.filter(p => p.quantity <= p.minStockAlert);

  return (
    <div id="inventory-manager-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-800 dark:text-slate-200">
      {/* Configure items left bar */}
      <div className="lg:col-span-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-4 shadow-sm shadow-emerald-500/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Stock Operations
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">
              Material controls for {currentBusiness.name}.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              id="toggle-add-stock-btn"
              onClick={() => {
                if (isAdding) {
                  resetForm();
                } else {
                  setEditingItemId(null);
                  setIsAdding(true);
                }
                setShowBulkImport(false);
              }}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:dark:text-emerald-400 font-sans flex items-center gap-1 cursor-pointer bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:dark:border-slate-600 px-2 py-1 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Acquire
            </button>
            <button
              onClick={() => {
                setShowBulkImport(!showBulkImport);
                setIsAdding(false);
              }}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:dark:text-indigo-400 font-sans flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-700 hover:border-indigo-300 hover:dark:border-indigo-600 px-2 py-1 rounded-xl"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Bulk CSV
            </button>
          </div>
        </div>

        {/* Action success notifications */}
        {notif && (
          <div className="bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-[11px] p-2.5 rounded-xl font-sans flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" /> {notif}
          </div>
        )}

        {/* Bulk Stock Importer */}
        {showBulkImport && (
          <div className="bg-indigo-50/40 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-700 rounded-xl p-4 space-y-4 text-xs animate-fade-in leading-relaxed">
            <div className="flex justify-between items-center border-b border-indigo-200/30 dark:border-indigo-700/30 pb-2">
              <h4 className="font-bold text-indigo-950 dark:text-indigo-300 font-sans flex items-center gap-1">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Bulk Import Warehouse Stock CSV
              </h4>
              <button
                onClick={() => setShowBulkImport(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-700 hover:dark:text-slate-300"
              >
                <X className="w-3.5 h-3.5" weight="bold" />
              </button>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight font-sans">
              Expected CSV columns or comma-separated format:<br/>
              <code className="bg-white/80 dark:bg-slate-800/80 px-1 border rounded text-[9.5px] font-mono block mt-1 overflow-x-auto whitespace-nowrap">
                name, sku, quantity, minStockAlert, unitCost, unitPrice, supplierName, supplierContact
              </code>
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragOver 
                  ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/50" 
                  : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400 hover:dark:border-slate-500"
              }`}
            >
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Drag and drop your stock_items.csv here
              </p>
              <p className="text-[9px] text-slate-400 mt-1 font-sans">
                Or click browse to pick a local .csv spreadsheet
              </p>
              
              <label className="mt-3 inline-block bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1 font-sans text-[10px] font-bold cursor-pointer">
                Browse File
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        handleParseInventoryCSV(text);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {csvError && (
              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold font-mono bg-rose-50 dark:bg-rose-900/40 p-2 rounded-lg border border-rose-100 dark:border-rose-700">
                {csvError}
              </p>
            )}
          </div>
        )}

        {/* Low Stock Warning Banner */}
        {lowStockItems.length > 0 && (
          <div className="bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-700 text-rose-800 dark:text-rose-300 p-4 rounded-xl text-xs space-y-1.5 animate-fade-in font-sans">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>Low Stock Trigger Alert!</span>
            </div>
            <p className="text-rose-700/90 dark:text-rose-400/90 leading-relaxed font-sans">
              There are {lowStockItems.length} products with stock below threshold levels. Procure fresh materials to meet client targets.
            </p>
          </div>
        )}

        {/* Add physical item form */}
        {isAdding && (
          <form onSubmit={handleSaveItem} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 text-xs leading-relaxed">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 font-sans">{editingItemId ? "Edit Product Asset" : "Add Product Asset"}</h4>

            {saveError && (
              <div className="bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-400 text-[11px] font-semibold rounded-lg p-2.5 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}
            <div>
              <label className="text-[9px] font-mono font-bold text-slate-400">Product Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 mt-1 outline-none font-sans"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-400">SKU Reference</label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 border border-slate-200 dark:border-slate-700 mt-1 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-400">Current Qty</label>
                <input
                  type="number"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 border border-slate-200 dark:border-slate-700 mt-1 outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">Min Alert</label>
                <input
                  type="number"
                  required
                  value={minStockAlert}
                  onChange={(e) => setMinStockAlert(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700 mt-1 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">Unit Cost</label>
                 <input
                  type="number"
                  required
                  value={unitCost}
                  onChange={(e) => setUnitCost(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700 mt-1 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">Unit Price</label>
                 <input
                  type="number"
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700 mt-1 outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-400">Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alaba Import Ltd"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 border border-slate-200 dark:border-slate-700 mt-1 outline-none font-sans"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-400">Supplier Phone</label>
                <input
                  type="text"
                  placeholder="+234 81..."
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 border border-slate-200 dark:border-slate-700 mt-1 outline-none font-sans"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-lg text-white font-semibold font-sans uppercase tracking-wider text-[10px] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {isSaving ? "Saving..." : editingItemId ? "Save Changes" : "Acquire Product"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 hover:dark:bg-slate-800 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 font-semibold font-sans uppercase tracking-wider text-[10px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
          Integrated inventory tracking calculates cost of goods sold (COGS) dynamically. Low-stock limits trigger real-time highlights to coordinate replenishment.
        </p>
      </div>

      {/* Main Stock Table */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm shadow-emerald-500/5">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 font-sans flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
          <Warehouse className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Warehouse Registry catalog
        </h4>

        {/* Catalog list layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {businessInventory.map((item) => {
            const isLowStock = item.quantity <= item.minStockAlert;

            return (
              <div 
                key={item.id} 
                className={`border rounded-xl p-4 flex flex-col justify-between font-sans text-xs relative overflow-hidden transition-all ${
                  isLowStock 
                    ? "border-rose-300 dark:border-rose-600 bg-rose-50/40 dark:bg-rose-900/40" 
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 hover:dark:border-slate-600 shadow-sm shadow-emerald-500/5"
                }`}
              >
                {/* Indicators bar */}
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-slate-400 tracking-wider">SKU: {item.sku}</span>
                  {isLowStock ? (
                    <span className="text-[9px] font-mono text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-700">LOW STOCK</span>
                  ) : (
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-700">ACTIVE STOCK</span>
                  )}
                </div>

                <div className="mt-3.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans">{item.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-sans">
                    <Truck className="w-3.5 h-3.5 text-slate-400" /> Supplier: {item.supplierName} ({item.supplierContact})
                  </p>
                </div>

                {/* Stock adjustments dials */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 uppercase block">Active Units</span>
                    <strong className={`font-mono text-sm block mt-0.5 ${isLowStock ? "text-rose-600 dark:text-rose-400 font-black" : "text-slate-800 dark:text-slate-200 font-extrabold"}`}>
                      {item.quantity} items
                    </strong>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono">
                    <button
                      onClick={() => onStockAdjustment(item.id, -1)}
                      disabled={item.quantity <= 0}
                      className="w-7 h-7 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 hover:dark:bg-slate-800 disabled:opacity-45 text-slate-700 dark:text-slate-300 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer text-xs"
                    >
                      -
                    </button>
                    <button
                      onClick={() => onStockAdjustment(item.id, 5)}
                      className="w-7 h-7 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 hover:dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer text-xs"
                    >
                      +5
                    </button>
                    
                    <button
                      onClick={() => openEditForm(item)}
                      className="px-2 h-7 bg-white dark:bg-slate-800 hover:bg-slate-100 hover:dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center cursor-pointer transition-colors text-[10px] font-bold"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => setPendingDeleteItem(item)}
                      disabled={deletingId === item.id}
                      className="w-7 h-7 bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-700 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-rose-100 hover:dark:bg-rose-900/40 disabled:opacity-50 disabled:cursor-wait"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {businessInventory.length === 0 && (
            <div className="col-span-2 text-center py-16 text-slate-400 italic text-xs font-sans">
              No products mapped under this business. Click "Acquire Material" above to populate catalog.
            </div>
          )}
        </div>
      </div>

      {pendingDeleteItem && (
        <ConfirmModal
          title="Remove this item from stock?"
          message={`Delete ${pendingDeleteItem.name} from stock? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteItem(pendingDeleteItem)}
          onCancel={() => setPendingDeleteItem(null)}
        />
      )}
    </div>
  );
}
