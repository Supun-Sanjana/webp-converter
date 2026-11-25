// State Management
let fileQueue = [];
let isConverting = false;

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const fileList = document.getElementById('fileList');
const resultsSection = document.getElementById('resultsSection');
const queueSummaryTitle = document.getElementById('queueSummaryTitle');
const totalFilesBadge = document.getElementById('totalFilesBadge');
const totalSavingsBadge = document.getElementById('totalSavingsBadge');
const convertAllBtn = document.getElementById('convertAllBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const progressBarContainer = document.getElementById('conversionProgressBar');
const progressBarFill = document.getElementById('progressBarFill');

// Settings Elements
const qualityRange = document.getElementById('qualityRange');
const qualityValue = document.getElementById('qualityValue');
const losslessCheckbox = document.getElementById('losslessCheckbox');
const maxWidthInput = document.getElementById('maxWidthInput');
const maxHeightInput = document.getElementById('maxHeightInput');
const effortSelect = document.getElementById('effortSelect');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const presetButtons = document.querySelectorAll('.preset-btn');

// Modal Elements
const compareModal = document.getElementById('compareModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModalBtn');
const compareContainer = document.getElementById('compareContainer');
const compareBeforeImg = document.getElementById('compareBeforeImg');
const compareAfterImg = document.getElementById('compareAfterImg');
const compareAfterWrapper = document.getElementById('compareAfterWrapper');
const compareHandle = document.getElementById('compareHandle');
const compareOriginalInfo = document.getElementById('compareOriginalInfo');
const compareWebpInfo = document.getElementById('compareWebpInfo');
const compareSavingsInfo = document.getElementById('compareSavingsInfo');

// Setup Settings Event Listeners
qualityRange.addEventListener('input', (e) => {
  const val = e.target.value;
  qualityValue.textContent = `${val}%`;
  updateActivePreset(val);
});

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.quality;
    qualityRange.value = q;
    qualityValue.textContent = `${q}%`;
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function updateActivePreset(val) {
  presetButtons.forEach(btn => {
    if (btn.dataset.quality === val) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

losslessCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    qualityRange.disabled = true;
    qualityRange.style.opacity = '0.5';
    qualityValue.textContent = '100% (Lossless)';
  } else {
    qualityRange.disabled = false;
    qualityRange.style.opacity = '1';
    qualityValue.textContent = `${qualityRange.value}%`;
  }
});

resetSettingsBtn.addEventListener('click', () => {
  qualityRange.value = 82;
  qualityRange.disabled = false;
  qualityRange.style.opacity = '1';
  qualityValue.textContent = '82%';
  losslessCheckbox.checked = false;
  maxWidthInput.value = '';
  maxHeightInput.value = '';
  effortSelect.value = '4';
  updateActivePreset('82');
});

// Dropzone Event Listeners
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files && files.length > 0) {
    handleFilesAdded(Array.from(files));
  }
});

dropzone.addEventListener('click', (e) => {
  if (e.target !== browseBtn) {
    fileInput.click();
  }
});

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFilesAdded(Array.from(e.target.files));
    fileInput.value = ''; // Reset input to allow re-upload of same file
  }
});

