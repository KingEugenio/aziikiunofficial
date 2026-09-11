import { z } from "zod";
import { uuidField } from "./common";

// Strictly the business representative's full name (first and last) - not
// initials or a single word. Enforced here, not just client-side in
// SignatureCapture.tsx, since a client-only check is trivially bypassable
// by calling the API directly.
const fullNameField = z
  .string()
  .trim()
  .min(1, "A signer name is required")
  .max(200)
  .refine((name) => name.split(/\s+/).filter(Boolean).length >= 2, {
    message: "Enter the business representative's full name (first and last), not just one word.",
  });

export const signatureCreateSchema = z.object({
  businessId: uuidField,
  documentType: z.enum(["invoice", "receipt", "quotation"]),
  documentId: uuidField,
  signerName: fullNameField,
  // "drawn" is accepted for schema stability but SignatureCapture.tsx no
  // longer offers hand-drawing - every new signature is "typed" (the full
  // name itself, rendered in a script font at display time).
  signatureKind: z.enum(["drawn", "typed"]),
  signatureData: z.string().trim().min(1).max(50_000),
});
