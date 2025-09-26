// -------- CONFIG (client-side, safe values only) --------
const CLOUD_NAME = "dz57mpjzx";          // set this to your Cloudinary cloud name (line 1)
const PRESET_VIDEO = "Stories_VIDEO";          // use this for video uploads (line 2)
const PRESET_IMAGE = "Stories_IMAGE";          // use this for image uploads (line 3)
const PROXY_ENDPOINT = "/api/make-proxy";      // Vercel function that forwards to Make

// -------- DOM --------
const urlInput = document.getElementById("urlInput");
const fileInput = document.getElementById("fileInput");
const btnUpload = document.getElementById("btnUpload");
const uploadStatus = document.getElementById("uploadStatus");

const videoPreview = document.getElementById("videoPreview");
const imagePreview = document.getElementById("imagePreview");
const previewInfo = document.getElementById("previewInfo");

const btnPublish = document.getElementById("btnPublish");
const publishStatus = document.getElementById("publishStatus");
const payloadEcho = document.getElementById("payloadEcho");

const reviewerEmailInput = document.getElementById("reviewerEmail");
const targetRadios = document.querySelectorAll('input[name="target"]');

// === Sample media support ===
// Buttons in the page let reviewers quickly load sample image/video URLs
const SAMPLE_IMAGE_URL = 'https://res.cloudinary.com/dz57mpjzx/image/upload/v1758892366/qbfxykbf6nnafxkxxgry.jpg';
const SAMPLE_VIDEO_URL = 'https://res.cloudinary.com/dz57mpjzx/video/upload/v1758892412/z0b3tx77wbhdmetqqskg.mp4';

// Find media URL input (try several fallbacks) and ensure it has an id we can reference
let mediaUrlInput = document.querySelector('#media-url') || document.querySelector('input[name="media_url"]') || document.querySelector('input[type="url"]');
if (mediaUrlInput && !mediaUrlInput.id) mediaUrlInput.id = 'media-url';

// Helper: set URL and trigger existing listeners so preview and detection run
function setMediaUrlAndNotify(url) {
  if (!mediaUrlInput) return;
  mediaUrlInput.value = url;

  const ev = new Event('input', { bubbles: true });
  mediaUrlInput.dispatchEvent(ev);

  const ev2 = new Event('change', { bubbles: true });
  mediaUrlInput.dispatchEvent(ev2);
}

// Wire sample buttons after DOM is available (buttons may exist in HTML)
document.addEventListener('DOMContentLoaded', () => {
  const imgBtn = document.getElementById('sample-image-btn');
  const vidBtn = document.getElementById('sample-video-btn');

  if (imgBtn) {
    imgBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setMediaUrlAndNotify(SAMPLE_IMAGE_URL);
    });
  }

  if (vidBtn) {
    vidBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setMediaUrlAndNotify(SAMPLE_VIDEO_URL);
    });
  }
});

// internal state to remember detected media type and upload origin
let detectedMediaType = null; // "video" | "image"
let uploadedMediaType = null; // "video" | "image" if uploaded via file
let uploadedFromFile = false;

// Set reviewer email in the hidden input (fixed reviewer)
// Replace the value here if you want a different reviewer email for testing
const REVIEW_EMAIL_DEFAULT = "testuser@h3llo.dk";
if (reviewerEmailInput) reviewerEmailInput.value = REVIEW_EMAIL_DEFAULT;

// keep target change UI simple (no IDs inputs anymore)
targetRadios.forEach(r => {
  r.addEventListener("change", () => {
    // no extra UI toggles required
  });
});

function detectMediaTypeFromFile(file) {
  if (!file) return null;
  if (file.type && file.type.startsWith("video")) return "video";
  if (file.type && file.type.startsWith("image")) return "image";
  // fallback to extension
  const name = (file.name || "").toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(name)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(name)) return "image";
  return "video";
}

function detectMediaTypeFromUrlSync(url) {
  if (!url) return null;
  url = url.split("?")[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(url)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(url)) return "image";
  return "video";
}

async function detectMediaTypeFromUrl(url) {
  // Try HEAD request to get content-type; fall back to extension
  if (!url) return null;
  try {
    const res = await fetch(url, { method: "HEAD" });
    const ct = res.headers.get("content-type");
    if (ct) {
      if (ct.startsWith("video/")) return "video";
      if (ct.startsWith("image/")) return "image";
    }
  } catch (e) {
    // HEAD may be blocked by CORS; ignore and fallback to extension
  }
  return detectMediaTypeFromUrlSync(url);
}

async function setPreview(url) {
  if (!url) return;
  const type = await detectMediaTypeFromUrl(url);
  detectedMediaType = type;
  if (type === "video") {
    imagePreview.style.display = "none";
    videoPreview.style.display = "block";
    videoPreview.src = url;
    previewInfo.textContent = "Detected video URL";
  } else if (type === "image") {
    videoPreview.style.display = "none";
    imagePreview.style.display = "block";
    imagePreview.src = url;
    previewInfo.textContent = "Detected image URL";
  } else {
    // default: assume video
    imagePreview.style.display = "none";
    videoPreview.style.display = "block";
    videoPreview.src = url;
    previewInfo.textContent = "Previewing media URL";
  }
}
 
