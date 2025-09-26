// -------- CONFIG (client-side, safe values only) --------
const CLOUD_NAME = "YOUR_CLOUD_NAME";          // keep as-is if already set
const PRESET_VIDEO = "Stories_VIDEO";          // <- use this for video
const PRESET_IMAGE = "Stories_IMAGE";          // <- use this for image
const PROXY_ENDPOINT = "/api/make-proxy";                  // Vercel function that forwards to Make

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

const fbPageId = document.getElementById("fbPageId");
const igUserId = document.getElementById("igUserId");
const fbIds = document.getElementById("fbIds");
const igIds = document.getElementById("igIds");

// internal state to remember detected media type and upload origin
let detectedMediaType = null; // "video" | "photo"
let uploadedMediaType = null; // "video" | "photo" if uploaded via file
let uploadedFromFile = false;

document.querySelectorAll('input[name="target"]').forEach(r => {
  r.addEventListener("change", () => {
    const val = document.querySelector('input[name="target"]:checked').value;
    if (val === "facebook") { fbIds.style.display = ""; igIds.style.display = "none"; }
    else { fbIds.style.display = "none"; igIds.style.display = ""; }
  });
});

function detectMediaTypeFromFile(file) {
  if (!file) return null;
  if (file.type && file.type.startsWith("video")) return "video";
  if (file.type && file.type.startsWith("image")) return "photo";
  // fallback to extension
  const name = (file.name || "").toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(name)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(name)) return "photo";
  return "video";
}

function detectMediaTypeFromUrl(url) {
  if (!url) return null;
  url = url.split("?")[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(url)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(url)) return "photo";
  // default to video for unknowns (stories are typically video)
  return "video";
}

function setPreview(url) {
  if (!url) return;
  const type = detectMediaTypeFromUrl(url);
  detectedMediaType = type;
  if (type === "video") {
    imagePreview.style.display = "none";
    videoPreview.style.display = "block";
    videoPreview.src = url;
    previewInfo.textContent = "Detected video URL";
  } else if (type === "photo") {
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

btnUpload.addEventListener("click", async () => {
  uploadStatus.className = "small muted";
  uploadStatus.textContent = "Uploading to Cloudinary…";
  const file = fileInput.files && fileInput.files[0];
  if (!file) { uploadStatus.className = "small err"; uploadStatus.textContent = "Choose a file first."; return; }

  try {
    // determine kind and preset
    const kind = detectMediaTypeFromFile(file); // "video" | "photo"
    const endpoint = kind === "video" ? "video" : "image";
    const preset = kind === "video" ? PRESET_VIDEO : PRESET_IMAGE;

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", preset);

    // upload to explicit endpoint (video or image)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpoint}/upload`, {
      method: "POST",
      body: form
    });
    if (!res.ok) throw new Error(`Cloudinary upload failed ${res.status}`);
    const json = await res.json();

    const url = json.secure_url;
    urlInput.value = url;

    // set preview and detected media type based on file and url
    uploadedFromFile = true;
    uploadedMediaType = kind;
    detectedMediaType = kind || detectMediaTypeFromUrl(url);

    setPreview(url);

    uploadStatus.className = "small ok";
    uploadStatus.textContent = "Uploaded ✔";
  } catch (err) {
    console.error(err);
    uploadStatus.className = "small err";
    uploadStatus.textContent = "Upload failed.";
  }
});

urlInput.addEventListener("change", () => {
  // if URL changed manually, clear uploadedFromFile
  uploadedFromFile = false;
  uploadedMediaType = null;
  setPreview(urlInput.value);
  // detectedMediaType updated by setPreview
});

btnPublish.addEventListener("click", async () => {
  publishStatus.className = "small muted";
  publishStatus.textContent = "Sending to Make…";

  const mediaUrl = (urlInput.value || "").trim();
  if (!mediaUrl) { publishStatus.className = "small err"; publishStatus.textContent = "Provide a media URL."; return; }

  const target = (document.querySelector('input[name="target"]:checked').value || "").toString().trim().toLowerCase();
  // compute mediaType with priority: uploadedMediaType (if file upload), then detectedMediaType from URL, default video
  const mediaType = uploadedFromFile ? (uploadedMediaType || "video") : (detectedMediaType || detectMediaTypeFromUrl(mediaUrl) || "video");

  // validation
  const allowedTargets = new Set(["facebook", "instagram"]);
  const allowedMediaTypes = new Set(["video", "photo"]);
  if (!allowedTargets.has(target)) { publishStatus.className = "small err"; publishStatus.textContent = "Invalid target."; return; }
  if (!allowedMediaTypes.has(mediaType)) { publishStatus.className = "small err"; publishStatus.textContent = "Invalid media type."; return; }

  // if there is a conflict between detected and an existing UI toggle (not present currently),
  // we could show a warning; for now we block only if mismatch would cause unknown routing
  const payload = {
    source: "reviewer-portal",
    mediaType,                 // ensured field per requirements
    media_type: mediaType,     // legacy, server accepts either
    media_url: mediaUrl,
    target,                    // "facebook" | "instagram"
    fb_page_id: target === "facebook" ? (fbPageId.value || "").trim() : undefined,
    ig_user_id: target === "instagram" ? (igUserId.value || "").trim() : undefined
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