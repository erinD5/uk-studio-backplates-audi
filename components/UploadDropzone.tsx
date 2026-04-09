"use client";

import Image from "next/image";
import { useRef, useState } from "react";

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  previewUrl: string | null;
}

export function UploadDropzone({ onFileSelected, previewUrl }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    onFileSelected(file);
  }

  return (
    <div
      className={`border border-dashed p-4 transition-colors ${
        isDragging ? "border-accent bg-black/5" : "border-border bg-surface"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        type="button"
        className="w-full border border-border bg-white px-3 py-2 text-left text-sm font-medium uppercase tracking-[0.06em] text-text transition hover:bg-black hover:text-white"
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl ? "Replace AVP asset" : "Upload AVP asset (drag/drop or click)"}
      </button>

      {previewUrl ? (
        <div className="mt-3 overflow-hidden border border-border">
          <Image
            src={previewUrl}
            alt="AVP preview"
            width={1200}
            height={675}
            unoptimized
            className="h-52 w-full object-cover sm:h-64"
          />
        </div>
      ) : (
        <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-text/60">JPEG or PNG</p>
      )}
    </div>
  );
}