// File Handling
function handleFilesAdded(files) {
  const validFiles = files.filter(file => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return (
      type === 'image/jpeg' ||
      type === 'image/jpg' ||
      type === 'image/png' ||
      type === 'image/webp' ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.webp')
    );
  });

  if (validFiles.length === 0) {
    alert('Please upload valid JPG or PNG images.');
    return;
  }

  validFiles.forEach(file => {
    const queueItem = {
      localId: 'local_' + Math.random().toString(36).substring(2, 9),
      file: file,
      name: file.name,
      size: file.size,
      format: file.name.split('.').pop().toUpperCase(),
      status: 'pending', // 'pending' | 'converting' | 'converted' | 'error'
      convertedData: null,
      previewUrl: URL.createObjectURL(file)
    };
    fileQueue.push(queueItem);
  });

  updateUI();
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function updateUI() {
  if (fileQueue.length === 0) {
    resultsSection.classList.add('hidden');
    return;
  }

  resultsSection.classList.remove('hidden');
  totalFilesBadge.textContent = `${fileQueue.length} ${fileQueue.length === 1 ? 'file' : 'files'}`;

  const convertedCount = fileQueue.filter(f => f.status === 'converted').length;
  if (convertedCount > 0) {
    queueSummaryTitle.textContent = `${convertedCount} of ${fileQueue.length} Converted`;
    downloadZipBtn.classList.remove('hidden');

    // Calculate total savings
    let origTotal = 0;
    let newTotal = 0;
    fileQueue.forEach(item => {
      if (item.status === 'converted' && item.convertedData) {
        origTotal += item.size;
        newTotal += item.convertedData.convertedSize;
      }
    });

    if (origTotal > 0) {
      const pct = Math.round(((origTotal - newTotal) / origTotal) * 100);
      totalSavingsBadge.textContent = `${pct > 0 ? '-' + pct : pct}% saved (${formatBytes(origTotal - newTotal)})`;
      totalSavingsBadge.classList.remove('hidden');
    }
  } else {
    queueSummaryTitle.textContent = 'Files to Convert';
    downloadZipBtn.classList.add('hidden');
    totalSavingsBadge.classList.add('hidden');
  }

  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = '';

  fileQueue.forEach(item => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.id = `card-${item.localId}`;

    // Thumbnail
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'file-thumb-container';
    const thumbImg = document.createElement('img');
    thumbImg.className = 'file-thumb';
    thumbImg.src = item.previewUrl;
    thumbImg.alt = item.name;
    thumbContainer.appendChild(thumbImg);

    // Info
    const info = document.createElement('div');
    info.className = 'file-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'file-name-row';
    const nameEl = document.createElement('span');
    nameEl.className = 'file-name';
    nameEl.title = item.name;
    nameEl.textContent = item.name;

    const badge = document.createElement('span');
    badge.className = 'file-format-badge';
    badge.textContent = item.format;

    nameRow.appendChild(nameEl);
    nameRow.appendChild(badge);

    const metaRow = document.createElement('div');
    metaRow.className = 'file-meta-row';

    if (item.status === 'pending') {
      metaRow.innerHTML = `
        <span>Original: ${formatBytes(item.size)}</span>
        <span class="file-status-badge status-pending">Ready to convert</span>
      `;
    } else if (item.status === 'converting') {
      metaRow.innerHTML = `
        <span>Original: ${formatBytes(item.size)}</span>
        <span class="file-status-badge status-converting">
          <span class="spinner"></span> Converting...
        </span>
      `;
    } else if (item.status === 'converted' && item.convertedData) {
      const c = item.convertedData;
      const reductionText = c.reductionPercent >= 0 ? `-${c.reductionPercent}%` : `+${Math.abs(c.reductionPercent)}%`;
      metaRow.innerHTML = `
        <span>${formatBytes(item.size)} &rarr; <strong>${formatBytes(c.convertedSize)}</strong></span>
        <span class="savings-badge">${reductionText}</span>
        <span class="file-dims">${c.convertedDimensions}</span>
      `;
    } else if (item.status === 'error') {
      metaRow.innerHTML = `
        <span style="color: var(--danger-color)">Error: ${item.errorMessage || 'Conversion failed'}</span>
      `;
    }

    info.appendChild(nameRow);
    info.appendChild(metaRow);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'file-actions';

    if (item.status === 'converted' && item.convertedData) {
      // Compare button
      const compareBtn = document.createElement('button');
      compareBtn.className = 'btn btn-outline btn-sm';
      compareBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>
        Compare
      `;
      compareBtn.onclick = () => openCompareModal(item);
      actions.appendChild(compareBtn);

      // Download button
      const downloadBtn = document.createElement('a');
      downloadBtn.className = 'btn btn-accent btn-sm';
      downloadBtn.href = item.convertedData.downloadUrl;
      downloadBtn.download = item.convertedData.convertedName;
      downloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Download
      `;
      actions.appendChild(downloadBtn);
    }

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-ghost btn-sm';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => {
      removeItem(item.localId);
    };
    actions.appendChild(removeBtn);

    card.appendChild(thumbContainer);
    card.appendChild(info);
    card.appendChild(actions);

    fileList.appendChild(card);
  });
}

function removeItem(localId) {
  const index = fileQueue.findIndex(f => f.localId === localId);
  if (index !== -1) {
    if (fileQueue[index].previewUrl) {
      URL.revokeObjectURL(fileQueue[index].previewUrl);
    }
    fileQueue.splice(index, 1);
    updateUI();
  }
}

