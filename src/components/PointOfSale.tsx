import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass as Search, Camera, X as CloseIcon, Plus, Minus, Trash as Trash2, ShoppingCart, CheckCircle } from "@phosphor-icons/react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { api } from "../lib/api";
import type { InventoryItem } from "../types";

interface CartLine {
  item: InventoryItem;
  quantity: number;
}

interface PointOfSaleProps {
  businessId: string;
  currencySymbol: string;
  inventory: InventoryItem[];
  /** Optimistic local stock update after a completed sale - App.tsx owns the inventory array. */
  onSaleComplete: (sold: Array<{ id: string; quantitySold: number }>) => void;
}

/**
 * A fast, itemized checkout for a shop selling physical stock over a
 * counter: scan or type a SKU/barcode, build a running cart from real
 * inventory rows, complete the sale. Price and description always come
 * from the inventory row itself - see receipts.ts's pos-sale handler,
 * which re-looks these up server-side rather than trusting anything here.
 * A USB/Bluetooth barcode scanner needs no special code at all - it just
 * types into the focused SKU field and sends Enter, exactly like a
 * keyboard. The camera button is for a phone/tablet with no such scanner.
 */
export default function PointOfSale({ businessId, currencySymbol, inventory, onSaleComplete }: PointOfSaleProps) {
  const [skuInput, setSkuInput] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customClientName, setCustomClientName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Mobile Money" | "Bank Transfer">("Cash");
  const [notFound, setNotFound] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<{ receiptNumber: string; amountPaid: number } | null>(null);

  const skuFieldRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    skuFieldRef.current?.focus();
  }, []);

  const addBySku = (rawSku: string) => {
    const sku = rawSku.trim();
    if (!sku) return;
    const match = inventory.find((i) => i.sku && i.sku.toLowerCase() === sku.toLowerCase());
    if (!match) {
      setNotFound(sku);
      return;
    }
    setNotFound(null);
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === match.id);
      if (existing) return prev.map((line) => (line.item.id === match.id ? { ...line, quantity: line.quantity + 1 } : line));
      return [...prev, { item: match, quantity: 1 }];
    });
  };

  const handleSkuSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addBySku(skuInput);
    setSkuInput("");
    skuFieldRef.current?.focus();
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => (line.item.id === itemId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );
  };

  const removeLine = (itemId: string) => setCart((prev) => prev.filter((line) => line.item.id !== itemId));

  const total = cart.reduce((sum, line) => sum + line.quantity * line.item.unitPrice, 0);

  const stopScanning = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScanning(false);
  };

  const startScanning = async () => {
    setCameraError(null);
    setScanning(true);
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result) => {
          if (result) addBySku(result.getText());
        }
      );
      scannerControlsRef.current = controls;
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Couldn't access the camera. Check permissions and try again.");
      setScanning(false);
    }
  };

  useEffect(() => () => scannerControlsRef.current?.stop(), []);

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.receipts.posSale({
        businessId,
        customClientName: customClientName.trim() || undefined,
        date: new Date().toISOString().slice(0, 10),
        paymentMethod,
        items: cart.map((line) => ({ inventoryId: line.item.id, quantity: line.quantity })),
      });
      onSaleComplete(cart.map((line) => ({ id: line.item.id, quantitySold: line.quantity })));
      setCompletedReceipt({ receiptNumber: result.receiptNumber, amountPaid: Number(result.amountPaid) });
      setCart([]);
      setCustomClientName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't complete the sale. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (completedReceipt) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 max-w-md mx-auto">
        <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
        <h3 className="text-lg font-black text-slate-900">Sale complete</h3>
        <p className="text-sm text-slate-500">
          Receipt {completedReceipt.receiptNumber} - {currencySymbol}
          {completedReceipt.amountPaid.toFixed(2)}
        </p>
        <button
          type="button"
          onClick={() => setCompletedReceipt(null)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl cursor-pointer"
        >
          Start next sale
        </button>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[1fr_360px] gap-5">
      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
        <form onSubmit={handleSkuSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={skuFieldRef}
              type="text"
              autoFocus
              placeholder="Scan or type a SKU, then Enter"
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 outline-none text-sm focus:border-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={() => (scanning ? stopScanning() : startScanning())}
            className={`shrink-0 p-2.5 rounded-xl cursor-pointer border ${
              scanning ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
            aria-label={scanning ? "Stop camera scan" : "Scan with camera"}
          >
            {scanning ? <CloseIcon className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          </button>
        </form>
        {notFound && <p className="text-xs text-rose-600">No item with SKU "{notFound}" in this business's inventory.</p>}

        {scanning && (
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black relative">
            <video ref={videoRef} className="w-full max-h-72 object-cover" muted playsInline />
            {cameraError && <p className="absolute inset-0 flex items-center justify-center text-xs text-white bg-black/80 p-4 text-center">{cameraError}</p>}
          </div>
        )}

        <div className="space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Scan or search an item to start a sale.</p>
            </div>
          ) : (
            cart.map((line) => (
              <div key={line.item.id} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{line.item.name}</p>
                  <p className="text-[10px] font-mono text-slate-400">SKU: {line.item.sku}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => adjustQuantity(line.item.id, -1)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                  <button type="button" onClick={() => adjustQuantity(line.item.id, 1)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-bold shrink-0">
                  {currencySymbol}
                  {(line.quantity * line.item.unitPrice).toFixed(2)}
                </p>
                <button type="button" onClick={() => removeLine(line.item.id)} aria-label="Remove" className="text-slate-300 hover:text-rose-600 cursor-pointer shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 h-fit">
        <h3 className="text-xs font-bold text-slate-800">Checkout</h3>
        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Customer (optional)</label>
          <input
            type="text"
            placeholder="Walk-in customer"
            value={customClientName}
            onChange={(e) => setCustomClientName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-sm focus:border-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Payment method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-sm focus:border-emerald-500"
          >
            <option value="Cash">Cash</option>
            <option value="Mobile Money">Mobile Money</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        </div>
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-500">Total</span>
          <span className="text-xl font-black text-slate-900">
            {currencySymbol}
            {total.toFixed(2)}
          </span>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button
          type="button"
          onClick={handleCompleteSale}
          disabled={cart.length === 0 || submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-3 rounded-xl cursor-pointer disabled:opacity-50"
        >
          {submitting ? "Completing sale..." : "Complete sale"}
        </button>
      </div>
    </div>
  );
}
