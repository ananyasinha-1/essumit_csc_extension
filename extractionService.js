/* ============================================================
   CSC Sahayak — Extraction Service
   Pipeline: Tesseract.js Browser OCR → Raw Text → Groq API
   Returns: { value, confidence (0–1), source: "groq_ocr" }
   ============================================================ */

const ExtractionService = (() => {
  "use strict";

  // ─── Groq Configuration ────────────────────────────────────
  const GROQ_API_KEY  = "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";
  const GROQ_MODEL    = "llama-3.3-70b-versatile";
  const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

  // ─── Field Label Mappings ──────────────────────────────────
  const FIELD_LABELS = {
    childName:           { en: "Child Name",            hi: "बच्चे का नाम" },
    dateOfBirth:         { en: "Date of Birth",         hi: "जन्म तिथि" },
    gender:              { en: "Gender",                 hi: "लिंग" },
    placeOfBirth:        { en: "Place of Birth",         hi: "जन्म स्थान" },
    fatherName:          { en: "Father's Name",          hi: "पिता का नाम" },
    motherName:          { en: "Mother's Name",          hi: "माता का नाम" },
    fatherAadhaar:       { en: "Father's Aadhaar",       hi: "पिता का आधार" },
    motherAadhaar:       { en: "Mother's Aadhaar",       hi: "माता का आधार" },
    hospitalName:        { en: "Hospital Name",          hi: "अस्पताल का नाम" },
    address:             { en: "Address",                hi: "पता" },
    district:            { en: "District",               hi: "जिला" },
    state:               { en: "State",                  hi: "राज्य" },
    applicantName:       { en: "Applicant Name",         hi: "आवेदक का नाम" },
    deceasedName:        { en: "Deceased Name",          hi: "मृतक का नाम" },
    dateOfDeath:         { en: "Date of Death",          hi: "मृत्यु तिथि" },
    causeOfDeath:        { en: "Cause of Death",         hi: "मृत्यु का कारण" },
    placeOfDeath:        { en: "Place of Death",         hi: "मृत्यु स्थान" },
    age:                 { en: "Age",                    hi: "आयु" },
    fatherOrSpouseName:  { en: "Father/Spouse Name",     hi: "पिता/पति का नाम" },
    applicantRelation:   { en: "Applicant Relation",     hi: "आवेदक का संबंध" },
    currentAddress:      { en: "Current Address",        hi: "वर्तमान पता" },
    permanentAddress:    { en: "Permanent Address",      hi: "स्थायी पता" },
    residenceSinceYear:  { en: "Residence Since",        hi: "निवास वर्ष से" },
    tehsil:              { en: "Tehsil",                  hi: "तहसील" },
    village:             { en: "Village",                 hi: "गाँव" },
    occupation:          { en: "Occupation",              hi: "व्यवसाय" },
    annualIncome:        { en: "Annual Income",           hi: "वार्षिक आय" },
    sourceOfIncome:      { en: "Source of Income",        hi: "आय का स्रोत" },
    caste:               { en: "Caste",                   hi: "जाति" },
    subCaste:            { en: "Sub-Caste",               hi: "उप-जाति" },
    category:            { en: "Category",                hi: "वर्ग" },
    bankAccountNumber:   { en: "Bank Account No.",        hi: "बैंक खाता नं." },
    ifscCode:            { en: "IFSC Code",               hi: "IFSC कोड" },
    bankName:            { en: "Bank Name",               hi: "बैंक का नाम" },
    branchName:          { en: "Branch Name",             hi: "शाखा का नाम" },
    husbandName:         { en: "Husband's Name",          hi: "पति का नाम" },
    dateOfHusbandDeath:  { en: "Husband's Death Date",    hi: "पति की मृत्यु तिथि" },
    aadhaarNumber:       { en: "Aadhaar Number",          hi: "आधार नंबर" },
    mobileNumber:        { en: "Mobile Number",           hi: "मोबाइल नंबर" },
    khasraNumber:        { en: "Khasra Number",           hi: "खसरा नंबर" },
    landArea:            { en: "Land Area",               hi: "भूमि क्षेत्रफल" },
    cropType:            { en: "Crop Type",               hi: "फसल का प्रकार" },
    headOfFamily:        { en: "Head of Family",          hi: "परिवार का मुखिया" },
    familyMembersCount:  { en: "Family Members",          hi: "परिवार के सदस्य" },
    gasConnection:       { en: "Gas Connection",          hi: "गैस कनेक्शन" },
    ward:                { en: "Ward",                    hi: "वार्ड" },
    farmerName:          { en: "Farmer Name",             hi: "किसान का नाम" },
    serviceType:         { en: "Service Type",            hi: "सेवा प्रकार" }
  };

  // ─── Step 1: OCR each document with Tesseract.js ──────────

  /**
   * Run Tesseract OCR on a base64-encoded image or PDF page.
   * Returns the recognised text string.
   */
  async function runTesseractOCR(base64, mimeType) {
    if (typeof Tesseract === "undefined") {
      console.warn("[ExtractionService] Tesseract not found on window, trying createWorker.");
      throw new Error("Tesseract.js not loaded");
    }

    // Strip the data-URI prefix if present
    const rawB64 = base64.includes(",") ? base64.split(",")[1] : base64;

    // Convert base64 → Blob → Object URL (Tesseract.recognize accepts a URL)
    const byteChars = atob(rawB64);
    const byteNums  = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob  = new Blob([byteNums], { type: mimeType || "image/jpeg" });
    const blobUrl = URL.createObjectURL(blob);

    try {
      // Tesseract.js v2 / v4 both expose Tesseract.recognize()
      const result = await Tesseract.recognize(blobUrl, "eng+hin", {
        logger: () => {} // suppress verbose logs
      });
      return (result.data && result.data.text) ? result.data.text.trim() : "";
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  // ─── Step 2: Build Groq prompt ────────────────────────────

  function buildGroqPrompt(ocrText, fieldsToExtract, serviceType) {
    const fieldDescriptions = fieldsToExtract
      .map(f => {
        const label = FIELD_LABELS[f] || { en: f, hi: f };
        return `  - "${f}": ${label.en} / ${label.hi}`;
      })
      .join("\n");

    return `You are a document data extraction assistant for Indian government services (service: ${serviceType || "general"}).

The following is the raw OCR text extracted from one or more uploaded documents:

--- OCR TEXT START ---
${ocrText || "(No text could be extracted — return null for all fields)"}
--- OCR TEXT END ---

Extract the following fields from the OCR text and return ONLY a valid JSON object.
Each key must be one of the field names listed below. Each value must be an object with:
  - "value": the extracted string (or null if not found / not applicable)
  - "confidence": a float from 0.0 to 1.0
      * 0.85–1.0  → the exact text appears literally in the OCR output
      * 0.60–0.84 → inferred or partially present in context
      * 0.30–0.59 → guessed from indirect clues
      * 0.00–0.29 → not found or too ambiguous

Fields to extract:
${fieldDescriptions}

Rules:
1. Return ONLY the JSON object. No explanation, no markdown fences, no extra text.
2. Every field key must appear in the output even if value is null.
3. Dates should be formatted as DD/MM/YYYY where possible.
4. Aadhaar numbers should be 12 digits, no spaces.
5. If the OCR text is in Hindi/Devanagari, translate field values to English where practical (names keep original spelling).

Example output format (do not copy these values):
{"childName":{"value":"Ravi Kumar","confidence":0.95},"dateOfBirth":{"value":"12/03/2022","confidence":0.90},"gender":{"value":"Male","confidence":0.85}}`;
  }

  // ─── Step 3: Call Groq API ────────────────────────────────

  async function getApiKey() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(["groqApiKey", "GROQ_API_KEY"], (items) => {
          const key = items.groqApiKey || items.GROQ_API_KEY || GROQ_API_KEY;
          resolve(key && String(key).trim() ? String(key).trim() : GROQ_API_KEY);
        });
      });
    }
    return GROQ_API_KEY;
  }

  async function callGroq(prompt) {
    const resolvedKey = await getApiKey();
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resolvedKey}`
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        messages:    [{ role: "user", content: prompt }],
        temperature: 0.1,   // Low temp for deterministic extraction
        max_tokens:  2048
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Groq API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    console.log("[ExtractionService] Groq raw response:", content);
    return content;
  }

  // ─── Step 4: Parse Groq's JSON response ──────────────────

  function parseGroqResponse(content, fieldsToExtract) {
    let parsed = null;

    // Try to extract JSON from the response (handles accidental markdown fences)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn("[ExtractionService] JSON parse failed:", e.message);
      }
    }

    const extractedFields = {};
    fieldsToExtract.forEach(key => {
      const raw = parsed && parsed[key];
      if (raw && typeof raw === "object" && raw.value !== undefined) {
        const rawValue      = raw.value;
        const rawConf       = typeof raw.confidence === "number" ? raw.confidence : 0;
        const trimmedValue  = typeof rawValue === "string" ? rawValue.trim() : null;
        extractedFields[key] = {
          value:      (trimmedValue === "" || trimmedValue === null || trimmedValue === "null") ? null : trimmedValue,
          confidence: Math.min(1, Math.max(0, rawConf)),
          source:     "groq_ocr"
        };
      } else {
        // Field missing from Groq response → treat as not found
        extractedFields[key] = { value: null, confidence: 0, source: "groq_ocr" };
      }
    });

    return extractedFields;
  }

  // ─── Step 5: Cross-document mismatch detection ──────────

  function detectMismatches(perDocFields, fieldsToExtract) {
    const mismatches = [];
    if (perDocFields.length < 2) return mismatches;

    fieldsToExtract.forEach(field => {
      if (!field.toLowerCase().includes("name") && !field.toLowerCase().includes("aadhaar")) return;

      const values = [];
      perDocFields.forEach((docResult, idx) => {
        if (docResult[field] && docResult[field].value) {
          values.push({ val: docResult[field].value, doc: `doc_${idx + 1}` });
        }
      });

      if (values.length >= 2) {
        for (let i = 0; i < values.length; i++) {
          for (let j = i + 1; j < values.length; j++) {
            const v1 = values[i].val.trim().toLowerCase();
            const v2 = values[j].val.trim().toLowerCase();
            if (v1 !== v2) {
              mismatches.push({
                field,
                doc1:     values[i].doc,
                val1:     values[i].val,
                doc2:     values[j].doc,
                val2:     values[j].val,
                severity: "warning"
              });
            }
          }
        }
      }
    });

    return mismatches;
  }

  // ─── Main Extraction Function ─────────────────────────────

  /**
   * Extract fields from uploaded documents using Tesseract OCR + Groq AI.
   *
   * @param {Array}    documents       — [{ docType, fileName, base64, mimeType }]
   * @param {Array}    fieldsToExtract — ["childName", "fatherName", ...]
   * @param {string}   serviceType     — "birth_certificate" etc.
   * @param {Function} onProgress      — callback(stage, message)
   * @returns {Promise<{ extractedFields, crossDocumentMismatches }>}
   */
  async function extractFields(documents, fieldsToExtract, serviceType, onProgress) {
    onProgress = onProgress || (() => {});

    try {
      const uploadedDocs = (documents || []).filter(d => d.base64 && d.mimeType);

      if (uploadedDocs.length === 0) {
        onProgress("no_docs", "कोई दस्तावेज़ अपलोड नहीं / No documents uploaded");
        return getManualEntryFields(fieldsToExtract);
      }

      // ── STAGE 1: Run Tesseract OCR on every uploaded document ──
      const ocrTexts      = [];
      const perDocFields  = []; // for mismatch detection per-doc later

      for (let i = 0; i < uploadedDocs.length; i++) {
        const doc = uploadedDocs[i];
        onProgress(
          "ocr",
          `OCR जारी है (${i + 1}/${uploadedDocs.length})... / Running OCR on document ${i + 1}/${uploadedDocs.length}...`
        );
        console.log(`[ExtractionService] Running OCR on doc ${i + 1}:`, doc.fileName, doc.mimeType);

        let text = "";
        try {
          text = await runTesseractOCR(doc.base64, doc.mimeType);
          console.log(`[ExtractionService] OCR doc ${i + 1} text (${text.length} chars):`, text.substring(0, 200));
        } catch (ocrErr) {
          console.warn(`[ExtractionService] OCR failed for doc ${i + 1}:`, ocrErr.message);
          // Still push empty string so Groq knows the doc exists
        }

        ocrTexts.push(`[Document ${i + 1}: ${doc.fileName || doc.docType}]\n${text}`);
      }

      const combinedOcrText = ocrTexts.join("\n\n---\n\n");

      // ── STAGE 2: Send to Groq ──────────────────────────────
      onProgress("groq", "Groq AI से जानकारी निकाली जा रही है... / Extracting via Groq AI...");
      console.log("[ExtractionService] Calling Groq with", fieldsToExtract.length, "fields");

      const prompt  = buildGroqPrompt(combinedOcrText, fieldsToExtract, serviceType);
      const content = await callGroq(prompt);

      // ── STAGE 3: Parse and normalise ─────────────────────
      onProgress("parsing", "परिणाम तैयार हो रहे हैं... / Preparing results...");
      const extractedFields = parseGroqResponse(content, fieldsToExtract);

      // For multi-doc mismatch detection, perform a per-doc Groq call only if
      // there are 2+ docs; otherwise skip (saves API quota).
      let crossDocumentMismatches = [];
      if (uploadedDocs.length >= 2) {
        for (let i = 0; i < ocrTexts.length; i++) {
          try {
            const singlePrompt  = buildGroqPrompt(ocrTexts[i], fieldsToExtract, serviceType);
            const singleContent = await callGroq(singlePrompt);
            perDocFields.push(parseGroqResponse(singleContent, fieldsToExtract));
          } catch (_) {
            perDocFields.push({});
          }
        }
        crossDocumentMismatches = detectMismatches(perDocFields, fieldsToExtract);
      }

      onProgress("complete", "✅ निष्कर्षण पूरा / Extraction complete");

      console.log("[ExtractionService] Final extractedFields:", extractedFields);
      console.log("[ExtractionService] Mismatches:", crossDocumentMismatches);

      return { extractedFields, crossDocumentMismatches };

    } catch (error) {
      console.error("[ExtractionService] Extraction error:", error);
      onProgress("error", `⚠️ त्रुटि — ${error.message}`);
      await new Promise(r => setTimeout(r, 3000));
      return getManualEntryFields(fieldsToExtract);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  function getManualEntryFields(fieldsToExtract) {
    const extractedFields = {};
    (fieldsToExtract || []).forEach(f => {
      extractedFields[f] = { value: "", confidence: 0.0, source: "manual" };
    });
    return { extractedFields, crossDocumentMismatches: [] };
  }

  function getFieldLabel(fieldKey) {
    return FIELD_LABELS[fieldKey] || { en: fieldKey, hi: fieldKey };
  }

  function getConfidenceLevel(confidence) {
    if (confidence >= 0.85) return "high";
    if (confidence >= 0.60) return "medium";
    return "low";
  }

  // ─── Public API ────────────────────────────────────────────
  return {
    extractFields,
    getManualEntryFields,
    getFieldLabel,
    getConfidenceLevel,
    FIELD_LABELS
  };
})();
