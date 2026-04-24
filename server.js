const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const rootDir = __dirname;
const defaultFiles = ["index.html", "index.htm"];
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function safePathFromUrl(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const normalized = path.normalize(pathname.replace(/^\/+/, ""));
  return normalized;
}

function resolveRequestPath(url) {
  const requestPath = safePathFromUrl(url);
  const absolutePath = path.resolve(rootDir, requestPath);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

function sendFile(filePath, response) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || "application/octet-stream";

  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": contentType
  });

  fs.createReadStream(filePath).pipe(response);
}

function sendNotFound(response) {
  response.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end("Not found");
}

function findExistingIndex(basePath) {
  for (const fileName of defaultFiles) {
    const candidate = path.join(basePath, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function openBrowser(url) {
  if (process.env.NO_OPEN_BROWSER === "1" || process.env.CI) {
    return;
  }

  const escapedUrl = url.replace(/&/g, "^&");
  exec(`cmd /c start "" "${escapedUrl}"`);
}

const server = http.createServer((request, response) => {
  const resolvedPath = resolveRequestPath(request.url || "/");

  if (!resolvedPath) {
    response.writeHead(403, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Forbidden");
    return;
  }

  fs.stat(resolvedPath, (statError, stats) => {
    if (!statError && stats.isDirectory()) {
      const indexPath = findExistingIndex(resolvedPath);
      if (!indexPath) {
        sendNotFound(response);
        return;
      }

      sendFile(indexPath, response);
      return;
    }

    if (!statError && stats.isFile()) {
      sendFile(resolvedPath, response);
      return;
    }

    const fallbackPath = findExistingIndex(rootDir);
    const isAssetRequest = path.extname(resolvedPath) !== "";

    if (isAssetRequest || !fallbackPath) {
      sendNotFound(response);
      return;
    }

    sendFile(fallbackPath, response);
  });
});

function start(options = {}) {
  const { open = false } = options;

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Local site is running at ${url}`);

    if (open) {
      openBrowser(url);
    }
  });

  return server;
}

if (require.main === module) {
  start({ open: true });
}

module.exports = { server, start };
