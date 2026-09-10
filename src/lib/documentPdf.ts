import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

/**
 * Renders a DOM element (the #mockup-document-view invoice/receipt/estimate
 * preview) into a single-page A4 PDF, returned as a File so it can be
 * shared via the Web Share API, attached to an email, or downloaded.
 *
 * Why client-side rendering rather than a server PDF service: the preview
 * already reflects every style choice (template, theme colors, fonts,
 * watermark) live in the DOM - re-implementing that same rendering logic
 * server-side would mean maintaining two versions of every template that
 * could drift out of sync. Snapshotting exactly what's already on screen
 * guarantees the PDF always matches the preview pixel-for-pixel.
 */
export async function renderDocumentToPdf(elementId: string, filename: string): Promise<File> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Could not find #${elementId} to export - try again once the document has finished loading.`);
  }

  const canvas = await html2canvas(element, {
    scale: 2, // sharp enough to print cleanly, not so large it's slow on low-end phones
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  // A4 in points: 595 x 842. Scale the captured canvas to fill the page
  // width and flow additional pages if the content runs long (a receipt
  // with many line items shouldn't just get cut off at one page).
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const blob = pdf.output("blob");
  return new File([blob], filename, { type: "application/pdf" });
}

/**
 * Shares a PDF the honest way, given what's actually possible on each
 * platform - there is no way for any website to make WhatsApp attach a
 * file automatically; that capability simply doesn't exist in WhatsApp's
 * click-to-chat (wa.me) links, on any platform, full stop.
 *
 * - Mobile browsers that support the Web Share API with files (current
 *   Chrome/Android, Safari/iOS): opens the native OS share sheet with the
 *   real PDF attached. The person picks WhatsApp from that sheet and the
 *   actual file goes through - this is the only genuine "share as PDF via
 *   WhatsApp" path that exists on the web.
 * - Everywhere else (desktop browsers, or mobile browsers without file
 *   sharing support): downloads the PDF and opens a WhatsApp text message
 *   explaining the file was downloaded and needs to be attached manually.
 *   This is a real platform limitation, not a shortcut taken here.
 */
export async function sharePdfToWhatsApp(pdfFile: File, whatsappMessage: string): Promise<"shared" | "downloaded"> {
  if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    await navigator.share({
      files: [pdfFile],
      text: whatsappMessage,
    });
    return "shared";
  }

  downloadFile(pdfFile);
  const waLink = `https://wa.me/?text=${encodeURIComponent(
    `${whatsappMessage}\n\n(The PDF has been downloaded to your device - attach it to this chat before sending.)`
  )}`;
  window.open(waLink, "_blank", "noopener,noreferrer");
  return "downloaded";
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
