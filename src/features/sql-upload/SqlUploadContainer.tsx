"use client"

import { useState } from "react"

import { SqlUploadCard, type SelectedSqlFile } from "./SqlUploadCard"

export function SqlUploadContainer() {
  const [file, setFile] = useState<File | null>(null)
  const [resetToken, setResetToken] = useState(0)

  const selectedFile: SelectedSqlFile | null = file
    ? { name: file.name, sizeBytes: file.size }
    : null

  function handleFileChange(nextFile: File) {
    setFile(nextFile)
  }

  function handleClear() {
    setFile(null)
    // Force the file input to remount so re-selecting the same file fires onChange again.
    setResetToken((token) => token + 1)
  }

  function handleAnalyze() {
    // FD detection pipeline is not implemented yet; this screen only collects the file.
  }

  return (
    <SqlUploadCard
      selectedFile={selectedFile}
      resetToken={resetToken}
      onFileChange={handleFileChange}
      onClear={handleClear}
      onAnalyze={handleAnalyze}
    />
  )
}
