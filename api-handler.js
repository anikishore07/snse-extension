/**
 * api-handler.js (Debug Mode)
 * Validates data integrity before calling the API to diagnose 400 Errors.
 */

// Helper: Strip headers to get raw data
const cleanBase64 = (str) => {
  if (!str) return null;
  return str.replace(/^data:image\/\w+;base64,/, "");
};

// Helper: Get strict mime type
const getMimeType = (str) => {
  if (!str) return null;
  const match = str.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : "image/jpeg"; // Default fallback
};

export async function generateOutfitImage(outfitSelection) {
  console.log("🔍 Starting Pre-Flight Check...");

  // 1. Get Data
  const data = await chrome.storage.local.get([
      'apiKey', 'userHeadshot', 'userHeight', 'userEthnicity', 
      'userAge', 'userFit', 'userGender', 'userBodyType'
  ]);

  // CHECK 1: API Key
  if (!data.apiKey) {
      console.error("❌ API Key is missing.");
      throw new Error("No API Key found.");
  }
  console.log("✅ API Key present.");

  // CHECK 2: Validate Images
  const validateImage = (base64, name) => {
      if (!base64) {
          console.warn(`⚠️ Warning: ${name} is missing or null.`);
          return null;
      }
      if (base64.length < 100) {
          console.error(`❌ CRITICAL: ${name} seems corrupt (too short). Length: ${base64.length}`);
          return null;
      }
      if (!base64.startsWith("data:image")) {
          console.warn(`⚠️ Warning: ${name} might fail (missing data:image header).`);
      }
      console.log(`✅ ${name} looks valid. Size: ~${Math.round(base64.length / 1024)}KB`);
      return base64;
  };

  const validHeadshot = validateImage(data.userHeadshot, "Headshot");
  const validTop = validateImage(outfitSelection.top.image, "Top");
  const validBottom = validateImage(outfitSelection.bottom.image, "Bottom");
  const validShoes = validateImage(outfitSelection.shoes.image, "Shoes");

  // 3. Construct Payload Parts
  const fileToPart = (base64String) => {
      if (!base64String) return null;
      return {
          inlineData: {
              mimeType: getMimeType(base64String) || "image/jpeg",
              data: cleanBase64(base64String)
          }
      };
  };

  // Filter out nulls so we don't send "empty" parts to Google
  const imageParts = [
      fileToPart(validHeadshot),
      fileToPart(validTop),
      fileToPart(validBottom),
      fileToPart(validShoes)
  ].filter(p => p !== null);

  if (imageParts.length === 0) {
      throw new Error("❌ Validation Failed: No valid images to send.");
  }

  console.log(`📦 Packaging ${imageParts.length} images for API...`);

  // 4. The Endpoint (Gemini 3 Pro Image)
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${data.apiKey}`;

  const promptText = `Generate a photorealistic 8k fashion photo.
  Subject: ${data.userAge || "25"} year old ${data.userEthnicity} ${data.userGender}.
  Body: ${data.userHeight}, ${data.userBodyType}.
  Fit Preference: ${data.userFit}.
  Wearing the items in the reference images. return ONLY image file inline`;

  const requestBody = {
      contents: [{
          parts: [
              { text: promptText },
              ...imageParts
          ]
      }]
  };

  // 5. Send
  console.log("🚀 Sending Request...");
  const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
  });

  // 6. Detailed Error Reporting
  if (!response.ok) {
      const errorText = await response.text();
      console.error("🛑 API REJECTION DETAILS:", errorText);
      
      let errorMsg = `API Error ${response.status}`;
      try {
          const json = JSON.parse(errorText);
          if (json.error && json.error.message) {
              errorMsg += `: ${json.error.message}`;
          }
          if (json.error && json.error.details) {
              console.error("Deep Details:", json.error.details);
          }
      } catch(e) {}
      
      throw new Error(errorMsg);
  }

  const result = await response.json();
  console.log("Gemini Raw:", JSON.stringify(result, null, 2));
  
  // Smart Parsing: Hunt for the image
  const parts = result.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData);
  
  // Handle Success: If image part found, construct and return Base64 data URL
  if (imgPart) {
    return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
  }
  
  // Handle Failure (Smart Fallback): Look for text part to provide specific error
  const textPart = parts.find(p => p.text);
  if (textPart) {
    throw new Error("Model returned text only: " + textPart.text);
  }
  
  throw new Error("Model returned 200 OK but no image or text found.");
}