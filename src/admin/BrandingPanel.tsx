import React, { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Browser as FaviconIcon, FileArrowUp, Trash as Trash2, UploadSimple } from "@phosphor-icons/react";
import { supabase } from "../lib/supabaseClient";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminBranding } from "../components/Skeleton";

interface AssetRow {
  id: string;
  kind: "logo" | "favicon" | "document";
  fileName: string;
  url: string;
  sizeBytes: number;
  isActive: boolean;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** One upload slot (logo or favicon): shows the current active file (if
 * any) and a picker to replace it. Uploads go straight to Supabase Storage
 * from the browser (site-assets bucket RLS - migration 0035 - already
 * restricts writes to admins), then POST /api/admin/assets just records
 * the resulting path. */
function SingleAssetSlot({
  kind,
  label,
  hint,
  icon: Icon,
  current,
  onChanged,
}: {
  kind: "logo" | "favicon";
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  current: AssetRow | undefined;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      const path = `${kind}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("site-assets").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (uploadError) throw uploadError;

      await api.admin.assets.create({
        kind,
        fileName: file.name,
        storagePath: path,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't upload that ${label.toLowerCase()}.`);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-800">{label}</h3>
          <p className="text-[10px] text-slate-400">{hint}</p>
        </div>
      </div>

      {current ? (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-2.5">
          <img src={current.url} alt={label} className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-700 truncate">{current.fileName}</p>
            <p className="text-[9px] text-slate-400 font-mono">{formatSize(current.sizeBytes)}</p>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">No {label.toLowerCase()} uploaded yet - using the built-in default.</p>
      )}

      {error && <p className="text-[10px] text-rose-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="w-full bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <UploadSimple className="w-3.5 h-3.5" /> {isUploading ? "Uploading..." : current ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      </button>
    </div>
  );
}

export default function BrandingPanel() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.admin.assets
      .list()
      .then(setAssets)
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const activeLogo = assets.find((a) => a.kind === "logo" && a.isActive);
  const activeFavicon = assets.find((a) => a.kind === "favicon" && a.isActive);
  const documents = assets.filter((a) => a.kind === "document");

  const handleDocFile = async (file: File) => {
    setDocError(null);
    setIsUploadingDoc(true);
    try {
      const path = `document/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("site-assets").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (uploadError) throw uploadError;

      await api.admin.assets.create({
        kind: "document",
        fileName: file.name,
        storagePath: path,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      load();
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setIsUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await api.admin.assets.remove(id);
    load();
  };

  return (
    <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminBranding />}>
    <div className="space-y-6">
      <p className="text-xs text-slate-500 leading-relaxed">
        The logo and favicon here replace Aziiki's built-in defaults everywhere they're shown to visitors and signed-in users.
        Documents are just a shared file store for the team - contracts, policy PDFs, anything you want on hand.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SingleAssetSlot kind="logo" label="Logo" hint="Shown across the app" icon={ImageIcon} current={activeLogo} onChanged={load} />
        <SingleAssetSlot kind="favicon" label="Favicon" hint="Browser tab icon" icon={FaviconIcon} current={activeFavicon} onChanged={load} />
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <FileArrowUp className="w-3.5 h-3.5" /> Documents
        </h3>

        {documents.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-[11px]">
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-slate-700 font-bold hover:underline truncate">
                  {doc.fileName}
                </a>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-[9px] text-slate-400 font-mono">{formatSize(doc.sizeBytes)}</span>
                  <button onClick={() => handleDelete(doc.id)} aria-label={`Delete ${doc.fileName}`} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {docError && <p className="text-[10px] text-rose-600">{docError}</p>}

        <input ref={docInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocFile(f); }} />
        <button
          type="button"
          onClick={() => docInputRef.current?.click()}
          disabled={isUploadingDoc}
          className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer disabled:opacity-50 flex items-center gap-1"
        >
          <UploadSimple className="w-3 h-3" /> {isUploadingDoc ? "Uploading..." : "Upload a document"}
        </button>
      </div>
    </div>
    </LoadingSwap>
  );
}
