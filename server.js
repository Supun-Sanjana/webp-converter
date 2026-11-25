const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup in-memory cache for converted files with TTL (30 minutes)
const convertedFiles = new Map();
const FILE_TTL_MS = 30 * 60 * 1000;

function cleanOldFiles() {
  const now = Date.now();
  for (const [id, item] of convertedFiles.entries()) {
    if (now - item.timestamp > FILE_TTL_MS) {
      convertedFiles.delete(id);
    }
  }
}
setInterval(cleanOldFiles, 5 * 60 * 1000);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer memory storage (up to 50MB per file, max 50 files)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 50
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.originalname}. Only JPG and PNG are supported.`));
    }
  }
});

// Helper to convert an image buffer using Sharp
async function convertToWebP(buffer, options = {}) {
  const quality = Math.min(100, Math.max(1, parseInt(options.quality, 10) || 80));
  const lossless = options.lossless === 'true' || options.lossless === true;
  const effort = Math.min(6, Math.max(0, parseInt(options.effort, 10) || 4));
  const maxWidth = options.maxWidth ? parseInt(options.maxWidth, 10) : null;
  const maxHeight = options.maxHeight ? parseInt(options.maxHeight, 10) : null;

  let image = sharp(buffer);
  const metadata = await image.metadata();

  // Resize if requested and valid
  if ((maxWidth && maxWidth > 0) || (maxHeight && maxHeight > 0)) {
    image = image.resize({
      width: maxWidth && maxWidth > 0 ? maxWidth : undefined,
      height: maxHeight && maxHeight > 0 ? maxHeight : undefined,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  // Convert to WebP
  image = image.webp({
    quality,
    lossless,
    effort
  });

  const convertedBuffer = await image.toBuffer();
  const convertedMetadata = await sharp(convertedBuffer).metadata();

  return {
    buffer: convertedBuffer,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    originalFormat: metadata.format,
    newWidth: convertedMetadata.width,
    newHeight: convertedMetadata.height,
    newSize: convertedBuffer.length
  };
}

// API: Convert multiple or single files
app.post('/api/convert', upload.array('images', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No image files uploaded.' });
    }

    const { quality, lossless, effort, maxWidth, maxHeight } = req.body;
    const results = [];

    for (const file of req.files) {
      try {
        const conversionResult = await convertToWebP(file.buffer, {
          quality,
          lossless,
          effort,
          maxWidth,
          maxHeight
        });

        const id = crypto.randomUUID();
        const baseName = path.parse(file.originalname).name;
        const webpFilename = `${baseName}.webp`;

        // Store converted buffer in memory cache
        convertedFiles.set(id, {
          filename: webpFilename,
          buffer: conversionResult.buffer,
          originalName: file.originalname,
          originalSize: file.size,
          size: conversionResult.newSize,
          timestamp: Date.now()
        });

        // Compute reduction percentage
        const savedBytes = file.size - conversionResult.newSize;
        const reductionPercent = Math.round((savedBytes / file.size) * 100);

        results.push({
          id,
          success: true,
          originalName: file.originalname,
          originalSize: file.size,
          originalDimensions: `${conversionResult.originalWidth}x${conversionResult.originalHeight}`,
          convertedName: webpFilename,
          convertedSize: conversionResult.newSize,
          convertedDimensions: `${conversionResult.newWidth}x${conversionResult.newHeight}`,
          reductionPercent,
          downloadUrl: `/api/download/${id}`,
          previewUrl: `/api/preview/${id}`
        });
      } catch (fileErr) {
        console.error(`Error converting ${file.originalname}:`, fileErr);
        results.push({
          success: false,
          originalName: file.originalname,
          originalSize: file.size,
          error: fileErr.message || 'Conversion failed'
        });
      }
    }

    res.json({
      success: true,
      count: results.length,
      files: results
    });
  } catch (err) {
    console.error('Batch convert error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to process images.' });
  }
});

// API: Download single converted WebP
app.get('/api/download/:id', (req, res) => {
  const file = convertedFiles.get(req.params.id);
  if (!file) {
    return res.status(404).send('File not found or expired.');
  }

  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
  res.setHeader('Content-Length', file.buffer.length);
  res.send(file.buffer);
});

// API: Preview converted WebP directly in browser
app.get('/api/preview/:id', (req, res) => {
  const file = convertedFiles.get(req.params.id);
  if (!file) {
    return res.status(404).send('File not found or expired.');
  }

  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(file.buffer);
});

// API: Direct single file conversion and instant download (useful for cURL/simple POST)
app.post('/api/convert-direct', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No image uploaded.');
    }

    const { quality, lossless, effort, maxWidth, maxHeight } = req.body;
    const result = await convertToWebP(req.file.buffer, {
      quality,
      lossless,
      effort,
      maxWidth,
      maxHeight
    });

    const baseName = path.parse(req.file.originalname).name;
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(baseName)}.webp"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.send(result.buffer);
  } catch (err) {
    console.error('Direct conversion error:', err);
    res.status(500).send('Conversion failed: ' + err.message);
  }
});

// API: Download multiple files as ZIP archive
app.post('/api/download-zip', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No file IDs provided.' });
    }

    const filesToZip = [];
    for (const id of ids) {
      const file = convertedFiles.get(id);
      if (file) {
        filesToZip.push(file);
      }
    }

    if (filesToZip.length === 0) {
      return res.status(404).json({ error: 'No matching files found to archive.' });
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="converted-webp-images.zip"');

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: err.message });
      }
    });

    archive.pipe(res);

    for (const file of filesToZip) {
      archive.append(file.buffer, { name: file.filename });
    }

    archive.finalize();
  } catch (err) {
    console.error('ZIP error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeCachedFiles: convertedFiles.size
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`WebP Converter server running at http://localhost:${PORT}`);
});
