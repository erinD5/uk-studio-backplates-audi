import { promises as fs } from "fs";
import path from "path";

export interface ArtDirectionBankImage {
  id: string;
  filename: string;
  title: string;
  url: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;
const BANK_DIR = path.join(process.cwd(), "public", "art-direction-bank");

export async function getArtDirectionBankImages(): Promise<ArtDirectionBankImage[]> {
  try {
    const entries = await fs.readdir(BANK_DIR, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .filter((entry) =>
        IMAGE_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext)),
      )
      .map((entry) => {
        const ext = path.extname(entry.name).toLowerCase();
        const baseName = path.basename(entry.name, ext);
        return {
          id: baseName,
          filename: entry.name,
          title: humanize(baseName),
          url: `/art-direction-bank/${entry.name}`,
          mimeType: extensionToMime(ext),
        };
      })
      .sort((a, b) => a.filename.localeCompare(b.filename));
  } catch {
    return [];
  }
}

function extensionToMime(
  extension: string,
): "image/jpeg" | "image/png" | "image/webp" {
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return "image/jpeg";
}

function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
