import os
import io
import uuid
import time
import zipfile
from flask import Flask, request, jsonify, send_file, send_from_directory
from PIL import Image

app = Flask(__name__, static_folder='public', static_url_path='')

# In-memory store for converted files: { id: { filename, buffer, size, original_name, original_size, timestamp } }
converted_files = {}
FILE_TTL_SECONDS = 30 * 60

def cleanup_old_files():
    now = time.time()
    expired = [k for k, v in converted_files.items() if now - v['timestamp'] > FILE_TTL_SECONDS]
    for k in expired:
        del converted_files[k]

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('public', path)

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'backend': 'python-pillow',
        'activeCachedFiles': len(converted_files)
    })

def convert_to_webp(image_bytes, options):
    quality = int(options.get('quality', 80))
    quality = max(1, min(100, quality))
    lossless = options.get('lossless') in ['true', True, '1']
    method = int(options.get('effort', 4))
    method = max(0, min(6, method))
    
    max_w = options.get('maxWidth')
    max_h = options.get('maxHeight')

    img = Image.open(io.BytesIO(image_bytes))
    orig_w, orig_h = img.size
    orig_format = img.format or 'UNKNOWN'

    # If image has palette or transparency mode, convert appropriately for WebP
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        img = img.convert('RGBA')
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize if requested
    if max_w or max_h:
        try:
            target_w = int(max_w) if max_w else orig_w
            target_h = int(max_h) if max_h else orig_h
            img.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
        except ValueError:
            pass

    out_buf = io.BytesIO()
    img.save(
        out_buf,
        format='WEBP',
        quality=quality,
        lossless=lossless,
        method=method
    )
    converted_bytes = out_buf.getvalue()
    new_w, new_h = img.size

    return {
        'buffer': converted_bytes,
        'originalWidth': orig_w,
        'originalHeight': orig_h,
        'originalFormat': orig_format,
        'newWidth': new_w,
        'newHeight': new_h,
        'newSize': len(converted_bytes)
    }

@app.route('/api/convert', methods=['POST'])
def convert_batch():
    cleanup_old_files()
    if 'images' not in request.files:
        return jsonify({'success': False, 'error': 'No image files provided'}), 400

    uploaded_files = request.files.getlist('images')
    if not uploaded_files or uploaded_files[0].filename == '':
        return jsonify({'success': False, 'error': 'No files selected'}), 400

    options = {
        'quality': request.form.get('quality', 80),
        'lossless': request.form.get('lossless', 'false'),
        'effort': request.form.get('effort', 4),
        'maxWidth': request.form.get('maxWidth'),
        'maxHeight': request.form.get('maxHeight')
    }

    results = []
    for file in uploaded_files:
        try:
            file_bytes = file.read()
            orig_size = len(file_bytes)
            orig_name = file.filename
            
            res = convert_to_webp(file_bytes, options)
            file_id = str(uuid.uuid4())
            base_name = os.path.splitext(orig_name)[0]
            webp_name = f"{base_name}.webp"

            converted_files[file_id] = {
                'filename': webp_name,
                'buffer': res['buffer'],
                'original_name': orig_name,
                'original_size': orig_size,
                'size': res['newSize'],
                'timestamp': time.time()
            }

            saved_bytes = orig_size - res['newSize']
            reduction_pct = round((saved_bytes / orig_size) * 100) if orig_size > 0 else 0

            results.append({
                'id': file_id,
                'success': True,
                'originalName': orig_name,
                'originalSize': orig_size,
                'originalDimensions': f"{res['originalWidth']}x{res['originalHeight']}",
                'convertedName': webp_name,
                'convertedSize': res['newSize'],
                'convertedDimensions': f"{res['newWidth']}x{res['newHeight']}",
                'reductionPercent': reduction_pct,
                'downloadUrl': f"/api/download/{file_id}",
                'previewUrl': f"/api/preview/{file_id}"
            })
        except Exception as e:
            results.append({
                'success': False,
                'originalName': file.filename,
                'originalSize': len(file_bytes) if 'file_bytes' in locals() else 0,
                'error': str(e)
            })

    return jsonify({
        'success': True,
        'count': len(results),
        'files': results
    })

@app.route('/api/download/<file_id>')
def download_file(file_id):
    file_item = converted_files.get(file_id)
    if not file_item:
        return 'File not found or expired', 404

    return send_file(
        io.BytesIO(file_item['buffer']),
        mimetype='image/webp',
        as_attachment=True,
        download_name=file_item['filename']
    )

@app.route('/api/preview/<file_id>')
def preview_file(file_id):
    file_item = converted_files.get(file_id)
    if not file_item:
        return 'File not found or expired', 404

    return send_file(
        io.BytesIO(file_item['buffer']),
        mimetype='image/webp'
    )

@app.route('/api/download-zip', methods=['POST'])
def download_zip():
    data = request.get_json() or {}
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'error': 'No file IDs provided'}), 400

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for file_id in ids:
            item = converted_files.get(file_id)
            if item:
                zip_file.writestr(item['filename'], item['buffer'])

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name='converted-webp-images.zip'
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"WebP Converter (Python Pillow) running at http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
