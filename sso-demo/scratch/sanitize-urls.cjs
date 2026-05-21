const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "../src");

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const targetFiles = [];
walkDir(srcDir, filePath => {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    targetFiles.push(filePath);
  }
});

console.log(`Found ${targetFiles.length} TypeScript files to inspect.`);

let modifiedCount = 0;

targetFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Pattern 1: import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
  // Pattern 2: import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  const regex = /import\.meta\.env\.VITE_BACKEND_URL\s*\|\|\s*import\.meta\.env\.VITE_API_BASE_URL\s*\|\|\s*["']http:\/\/localhost:3000["']/g;

  if (regex.test(content)) {
    // Check if it's already wrapped and sanitized
    const lines = content.split("\n");
    const newLines = lines.map(line => {
      if (line.includes("VITE_BACKEND_URL") && line.includes("VITE_API_BASE_URL") && !line.includes(".replace(")) {
        modified = true;
        // Replace with the sanitized version
        return line.replace(regex, '(import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\\/$/, "")');
      }
      return line;
    });
    
    if (modified) {
      content = newLines.join("\n");
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`✓ Sanitized base URL in: ${path.relative(srcDir, filePath)}`);
      modifiedCount++;
    }
  }
});

console.log(`Done. Sanitized ${modifiedCount} files.`);
