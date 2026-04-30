import fs from "fs";
import path from "path";
import crypto from "crypto";

export const processBase64Image = (base64String: string | null | undefined): string | null => {
  if (!base64String) return null;
  
  // If it's already a URL (e.g. from an edit), just return it
  if (base64String.startsWith("http") || base64String.startsWith("/uploads/")) {
    return base64String;
  }

  // Validate Base64 image format
  const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid image format. Expected Base64 string starting with data:image/...");
  }

  const extension = matches[1] === "jpeg" ? "jpg" : matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  // Create /uploads directory if it doesn't exist
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, buffer);

  return `/uploads/${fileName}`;
};
