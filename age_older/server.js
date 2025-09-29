import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '.env');
console.log('[startup] env path:', envPath);

// Try to load .env file
dotenv.config({ path: envPath });

// Fallback: manually parse .env if dotenv failed
if (!process.env.GOOGLE_API_KEY) {
  try {
    const fs = await import('fs');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  } catch (e) {
    console.log('[startup] Could not load .env file:', e.message);
  }
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const PORT = process.env.PORT || 3000;

console.log('[startup] GOOGLE_API_KEY loaded:', !!GOOGLE_API_KEY);
console.log('[startup] env keys snapshot:', Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('PUBLIC') || k.includes('PORT')).reduce((acc, k) => ({ ...acc, [k]: '(set)' }), {}));

const app = express();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Serve static files
app.use(express.static('public'));

// Build a local prompt for age progression
function buildPrompt(years) {
  const magnitude = Math.abs(years);
  if (years > 0) {
    return `Photorealistic image-to-image face aging by ${magnitude} years. Preserve the person's identity, ethnicity, facial structure, pose, framing, and simple background. Add natural aging: subtle skin texture changes, fine lines, slight volume changes, and gentle graying only as age-appropriate. Avoid artifacts, distortions, extra features, accessories, makeup, or tattoos that were not present. Keep lighting consistent. High fidelity, detailed yet realistic.`;
  }
  return `Photorealistic image-to-image face rejuvenation by ${magnitude} years (younger). Preserve the person's identity, ethnicity, facial structure, pose, framing, and simple background. Reduce signs of aging naturally: smoother skin texture, fewer fine lines, slightly fuller features appropriate for ${magnitude} years younger. Avoid artifacts, distortions, or changing pose, and do not add accessories, makeup, or tattoos. Keep lighting consistent. High fidelity, realistic.`;
}

// Build dynamic country-era specific prompts based on user input
function buildEraPrompt(eraLabel, countryLabel = '', activityLabel = '') {
  const safeEra = String(eraLabel || '').trim();
  const safeCountry = String(countryLabel || '').trim();
  const safeActivity = String(activityLabel || '').trim();
  
  // Dynamic prompt based on user's specific selections
  let dynamicPrompt = `Transform this person into ${safeEra} era in ${safeCountry}. 

CULTURAL CONTEXT: Set the scene in ${safeCountry} during the ${safeEra} period. Research authentic cultural elements, traditional clothing, historical architecture, and period-appropriate activities for this specific country and era combination.

CLOTHING & STYLING: Dress the person in authentic ${safeEra} clothing appropriate for ${safeCountry}. Include period-accurate fabrics, colors, cuts, accessories, hairstyles, and cultural elements specific to this country and era.

ENVIRONMENT & SETTING: Place the person in a historically accurate ${safeEra} setting in ${safeCountry}. Include iconic landmarks, architecture, landscapes, and cultural elements that would be authentic to this specific time and place.`;

  // Add activity-specific instructions if provided
  if (safeActivity) {
    dynamicPrompt += `

ACTIVITY & POSE: Show the person engaged in "${safeActivity}" - an authentic activity for the ${safeEra} era in ${safeCountry}. The person should be naturally performing this activity with appropriate tools, equipment, and setting. Make the activity look realistic and era-appropriate.`;
  }

  dynamicPrompt += `

PHOTOGRAPHIC STYLE: Match the photographic technology and aesthetic of the ${safeEra} era. Use appropriate lighting, color grading, and film effects that would be authentic to that time period.

AUTHENTICITY: Ensure all elements - clothing, setting, activities, and cultural context - are historically accurate for ${safeEra} in ${safeCountry}. The person should appear naturally integrated into this historical setting.

PRESERVE IDENTITY: Keep the person's facial features, age, and identity intact while transforming their clothing, setting, and cultural context to match the ${safeEra} era in ${safeCountry}.`;
  
  return dynamicPrompt;
}

// Removed hardcoded activities - now using dynamic prompts based on user input

// Call Google Gemini API for image-to-image generation
async function callImageApi({ imageBuffer, mimeType, prompt }) {
  const base64Image = imageBuffer.toString('base64');
  const imageBytes = Buffer.byteLength(base64Image, 'base64');
  
  console.log('[gemini] calling gemini-2.5-flash-image-preview for image-to-image', { mimeType, imageBytes, promptLen: prompt.length });
  
  // Use the correct image-to-image endpoint
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { 
            inline_data: { 
              mime_type: mimeType, 
              data: base64Image 
            } 
          }
        ]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      }
    })
  });
  
  console.log('[gemini] status:', response.status);
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.log('[gemini] error body:', errorBody);
    throw new Error(`Google API error: ${response.status} ${JSON.stringify(errorBody)}`);
  }
  
  const data = await response.json();
  console.log('[gemini] response keys:', Object.keys(data));
  
  // Check if we have candidates with content
  if (data.candidates && data.candidates.length > 0) {
    const candidate = data.candidates[0];
    console.log('[gemini] candidate keys:', Object.keys(candidate));
    
    if (candidate.content && candidate.content.parts) {
      console.log('[gemini] content parts count:', candidate.content.parts.length);
      
      for (let i = 0; i < candidate.content.parts.length; i++) {
        const part = candidate.content.parts[i];
        console.log(`[gemini] part ${i} keys:`, Object.keys(part));
        
        // Check for inline_data or inlineData
        if (part.inline_data && part.inline_data.data) {
          console.log('[gemini] Found image data in inline_data, length:', part.inline_data.data.length);
          return `data:${mimeType};base64,${part.inline_data.data}`;
        } else if (part.inlineData && part.inlineData.data) {
          console.log('[gemini] Found image data in inlineData, length:', part.inlineData.data.length);
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
  }
  
  console.log('[gemini] Full response:', JSON.stringify(data, null, 2));
  throw new Error('No image data found in response');
}

app.post("/api/age", upload.single("image"), async (req, res) => {
  try {
    const years = parseInt(req.body.years || "10", 10);
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    if (!Number.isFinite(years) || years < -50 || years > 50) {
      return res.status(400).json({ error: "years must be between -50 and 50" });
    }

    const prompt = buildPrompt(years);
    console.log("[api] /api/age", { years, mimeType: req.file.mimetype, size: req.file.size });
    const imageUrl = await callImageApi({ imageBuffer: req.file.buffer, mimeType: req.file.mimetype, prompt });

    res.json({ imageUrl, promptUsed: prompt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// New: Era styling endpoint (keeps age constant; changes clothing, hair, color grading)
app.post("/api/style", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    const era = String(req.body.era || "").trim();
    const country = String(req.body.country || "").trim();
    const activity = String(req.body.activity || "").trim();
    if (!era) return res.status(400).json({ error: "era is required" });

    const prompt = buildEraPrompt(era, country, activity);
    console.log("[api] /api/style", { era, country, activity, mimeType: req.file.mimetype, size: req.file.size });
    const imageUrl = await callImageApi({ imageBuffer: req.file.buffer, mimeType: req.file.mimetype, prompt });
    res.json({ imageUrl, promptUsed: prompt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server on ${PUBLIC_BASE_URL}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is in use, trying port 3001...`);
    app.listen(3001, () => {
      console.log(`Server on http://localhost:3001`);
    });
  } else {
    console.error(err);
  }
});
