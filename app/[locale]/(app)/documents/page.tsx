import { getTranslations } from "next-intl/server"
import { getFolders, getDocuments } from "@/lib/data"
import { DocumentsClient, FolderItem, DocumentItem } from "./documents-client"

export default async function DocumentsPage() {
  const tDocs = await getTranslations("Documents")

  const foldersData = await getFolders()
  const recentFilesData = await getDocuments()

  const formattedFolders: FolderItem[] = [
    { id: "visas", title: tDocs("folders.visas"), files: 12, size: "45.2 MB" },
    { id: "contracts", title: tDocs("folders.contracts"), files: 8, size: "32.1 MB" },
    { id: "identity", title: tDocs("folders.identity"), files: 24, size: "88.4 MB" },
    { id: "forms", title: tDocs("folders.forms"), files: 18, size: "14.6 MB" }
  ]

  return (
    <DocumentsClient 
      t={{}} 
      initialFolders={formattedFolders}
      initialDocuments={recentFilesData}
    />
  )
}
