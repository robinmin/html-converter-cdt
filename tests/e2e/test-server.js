/**
 * Test HTTP server for E2E testing
 *
 * Provides various HTML content and resources for testing conversion scenarios
 */

const { Buffer } = require("node:buffer")
const fs = require("node:fs")
const http = require("node:http")
const path = require("node:path")
const process = require("node:process")
const url = require("node:url")

class TestHTTPServer {
  constructor(port = 3001) {
    this.port = port
    this.server = null
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const parsedUrl = new url.URL(req.url, `http://localhost:${this.port}`)
        const pathname = parsedUrl.pathname

        console.log(`📡 ${req.method} ${pathname}`)

        // Enable CORS for all requests
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if (req.method === "OPTIONS") {
          res.writeHead(200)
          res.end()
          return
        }

        this.handleRequest(req, res, pathname, Object.fromEntries(parsedUrl.searchParams))
      })

      this.server.listen(this.port, () => {
        console.log(`🚀 Test server running on http://localhost:${this.port}`)
        resolve()
      })

      this.server.on("error", reject)
    })
  }

  handleRequest(req, res, pathname, query) {
    try {
      switch (pathname) {
        case "/":
          this.serveIndexPage(res)
          break

        case "/simple":
          this.serveSimplePage(res)
          break

        case "/complex":
          this.serveComplexPage(res)
          break

        case "/images":
          this.servePageWithImages(res)
          break

        case "/styles":
          this.servePageWithStyles(res)
          break

        case "/scripts":
          this.servePageWithScripts(res)
          break

        case "/forms":
          this.servePageWithForms(res)
          break

        case "/tables":
          this.servePageWithTables(res)
          break

        case "/media":
          this.servePageWithMedia(res)
          break

        case "/error":
          this.serveErrorPage(res, query.status || "500")
          break

        case "/slow":
          this.serveSlowPage(res, Number.parseInt(query.delay) || 5000)
          break

        case "/redirect":
          this.serveRedirect(res, query.to || "/")
          break

        case "/test-image.png":
          this.serveTestImage(res)
          break

        case "/test-styles.css":
          this.serveTestStyles(res)
          break

        case "/test-script.js":
          this.serveTestScript(res)
          break

        case "/api/convert":
          this.handleConvertAPI(req, res)
          break

        case "/health":
          this.serveHealthCheck(res)
          break

        default:
          if (pathname.startsWith("/static/")) {
            this.serveStaticFile(res, pathname)
          } else {
            this.serve404(res)
          }
      }
    } catch (error) {
      console.error("❌ Server error:", error)
      this.serveError(res, 500, "Internal Server Error")
    }
  }

  serveIndexPage(res) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Converter Test Suite</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; }
        .test-section { margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .highlight { background-color: #ffffcc; padding: 2px 4px; }
        .code { background-color: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <h1>HTML Converter Test Suite</h1>
        <p>This page provides comprehensive content for testing HTML conversion capabilities.</p>

        <div class="test-section">
            <h2>Basic Content</h2>
            <p>This paragraph contains <strong>bold text</strong>, <em>italic text</em>, and <span class="highlight">highlighted content</span>.</p>
            <p>Here's a link to <a href="https://example.com">Example.com</a> for testing link preservation.</p>
        </div>

        <div class="test-section">
            <h2>Lists and Structure</h2>
            <h3>Unordered List</h3>
            <ul>
                <li>First item</li>
                <li>Second item with <strong>bold</strong> text</li>
                <li>Third item with nested list:
                    <ul>
                        <li>Nested item 1</li>
                        <li>Nested item 2</li>
                    </ul>
                </li>
            </ul>

            <h3>Ordered List</h3>
            <ol>
                <li>First step</li>
                <li>Second step</li>
                <li>Third step</li>
            </ol>
        </div>

        <div class="test-section">
            <h2>Code Examples</h2>
            <p>Inline code: <code>console.log('Hello World')</code></p>
            <pre class="code">
function greet(name) {
    console.log(\`Hello, \${name}!\`);
    return \`Welcome, \${name}\`;
}

const message = greet('Converter');
            </pre>
        </div>

        <div class="test-section">
            <h2>Blockquote</h2>
            <blockquote>
                "The best way to test a converter is with comprehensive content that includes all major HTML elements. This ensures the converter can handle real-world scenarios."
                <footer>- Test Documentation</footer>
            </blockquote>
        </div>

        <div class="test-section">
            <h2>Table</h2>
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr style="background-color: #f0f0f0;">
                        <th>Feature</th>
                        <th>Supported</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>MHTML Export</td>
                        <td>✅ Yes</td>
                        <td>Complete with resources</td>
                    </tr>
                    <tr>
                        <td>PDF Export</td>
                        <td>✅ Yes</td>
                        <td>High quality output</td>
                    </tr>
                    <tr>
                        <td>Image Support</td>
                        <td>✅ Yes</td>
                        <td>PNG, JPEG, WebP</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="test-section">
            <h2>Media Elements</h2>
            <figure>
                <img src="/test-image.png" alt="Test Image" style="max-width: 200px; border: 1px solid #ddd;" />
                <figcaption>Test image for conversion validation</figcaption>
            </figure>
        </div>

        <div class="test-section">
            <h2>Form Elements</h2>
            <form>
                <div style="margin: 10px 0;">
                    <label for="text-input">Text Input:</label>
                    <input type="text" id="text-input" placeholder="Enter text here" style="margin-left: 10px;" />
                </div>
                <div style="margin: 10px 0;">
                    <label for="textarea">Textarea:</label><br />
                    <textarea id="textarea" rows="3" cols="50" placeholder="Enter longer text here"></textarea>
                </div>
                <div style="margin: 10px 0;">
                    <label for="select">Select:</label>
                    <select id="select" style="margin-left: 10px;">
                        <option>Option 1</option>
                        <option>Option 2</option>
                        <option>Option 3</option>
                    </select>
                </div>
                <button type="button" style="padding: 5px 15px; background-color: #007cba; color: white; border: none; border-radius: 3px;">
                    Test Button
                </button>
            </form>
        </div>

        <div class="test-section">
            <h2>Divs and Layout</h2>
            <div style="display: flex; gap: 20px; margin: 10px 0;">
                <div style="flex: 1; padding: 10px; background-color: #e8f4f8; border-radius: 5px;">
                    <h4>Column 1</h4>
                    <p>First column content with some text.</p>
                </div>
                <div style="flex: 1; padding: 10px; background-color: #f8e8e8; border-radius: 5px;">
                    <h4>Column 2</h4>
                    <p>Second column content with different styling.</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Add some dynamic content for testing
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Test page loaded successfully');

            // Add timestamp to show dynamic content
            const timestamp = new Date().toISOString();
            const timeElement = document.createElement('p');
            timeElement.innerHTML = '<small><em>Page loaded at: ' + timestamp + '</em></small>';
            document.querySelector('.container').appendChild(timeElement);
        });
    </script>
</body>
</html>`

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
  }

  serveSimplePage(res) {
    const html = `<!DOCTYPE html>
<html>
<head><title>Simple Page</title></head>
<body><h1>Simple Test</h1><p>Minimal content for basic conversion testing.</p></body>
</html>`
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
  }

  serveComplexPage(res) {
    // For complex page, redirect to main page
    this.serveIndexPage(res)
  }

  servePageWithImages(res) {
    const html = `<!DOCTYPE html>
<html>
<head><title>Page with Images</title></head>
<body>
    <h1>Image Test Page</h1>
    <img src="/test-image.png" alt="Test Image 1" />
    <img src="/test-image.png" alt="Test Image 2" style="width: 100px;" />
</body>
</html>`
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
  }

  servePageWithStyles(res) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Styled Page</title>
    <link rel="stylesheet" href="/test-styles.css" />
</head>
<body>
    <h1 class="styled-title">Styled Content</h1>
    <div class="styled-box">This box has custom styling.</div>
</body>
</html>`
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
  }

  servePageWithScripts(res) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Script Test Page</title>
    <script src="/test-script.js"></script>
</head>
<body>
    <h1>Script Test</h1>
    <div id="dynamic-content">Loading...</div>
    <button onclick="loadContent()">Load Content</button>
</body>
</html>`
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
  }

  servePageWithForms(res) {
    const html = `<!DOCTYPE html>
<html>
<head><title>Form Test Page</title></head>
<body>
    <h1>Form Testing</h1>
    <form>
        <input type="text" name="test" placeholder="Test input" />
        <button type="submit">Submit</button>
    </form>
</body>
</html>`
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
  }

  servePageWithTables(res) {
    const html = `<!DOCTYPE html>
<html>
<head><title>Table Test Page</title></head>
<body>
    <h1>Table Testing</h1>
    <table border="1">
        <tr><th>Header 1</th><th>Header 2</th></tr>
        <tr><td>Cell 1</td><td>Cell 2</td></tr>
    </table>
</body>
</html>`
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
  }

  servePageWithMedia(res) {
    const html = `<!DOCTYPE html>
<html>
<head><title>Media Test Page</title></head>
<body>
    <h1>Media Testing</h1>
    <video controls width="300">
        <source src="test-video.mp4" type="video/mp4">
    </video>
    <audio controls>
        <source src="test-audio.mp3" type="audio/mpeg">
    </audio>
</body>
</html>`
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
  }

  serveErrorPage(res, status = "500") {
    const statusCode = Number.parseInt(status)
    res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" })
    res.end(`Error ${statusCode}: This is a test error page`)
  }

  serveSlowPage(res, delay = 5000) {
    setTimeout(() => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(`<!DOCTYPE html><html><head><title>Slow Page</title></head><body><h1>Slow Loading Page</h1><p>This page took ${delay}ms to load.</p></body></html>`)
    }, delay)
  }

  serveRedirect(res, target) {
    res.writeHead(302, { Location: target })
    res.end()
  }

  serveTestImage(res) {
    // Create a simple PNG image (1x1 pixel transparent PNG)
    const pngData = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==", "base64")
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": pngData.length,
    })
    res.end(pngData)
  }

  serveTestStyles(res) {
    const css = `
.styled-title {
    color: #007cba;
    text-align: center;
    border-bottom: 2px solid #007cba;
    padding-bottom: 10px;
}

.styled-box {
    background-color: #f0f8ff;
    border: 2px solid #007cba;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

body {
    font-family: 'Arial', sans-serif;
    line-height: 1.6;
    margin: 40px;
    background-color: #fafafa;
}
`
    res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" })
    res.end(css)
  }

  serveTestScript(res) {
    const js = `
// Test script for dynamic content loading
console.log('Test script loaded');

function loadContent() {
    const element = document.getElementById('dynamic-content');
    if (element) {
        element.innerHTML = '<p>Content loaded dynamically at ' + new Date().toISOString() + '</p>';
    }
}

// Auto-load content after page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(loadContent, 1000);
});
`
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" })
    res.end(js)
  }

  handleConvertAPI(req, res) {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Method not allowed" }))
      return
    }

    let body = ""
    req.on("data", (chunk) => {
      body += chunk.toString()
    })

    req.on("end", () => {
      try {
        const data = JSON.parse(body)
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({
          success: true,
          message: "Convert API endpoint (mock)",
          received: data,
        }))
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Invalid JSON" }))
      }
    })
  }

  serveHealthCheck(res) {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }))
  }

  serveStaticFile(res, pathname) {
    const filePath = path.join(__dirname, pathname)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath)
      const ext = path.extname(filePath)
      const contentType = this.getContentType(ext)

      res.writeHead(200, { "Content-Type": contentType })
      res.end(content)
    } else {
      this.serve404(res)
    }
  }

  serve404(res) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
    res.end(`<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body>
    <h1>404 - Page Not Found</h1>
    <p>The requested page was not found on this test server.</p>
    <p><a href="/">Return to home</a></p>
</body>
</html>`)
  }

  serveError(res, statusCode, message) {
    res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" })
    res.end(message)
  }

  getContentType(ext) {
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
    }
    return types[ext] || "application/octet-stream"
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log("🛑 Test server stopped")
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new TestHTTPServer()
  server.start().catch(console.error)

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Received SIGINT, shutting down gracefully...")
    server.stop().then(() => {
      process.exit(0)
    })
  })

  process.on("SIGTERM", () => {
    console.log("\n🛑 Received SIGTERM, shutting down gracefully...")
    server.stop().then(() => {
      process.exit(0)
    })
  })
}

module.exports = TestHTTPServer