clearAllBtn.addEventListener('click', () => {
  fileQueue.forEach(item => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  fileQueue = [];
  updateUI();
});

// Conversion Logic
convertAllBtn.addEventListener('click', async () => {
  const pendingItems = fileQueue.filter(f => f.status === 'pending' || f.status === 'error');
  if (pendingItems.length === 0) {
    alert('All files are already converted! Add more images or adjust settings.');
    return;
  }

  isConverting = true;
  convertAllBtn.disabled = true;
  progressBarContainer.classList.remove('hidden');
  progressBarFill.style.width = '10%';

  // Mark pending items as converting
  pendingItems.forEach(item => {
    item.status = 'converting';
  });
  renderFileList();

  try {
    const formData = new FormData();
    pendingItems.forEach(item => {
      formData.append('images', item.file);
    });

    // Append options
    formData.append('quality', qualityRange.value);
    formData.append('lossless', losslessCheckbox.checked);
    formData.append('effort', effortSelect.value);
    if (maxWidthInput.value) formData.append('maxWidth', maxWidthInput.value);
    if (maxHeightInput.value) formData.append('maxHeight', maxHeightInput.value);

    progressBarFill.style.width = '45%';

    const res = await fetch('/api/convert', {
      method: 'POST',
      body: formData
    });

    progressBarFill.style.width = '85%';

    const data = await res.json();
    if (data.success && data.files) {
      data.files.forEach((fileResult, idx) => {
        const item = pendingItems[idx];
        if (!item) return;

        if (fileResult.success) {
          item.status = 'converted';
          item.convertedData = fileResult;
        } else {
          item.status = 'error';
          item.errorMessage = fileResult.error;
        }
      });
    } else {
      throw new Error(data.error || 'Server error occurred during conversion');
    }
  } catch (err) {
    console.error('Conversion failed:', err);
    pendingItems.forEach(item => {
      item.status = 'error';
      item.errorMessage = err.message;
    });
    alert('Conversion error: ' + err.message);
  } finally {
    isConverting = false;
    convertAllBtn.disabled = false;
    progressBarFill.style.width = '100%';
    setTimeout(() => {
      progressBarContainer.classList.add('hidden');
      progressBarFill.style.width = '0%';
    }, 400);
    updateUI();
  }
});

// Download All as ZIP
downloadZipBtn.addEventListener('click', async () => {
  const convertedItems = fileQueue.filter(f => f.status === 'converted' && f.convertedData);
  if (convertedItems.length === 0) {
    alert('No converted files available to download.');
    return;
  }

  const ids = convertedItems.map(f => f.convertedData.id);

  try {
    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = 'Generating ZIP...';

    const response = await fetch('/api/download-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (!response.ok) throw new Error('Failed to generate ZIP archive');

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `webp-images-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    console.error('ZIP download error:', err);
    alert('Failed to download ZIP: ' + err.message);
  } finally {
    downloadZipBtn.disabled = false;
    downloadZipBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Download All as .ZIP
    `;
  }
});

// Comparison Modal Logic
function openCompareModal(item) {
  if (!item.convertedData) return;

  compareBeforeImg.src = item.previewUrl;
  compareAfterImg.src = item.convertedData.previewUrl;

  compareOriginalInfo.textContent = `${formatBytes(item.size)} (${item.convertedData.originalDimensions})`;
  compareWebpInfo.textContent = `${formatBytes(item.convertedData.convertedSize)} (${item.convertedData.convertedDimensions})`;

  const pct = item.convertedData.reductionPercent;
  compareSavingsInfo.textContent = `${pct >= 0 ? '-' + pct : pct}% size reduction`;

  // Reset handle position to 50%
  setComparePosition(50);

  compareModal.classList.remove('hidden');
}

function closeCompareModal() {
  compareModal.classList.add('hidden');
}

closeModalBtn.addEventListener('click', closeCompareModal);
modalBackdrop.addEventListener('click', closeCompareModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !compareModal.classList.contains('hidden')) {
    closeCompareModal();
  }
});

function setComparePosition(percentage) {
  const clampPct = Math.max(0, Math.min(100, percentage));
  compareAfterWrapper.style.width = `${clampPct}%`;
  compareHandle.style.left = `${clampPct}%`;

  // Keep after image full width aligned
  if (compareContainer.clientWidth > 0) {
    compareAfterImg.style.width = `${compareContainer.clientWidth}px`;
  }
}

// Compare slider dragging
let isSliding = false;

compareContainer.addEventListener('mousedown', (e) => {
  isSliding = true;
  updateSliderFromEvent(e);
});

window.addEventListener('mousemove', (e) => {
  if (!isSliding) return;
  updateSliderFromEvent(e);
});

window.addEventListener('mouseup', () => {
  isSliding = false;
});

// Touch support for slider
compareContainer.addEventListener('touchstart', (e) => {
  isSliding = true;
  if (e.touches[0]) updateSliderFromTouch(e.touches[0]);
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!isSliding) return;
  if (e.touches[0]) updateSliderFromTouch(e.touches[0]);
}, { passive: true });

window.addEventListener('touchend', () => {
  isSliding = false;
});

function updateSliderFromEvent(e) {
  const rect = compareContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const pct = (x / rect.width) * 100;
  setComparePosition(pct);
}

function updateSliderFromTouch(touch) {
  const rect = compareContainer.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const pct = (x / rect.width) * 100;
  setComparePosition(pct);
}

window.addEventListener('resize', () => {
  if (compareContainer.clientWidth > 0) {
    compareAfterImg.style.width = `${compareContainer.clientWidth}px`;
  }
});
