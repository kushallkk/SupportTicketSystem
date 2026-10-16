"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTRIBUTE, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, formatBytes, quickCheck } from "@/lib/attachment-rules";

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Controlled file chooser with drag-and-drop. Checks name/size/type up front for instant feedback;
 * the server re-checks the real file content and is the authority.
 */
export function FilePicker({
  files,
  onChange,
  disabled,
  variant = "dropzone",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  variant?: "dropzone" | "compact";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function add(incoming: File[]) {
    const next = [...files];
    for (const file of incoming) {
      const check = quickCheck(file.name, file.size);
      if (!check.ok) {
        toast.error(check.error);
        continue;
      }
      if (next.some((f) => sameFile(f, file))) continue;
      if (next.length >= MAX_FILES_PER_UPLOAD) {
        toast.error(`You can attach at most ${MAX_FILES_PER_UPLOAD} files at a time.`);
        break;
      }
      next.push(file);
    }
    onChange(next);
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT_ATTRIBUTE}
      aria-label="Attach files"
      className="sr-only"
      disabled={disabled}
      onChange={(e) => {
        add(Array.from(e.target.files ?? []));
        e.target.value = ""; // allow picking the same file again after removing it
      }}
    />
  );

  const chips = files.length > 0 && (
    <ul className="flex flex-wrap gap-2" aria-label="Files to upload">
      {files.map((file) => (
        <li
          key={`${file.name}-${file.size}-${file.lastModified}`}
          className="flex max-w-full items-center gap-1.5 rounded-full border bg-muted/50 py-1 pr-1 pl-2.5 text-xs"
        >
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => onChange(files.filter((f) => f !== file))}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );

  if (variant === "compact") {
    return (
      <div className="space-y-2">
        {input}
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Paperclip className="size-3.5" />
          Attach
        </Button>
        {chips}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {input}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center text-sm transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border",
          disabled && "opacity-60"
        )}
      >
        <UploadCloud className="size-5 text-muted-foreground" />
        <p>
          Drop files here or{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          Images, PDF, TXT, LOG or CSV · up to {MAX_FILE_BYTES / (1024 * 1024)} MB each · max {MAX_FILES_PER_UPLOAD} files
        </p>
      </div>
      {chips}
    </div>
  );
}
