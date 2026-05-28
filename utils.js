/* ============================================================
   CSC Sahayak — Utility Functions
   File handling, validation, and storage helpers
   ============================================================ */

const CSCUtils = (() => {
  "use strict";

  // ─── Constants ──────────────────────────────────────────────
  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
  const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // ─── File Handling ─────────────────────────────────────────

  /**
   * Validate a file before upload.
   * @param {File} file
   * @returns {{ valid: boolean, error_hi?: string, error_en?: string }}
   */
  function validateFile(file) {
    if (!file) {
      return {
        valid: false,
        error_hi: "कोई फ़ाइल नहीं चुनी गई।",
        error_en: "No file selected."
      };
    }

    // Check type
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error_hi: "⚠️ केवल PDF, JPG, PNG फ़ाइलें अनुमत हैं।",
        error_en: "Only PDF, JPG, and PNG files are allowed."
      };
    }

    // Check size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error_hi: `⚠️ फ़ाइल बहुत बड़ी है (${sizeMB}MB)। अधिकतम 5MB अनुमत है।`,
        error_en: `File too large (${sizeMB}MB). Maximum 5MB allowed.`
      };
    }

    return { valid: true };
  }

  /**
   * Read a file as base64 data URL.
   * @param {File} file
   * @returns {Promise<{ base64: string, mimeType: string, fileName: string }>}
   */
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          base64: reader.result,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
          fileSize: file.size
        });
      };
      reader.onerror = () => {
        reject(new Error("File reading failed"));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Check if a file is an image (for thumbnail preview).
   * @param {string} mimeType
   * @returns {boolean}
   */
  function isImage(mimeType) {
    return mimeType === "image/jpeg" || mimeType === "image/png";
  }

  /**
   * Format file size for display.
   * @param {number} bytes
   * @returns {string}
   */
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // ─── Storage Helpers ───────────────────────────────────────

  /**
   * Save current session to chrome.storage.local.
   * @param {object} sessionData
   * @returns {Promise<void>}
   */
  function saveSession(sessionData) {
    return new Promise((resolve) => {
      try {
        // Strip base64 data from documents before saving to storage
        // (base64 is too large for chrome.storage — keep in memory only)
        const storageData = { ...sessionData };
        if (storageData.documents) {
          storageData.documents = storageData.documents.map((doc) => ({
            docType: doc.docType,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            uploaded: true
          }));
        }
        chrome.storage.local.set({ currentSession: storageData }, () => {
          console.log("Session saved:", storageData);
          resolve();
        });
      } catch (e) {
        console.log("Session data (no chrome.storage):", sessionData);
        resolve();
      }
    });
  }

  /**
   * Load current session from chrome.storage.local.
   * @returns {Promise<object|null>}
   */
  function loadSession() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get("currentSession", (result) => {
          resolve(result.currentSession || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  // ─── Formatting Helpers ────────────────────────────────────

  /**
   * Escape HTML special characters.
   * @param {string} str
   * @returns {string}
   */
  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Get current time as a formatted string.
   * @returns {string}
   */
  function getTimeString() {
    const now = new Date();
    return now.toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" });
  }

  /**
   * Sends a message to a tab's content script with:
   * 1. Promise wrapping
   * 2. Timeout handling
   * 3. Graceful chrome.runtime.lastError handling
   * 4. Automatic injection of content.js on connection failures
   * 5. Handle page script blocking / restricted URL error detection
   *
   * @param {number} tabId
   * @param {object} message
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<{ success: boolean, response?: any, error?: string, details?: string }>}
   */
  function sendRobustTabMessage(tabId, message, timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (!tabId) {
        resolve({ success: false, error: "NO_TAB_ID", details: "Tab ID is missing or invalid." });
        return;
      }

      let resolved = false;

      // Timeout handler
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        console.warn(`[RobustMessage] Message of type ${message.type} to tab ${tabId} timed out after ${timeoutMs}ms.`);
        resolve({
          success: false,
          error: "TIMEOUT",
          details: `Message of type ${message.type} timed out. The content script might be frozen or non-responsive.`
        });
      }, timeoutMs);

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      };

      const trySendMessage = (isRetry = false) => {
        try {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
              const errMsg = err.message || "";
              console.warn(`[RobustMessage] SendMessage failed. isRetry: ${isRetry}. Error: ${errMsg}`);

              // If we haven't retried yet and the error is a connection failure (content script not injected)
              if (!isRetry && (
                errMsg.includes("Could not establish connection") ||
                errMsg.includes("Receiving end does not exist") ||
                errMsg.includes("connection matches no receiver")
              )) {
                console.log(`[RobustMessage] Connection error detected, attempting to reinject content.js into tab ${tabId}...`);
                attemptReinjection();
              } else {
                // Categorize common script block errors
                let errorCode = "SEND_FAILED";
                if (errMsg.includes("Cannot access") || errMsg.includes("restricted") || errMsg.includes("chrome://")) {
                  errorCode = "RESTRICTED_PAGE";
                }
                finish({
                  success: false,
                  error: errorCode,
                  details: errMsg
                });
              }
            } else {
              finish({
                success: true,
                response: response
              });
            }
          });
        } catch (e) {
          finish({
            success: false,
            error: "EXCEPTION",
            details: e.message
          });
        }
      };

      const attemptReinjection = () => {
        if (!chrome.scripting) {
          finish({
            success: false,
            error: "INJECTION_BLOCKED",
            details: "chrome.scripting API is not available to inject content script."
          });
          return;
        }

        chrome.scripting.executeScript(
          { target: { tabId: tabId }, files: ["content.js"] },
          () => {
            const err = chrome.runtime.lastError;
            if (err) {
              const errMsg = err.message || "";
              console.error(`[RobustMessage] Reinjection failed: ${errMsg}`);
              let errorCode = "INJECTION_FAILED";
              if (errMsg.includes("Cannot access") || errMsg.includes("restricted") || errMsg.includes("chrome://")) {
                errorCode = "RESTRICTED_PAGE";
              }
              finish({
                success: false,
                error: errorCode,
                details: `Failed to inject content script: ${errMsg}`
              });
            } else {
              console.log(`[RobustMessage] content.js injected successfully. Retrying message...`);
              setTimeout(() => {
                trySendMessage(true);
              }, 300);
            }
          }
        );
      };

      trySendMessage(false);
    });
  }

  // ─── Public API ────────────────────────────────────────────
  return {
    validateFile,
    readFileAsBase64,
    isImage,
    formatFileSize,
    saveSession,
    loadSession,
    escapeHTML,
    getTimeString,
    sendRobustTabMessage,
    ALLOWED_TYPES,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE
  };
})();
