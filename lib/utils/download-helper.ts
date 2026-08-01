/**
 * MonCabinetCRIC — Module Utilitaire de Téléchargement & Export de Fichiers PDF
 */

export function triggerFileDownload(filename: string, content: string, mimeType = "text/plain") {
  if (typeof window === "undefined") return

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function triggerDocumentPdfDownload(
  filename: string, 
  documentTitle: string, 
  innerHtmlContent: string,
  orientation: "portrait" | "landscape" = "portrait"
) {
  if (typeof window === "undefined") return

  const pageSize = orientation === "landscape" ? "A4 landscape" : "A4 portrait"
  const containerWidthClass = orientation === "landscape" ? "max-w-6xl" : "max-w-4xl"

  const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { size: ${pageSize}; margin: 10mm; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
      background-color: #ffffff !important; 
      color: #0f172a !important; 
      padding: 15px; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e2e8f0; }
    .footer { margin-top: 25px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #64748b; font-family: monospace; }
    @media print {
      @page { size: ${pageSize}; margin: 8mm; }
      body { padding: 0 !important; margin: 0 !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body class="bg-white">
  <div class="printable-document ${containerWidthClass} mx-auto p-2">
    ${innerHtmlContent}
    <div class="footer">
      Document Officiel CICC — MonCabinetCRIC. Horodaté le ${new Date().toLocaleDateString("fr-CA")}. Certifié Conforme Art. 13.
    </div>
  </div>
</body>
</html>`

  // 1. Déclenche le téléchargement du fichier source (.html / format printable PDF)
  triggerFileDownload(filename, fullHtml, "text/html;charset=utf-8")

  // 2. Ouvre l'assistant d'impression système pour sauvegarder en PDF natif
  setTimeout(() => {
    window.print()
  }, 300)
}
