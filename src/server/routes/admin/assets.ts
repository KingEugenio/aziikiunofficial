import { Router, type Request, type Response } from "express";
import { siteAssetCreateSchema } from "../../validation/admin";
import { env } from "../../env";

export const adminAssetsRouter = Router();

function publicUrlFor(storagePath: string): string {
  return `${env.SUPABASE_URL}/storage/v1/object/public/site-assets/${storagePath}`;
}

function fromRow(row: any) {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.file_name,
    storagePath: row.storage_path,
    url: publicUrlFor(row.storage_path),
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

adminAssetsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data, error } = await supabase.from("site_assets").select("*").order("created_at", { ascending: false });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: (data ?? []).map(fromRow) });
});

// The browser uploads the file bytes directly to Supabase Storage (the
// site-assets bucket's own RLS - see migration 0035 - already restricts
// writes to admins, independent of this route) and only sends us the
// resulting path to record. This endpoint never sees file bytes, so it
// stays a normal express.json() route with no multipart handling needed.
adminAssetsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = siteAssetCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { kind, fileName, storagePath, contentType, sizeBytes } = parsed.data;

  // Only one active logo/favicon at a time - retire whatever was active
  // before inserting the new one. Documents accumulate; there's no
  // "the" document to replace.
  if (kind === "logo" || kind === "favicon") {
    await supabase.from("site_assets").update({ is_active: false }).eq("kind", kind).eq("is_active", true);
  }

  const { data, error } = await supabase
    .from("site_assets")
    .insert({
      kind,
      file_name: fileName,
      storage_path: storagePath,
      content_type: contentType,
      size_bytes: sizeBytes,
      uploaded_by: req.user!.id,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ data: fromRow(data) });
});

adminAssetsRouter.delete("/:id", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data: asset, error: fetchError } = await supabase
    .from("site_assets")
    .select("storage_path")
    .eq("id", req.params.id)
    .maybeSingle();

  if (fetchError) {
    res.status(400).json({ error: fetchError.message });
    return;
  }
  if (!asset) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Best-effort: remove the underlying file, but don't let a storage
  // hiccup block deleting the metadata row - an orphaned file is a much
  // smaller problem than a delete button that silently does nothing.
  await supabase.storage.from("site-assets").remove([asset.storage_path]);

  const { error: deleteError } = await supabase.from("site_assets").delete().eq("id", req.params.id);

  if (deleteError) {
    res.status(400).json({ error: deleteError.message });
    return;
  }

  res.status(204).send();
});
