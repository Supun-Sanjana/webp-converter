# WebP Studio — High-Performance JPG/PNG to WebP Converter

A modern, fast, and feature-rich web application to convert **JPG**, **JPEG**, and **PNG** images into next-generation **WebP** files with up to 80% file size reduction.

Includes full support for both **Node.js** (powered by `sharp` / `libvips`) and **Python** (powered by `Pillow` & `Flask`).

---

## 🌟 Key Features

- **Drag & Drop Multi-File Upload**: Convert single images or batches of up to 50 files simultaneously.
- **Granular Quality Control**:
  - Slider (1% - 100%) with quick presets (Eco 70%, High 82%, Max 95%).
  - **Lossless Compression** toggle: Perfect for pixel-exact graphics, transparent logos, charts, and screenshots.
  - **Optional Resizing**: Constrain maximum width and height while keeping original aspect ratio without upscaling.
  - **Encoding Effort / Speed Preset**: Balance encoding speed against maximum compression density.
- **Real-Time Savings Statistics**: Shows file-by-file comparison (original size vs. WebP size, percentage saved, new dimensions).
- **Interactive Before & After Visual Slider**: Draggable split-view modal to inspect visual quality before downloading.
- **Flexible Downloads**:
  - Download individual WebP images.
  - One-click **"Download All as .ZIP"** archive for batch jobs.
- **Dual-Stack Backend**: Run with either **Node.js** (default) or **Python**.

---

## 🚀 Getting Started

### Option 1: Run with Node.js (Recommended)

1. **Install dependencies** (already installed in workspace):
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

### Option 2: Run with Python

If you prefer Python:

1. **Install requirements**:
   ```bash
   pip install flask pillow
   ```

2. **Start the Python app**:
   ```bash
   python app.py
   # or via npm script:
   npm run start:python
   ```

3. Open your browser at:
   ```
   http://localhost:3000
   ```

---

## 📡 REST API Reference

The app also provides REST API endpoints for automated workflows and CLI usage:

### 1. Batch / Single Image Conversion
- **Endpoint**: `POST /api/convert`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `images`: Image file(s) (`.jpg`, `.jpeg`, `.png`, `.webp`)
  - `quality` (optional): Integer `1-100` (default: `80`)
  - `lossless` (optional): `true` or `false`
  - `effort` (optional): `1-6` (default: `4`)
  - `maxWidth` (optional): Max pixel width
  - `maxHeight` (optional): Max pixel height
- **cURL Example**:
  ```bash
  curl -X POST -F "images=@photo.jpg" -F "quality=85" http://localhost:3000/api/convert
  ```

### 2. Download Converted Image
- **Endpoint**: `GET /api/download/:id`
- Returns binary `image/webp`.

### 3. Download All Converted Images as ZIP
- **Endpoint**: `POST /api/download-zip`
- **Content-Type**: `application/json`
- **Body**: `{ "ids": ["id1", "id2", ...] }`

### 4. Direct Single File Stream
- **Endpoint**: `POST /api/convert-direct`
- **Content-Type**: `multipart/form-data`
- Streams the converted `.webp` binary directly in the response.
- **cURL Example**:
  ```bash
  curl -F "image=@photo.jpg" http://localhost:3000/api/convert-direct -o photo.webp
  ```

---

## 📁 Project Structure

```
d:/webp-converter/
├── server.js          # Node.js Express + Sharp backend
├── app.py             # Python Flask + Pillow backend
├── package.json       # Node.js dependencies & scripts
├── public/            # Modern frontend UI
│   ├── index.html     # Semantic responsive interface
│   ├── style.css      # Dark theme UI styling & sliders
│   └── app.js         # Client state, drag-drop, API integration & comparison slider
└── README.md          # Documentation & usage guide
```