// Helper to show detailed upload status near the upload button
function showUploadStatus(message, isError = false) {
  if (!uploadStatus) return;
  uploadStatus.className = isError ? "small err" : "small ok";
  if (isError) uploadStatus.textContent = `Upload failed: ${message}`;
  else uploadStatus.textContent = message === "Upload OK" ? "Upload OK" : message;
}
 
btnUpload.addEventListener("click", async () => {
  showUploadStatus("Uploading to Cloudinary…", false);
  const file = fileInput.files && fileInput.files[0];
  if (!file) { showUploadStatus("Choose a file first.", true); return; }

  try {
    // Determine resourceType and endpoint/preset
    const resourceType = (file.type && file.type.startsWith("video")) ? "video" : "image";
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
    const preset = resourceType === "video" ? PRESET_VIDEO : PRESET_IMAGE;

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", preset);

    // Perform unsigned upload (no manual Content-Type, no auth)
    const res = await fetch(endpoint, { method: "POST", body: form });
    let json;
    try {
      json = await res.json();
    } catch (e) {
      const txt = await res.text();
      throw new Error(`Invalid JSON response from Cloudinary: ${txt}`);
    }

    // Cloudinary may return an error object even with 200; check for it
    if (!res.ok || json.error) {
      const msg = (json && json.error && json.error.message) ? json.error.message : (res.statusText || `Upload failed ${res.status}`);
      showUploadStatus(msg, true);
      return;
    }

    const secure = json.secure_url;
    if (!secure) {
      showUploadStatus("Upload succeeded but secure_url missing", true);
      return;
    }

    // Populate the media URL input and normalize media type to photo/video
    urlInput.value = secure;
    uploadedFromFile = true;
    uploadedMediaType = (resourceType === "video") ? "video" : "photo";
    detectedMediaType = uploadedMediaType;

    // Ensure a hidden media_type input exists and set it for the proxy
    let mediaInput = document.getElementById("mediaType");
    if (!mediaInput) {
      mediaInput = document.createElement("input");
      mediaInput.type = "hidden";
      mediaInput.id = "mediaType";
      mediaInput.name = "media_type";
      document.body.appendChild(mediaInput);
    }
    mediaInput.value = uploadedMediaType;

    // Update preview immediately
    if (uploadedMediaType === "video") {
      videoPreview.style.display = "block";
      imagePreview.style.display = "none";
      videoPreview.src = secure;
    } else {
      imagePreview.style.display = "block";
      videoPreview.style.display = "none";
      imagePreview.src = secure;
    }

    await setPreview(secure);
    showUploadStatus("Upload OK", false);
  } catch (err) {
    console.error(err);
    const msg = err && err.message ? err.message : String(err);
    showUploadStatus(msg, true);
  }
});

urlInput.addEventListener("change", async () => {
  // if URL changed manually, clear uploadedFromFile
  uploadedFromFile = false;
  uploadedMediaType = null;
  await setPreview(urlInput.value);
  // detectedMediaType updated by setPreview
});

btnPublish.addEventListener("click", async () => {
  publishStatus.className = "small muted";
  publishStatus.textContent = "Sending to Make…";

  const mediaUrl = (urlInput.value || "").trim();
  if (!mediaUrl) { publishStatus.className = "small err"; publishStatus.textContent = "Provide a media URL."; return; }

  const target = (document.querySelector('input[name="target"]:checked').value || "").toString().trim().toLowerCase();
  // compute mediaType with priority: uploadedMediaType (if file upload), then detectedMediaType from URL, default video
  let mediaTypeCandidate = uploadedFromFile ? (uploadedMediaType || "video") : (detectedMediaType || await detectMediaTypeFromUrl(mediaUrl) || "video");
  let mediaType = String(mediaTypeCandidate).toLowerCase();
  // normalize image -> photo for routing
  if (mediaType === "image") mediaType = "photo";
 
  // validation
  const allowedTargets = new Set(["facebook", "instagram"]);
  const allowedMediaTypes = new Set(["video", "photo"]);
  if (!allowedTargets.has(target)) { publishStatus.className = "small err"; publishStatus.textContent = "Invalid target."; return; }
  if (!allowedMediaTypes.has(mediaType)) { publishStatus.className = "small err"; publishStatus.textContent = "Invalid media type."; return; }
 
  // build payload per spec: email, target, media_type, media_url, label
  const email = (reviewerEmailInput && reviewerEmailInput.value) || REVIEW_EMAIL_DEFAULT;
  const payload = {
    email,
    target,
    media_type: mediaType,
    media_url: mediaUrl,
    label: "reviewer-portal"
  };
  payloadEcho.textContent = JSON.stringify(payload, null, 2);

  try {
    const res = await fetch(PROXY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    // Try parse JSON
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* not JSON */ }

    if (!res.ok) {
      // surface upstream error if present
      const errMsg = (parsed && (parsed.error || JSON.stringify(parsed))) || text || "Upstream error";
      publishStatus.className = "small err";
      publishStatus.textContent = errMsg;
      return;
    }

    // success
    publishStatus.className = "small ok";
    if (parsed && parsed.routeKey) {
      publishStatus.textContent = `Sent ✔ — routeKey: ${parsed.routeKey}`;
    } else {
      publishStatus.textContent = "Sent ✔ — Make will publish the Story.";
    }
  } catch (err) {
    console.error(err);
    publishStatus.className = "small err";
    publishStatus.textContent = "Failed sending to Make.";
  }
});