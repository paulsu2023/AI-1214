
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_ANALYSIS, GEMINI_MODEL_IMAGE, GEMINI_MODEL_TTS, VOICE_OPTIONS, GEMINI_MODEL_ANALYSIS_FALLBACK, GEMINI_MODEL_IMAGE_FALLBACK, TARGET_MARKETS, PLATFORMS } from "../constants";
import { ProductData, AspectRatio, ImageResolution, SceneDraft } from "../types";

// --- API KEY MANAGEMENT ---
let customApiKey: string | null = localStorage.getItem('gemini_api_key');

export const setCustomApiKey = (key: string) => {
  customApiKey = key;
  localStorage.setItem('gemini_api_key', key);
};

export const verifyApiKey = async (key: string): Promise<boolean> => {
  try {
    const client = new GoogleGenAI({ apiKey: key });
    // Use a lightweight model to verify the key
    await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: 'ping' }] }
    });
    return true;
  } catch (e) {
    console.error("API Key Verification Failed:", e);
    return false;
  }
};

// Helper to ensure API Key exists or guide user to select it
const getClient = async (): Promise<GoogleGenAI> => {
  // 1. Priority: User Custom Key
  if (customApiKey) {
    return new GoogleGenAI({ apiKey: customApiKey });
  }

  // 2. Fallback: AI Studio Internal Auth
  // @ts-ignore
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
       // @ts-ignore
       await window.aistudio.openSelectKey();
    }
  }
  
  // 3. Fallback: Env Var
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Retry Helper
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const msg = error.message || '';
    const status = error.status || error.code;
    
    // Check for overloaded (503), internal server error (500), or rate limit (429)
    const isOverloaded = msg.includes('overloaded') || status === 503;
    const isInternalError = status === 500;
    // Enhanced 429 check (Resource Exhausted)
    const isRateLimit = status === 429 || msg.includes('exhausted') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
    
    // We retry 429s a few times with backoff, but usually it requires model switching
    if (retries > 0 && (isOverloaded || isInternalError || isRateLimit)) {
      console.warn(`Gemini API Warning: ${msg} (Status: ${status}). Retrying in ${delay}ms...`);
      await sleep(delay);
      return withRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Helper: Check if error is a quota error
const isQuotaError = (error: any) => {
    const msg = error.message || '';
    const status = error.status || error.code;
    return status === 429 || msg.includes('exhausted') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
};

// Helper: Convert Raw PCM to WAV
const pcmToWav = (base64PCM: string, sampleRate: number = 24000): string => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create WAV headers
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len, true); // ChunkSize
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, len, true); // Subchunk2Size

  // Combine header and data
  const headerBytes = new Uint8Array(wavHeader);
  const wavBytes = new Uint8Array(headerBytes.length + bytes.length);
  wavBytes.set(headerBytes);
  wavBytes.set(bytes, headerBytes.length);

  // Convert to Base64
  let binary = '';
  // Process in chunks to avoid stack overflow
  const chunkSize = 8192;
  for (let i = 0; i < wavBytes.length; i += chunkSize) {
    const chunk = wavBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Client-side Veo Manifest Construction (Instant)
const formatVeoManifest = (scene: any): string => {
    const manifest = {
        veo_production_manifest: {
            version: "4.0",
            shot_summary: scene.visual_en || scene.visual,
            description: "Industrial-grade production manifest.",
            global_settings: {
                input_assets: { reference_image: "Start Frame" },
                output_specifications: {
                    resolution: "1080p",
                    aspect_ratio_lock: { enabled: true },
                    color_space: "Rec. 2020",
                    dynamic_range: "HDR"
                },
                rendering_pipeline: {
                    engine: "Physically-Based Rendering (PBR)",
                    light_transport: "Path Tracing"
                }
            },
            director_mandates: {
                positive_mandates: [
                    "The video MUST start with the provided start frame.",
                    "Maintenance of texture, lighting, and resolution from the start frame is critical at 0s, 2s, 4s, and 6s."
                ],
                negative_mandates: [
                    "NO smooth or stable camera motion if action is chaotic.",
                    "NO morphing of character features.",
                    "NO lowering of resolution or quality."
                ]
            },
            timeline_script: [
                {
                    time_start: "0.0s",
                    time_end: "8.0s",
                    description: scene.visual_en || scene.visual,
                    elements: {
                        visuals: {
                            subject_action: scene.action_en || scene.action,
                            background_action: "Consistent environment",
                            consistency_check: "At 0s, 2s, 4s, 6s: Ensure absolute consistency."
                        },
                        camera: {
                            primary_movement: scene.camera_en || scene.camera,
                            movement_description: "Cinematic execution",
                            speed: "Normal"
                        },
                        audio_scape: {
                            dialogue: { transcript: scene.dialogue },
                            sfx: ["Ambient noise"],
                            ambient: "Natural room tone"
                        }
                    }
                }
            ]
        }
    };
    return JSON.stringify(manifest, null, 2);
};

// 1. Multi-Agent Product Analysis & Script Generation
export const analyzeProduct = async (
  product: ProductData, 
  sceneCount: number
): Promise<any> => {
  const client = await getClient();
  const assignedVoice = VOICE_OPTIONS[Math.floor(Math.random() * VOICE_OPTIONS.length)];

  // --- ENGINEERING AGENT: CONTEXT RESOLUTION ---
  const platform = PLATFORMS.find(p => p.value === product.platform) || PLATFORMS[0];
  
  // Resolve Market/Culture
  let market = TARGET_MARKETS.find(m => m.value === product.targetMarket) || TARGET_MARKETS[0];
  
  // Force Domestic Context Override
  if (platform.scope === 'domestic') {
      market = TARGET_MARKETS.find(m => m.value === 'CN')!;
  }

  // Platform-Specific Style Instructions
  let platformInstruction = "";
  if (platform.value === 'douyin' || platform.value === 'tiktok') {
      platformInstruction = "Style: Fast-paced, high-energy, strong hook in first 3 seconds, entertainment-focused.";
  } else if (platform.value === 'amazon' || platform.value === 'jd' || platform.value === 'tmall' || platform.value === 'taobao') {
      platformInstruction = "Style: Professional, feature-focused, clear demonstration, trust-building, problem/solution structure.";
  } else if (platform.value === 'temu' || platform.value === 'pdd' || platform.value === 'aliexpress') {
      platformInstruction = "Style: Value-focused, discount-emphasized, urgent call to action, viral gadget style.";
  }

  const systemInstruction = `
  You are an elite E-commerce Creative Director Agent specialized for **${platform.label}** targeting the **${market.label}** market.
  
  **CONTEXT MATRIX**:
  - Platform: ${platform.label} (${platform.scope})
  - Target Market: ${market.label}
  - Primary Language: ${market.language}
  - Cultural Context: ${market.culture}
  - Video Style: ${platformInstruction}
  
  **OBJECTIVE**:
  Generate a high-conversion video script based on the provided product images/video.

  **CRITICAL RULES FOR LANGUAGE & LOCALIZATION**:
  1. **User Interface Language (Visual/Action/Camera fields)**: 
     - MUST be **Chinese (中文)** for the user to read and understand.
  2. **AI Generation Language (visual_en, action_en, camera_en)**: 
     - MUST be **English** (High quality, detailed) for the Video Generation Model.
  3. **Dialogue Language**:
     - MUST be **${market.language}**. 
     - If Platform is Domestic (Douyin, Taobao, etc.), this MUST be Chinese.
     - If Platform is Global (TikTok, Amazon), this MUST be the local language of ${market.label} (e.g., Thai for Thailand, English for US).
  
  **CRITICAL ETHNICITY CONSTRAINT**:
  - IF Target Market is 'CN' (China) OR Platform is Domestic (Douyin, Taobao):
    **ALL generated descriptions of human models (in visual_en) MUST explicitly specify 'Chinese model', 'Asian ethnicity', or 'East Asian features'.**
    **DO NOT** generate descriptions implying Western, Caucasian, or ambiguous ethnicity for the Chinese market.
    Example Correct: "A stylish young Chinese woman holding the product..."
    Example Incorrect: "A blonde woman...", "A person..."
  
  **OUTPUT FORMAT**:
  JSON Only. Scenes array must contain:
  - visual: (Chinese)
  - visual_en: (English - Cinematic description for Veo)
  - action: (Chinese)
  - action_en: (English)
  - camera: (Chinese)
  - camera_en: (English)
  - dialogue: (Native ${market.language})
  - dialogue_cn: (Chinese Translation)
  `;

  // Prepare content parts
  const parts: any[] = [];
  
  // Images
  [...product.images, ...product.modelImages, ...product.backgroundImages].forEach(base64 => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
  });

  if (product.referenceVideo) {
      parts.push({ inlineData: { mimeType: product.referenceVideo.mimeType, data: product.referenceVideo.data } });
  }

  let promptText = `Generate a ${sceneCount} scene script for ${product.title}. Platform: ${platform.label}. Market: ${market.label}.`;
  
  if (product.referenceVideo) {
      promptText += ` Analyze the Reference Video for structure. Ignore scene count, determine optimal count based on video analysis.`;
  }
  
  promptText += `
  Description: ${product.description || "Not specified"}
  Ideas: ${product.creativeIdeas || "Open"}
  `;

  parts.push({ text: promptText });

  const generationConfig: any = {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productType: { type: Type.STRING },
          sellingPoints: { type: Type.STRING },
          targetAudience: { type: Type.STRING },
          hook: { type: Type.STRING },
          painPoints: { type: Type.STRING },
          strategy: { type: Type.STRING },
          assignedVoice: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                visual: { type: Type.STRING },
                visual_en: { type: Type.STRING },
                action: { type: Type.STRING },
                action_en: { type: Type.STRING },
                camera: { type: Type.STRING },
                camera_en: { type: Type.STRING },
                dialogue: { type: Type.STRING },
                dialogue_cn: { type: Type.STRING },
              },
              required: ["id", "visual", "visual_en", "action", "action_en", "camera", "camera_en", "dialogue", "dialogue_cn"]
            }
          }
        }
      }
  };

  let response: GenerateContentResponse;
  
  try {
      // Try Primary Model (Pro)
      response = await withRetry(() => client.models.generateContent({
        model: GEMINI_MODEL_ANALYSIS,
        contents: { parts },
        config: generationConfig
      }));
  } catch (error: any) {
      if (isQuotaError(error)) {
          console.warn("Primary model quota exhausted. Switching to Fallback (Flash)...");
          try {
             response = await withRetry(() => client.models.generateContent({
                model: GEMINI_MODEL_ANALYSIS_FALLBACK,
                contents: { parts },
                config: generationConfig
             }));
          } catch (fallbackError) {
             throw fallbackError;
          }
      } else {
          throw error;
      }
  }

  let jsonText = response.text || '{}';
  jsonText = jsonText.replace(/```json\s*/g, '').replace(/```/g, '').trim();

  try {
    const result = JSON.parse(jsonText);
    result.assignedVoice = assignedVoice; 
    
    // INSTANTLY construct the Veo Manifest JSON using the English fields
    // This removes the need for a second API call and eliminates "Simple Prompt"
    result.scenes = result.scenes.map((s: any) => ({
        ...s,
        prompt: {
            imagePrompt: formatVeoManifest(s) // Auto-populate with Optimized JSON
        }
    }));

    return result;
  } catch (e) {
    console.error("JSON Parse Error:", e);
    throw new Error("无法解析 AI 返回的分析结果，请重试。");
  }
};

// 2. Image Generation (Standard + Refinement Support)
export const generateImage = async (
  prompt: string, 
  aspectRatio: AspectRatio,
  resolution: ImageResolution,
  referenceImages: string[] = [] 
): Promise<string> => {
  const client = await getClient();
  
  // Parse Prompt Logic
  // If editing, 'prompt' is the modification instruction (e.g. "Make the background blue").
  // If generating from scratch, 'prompt' might be the JSON manifest.
  let textPrompt = prompt;
  
  // Check if it's the Veo Manifest JSON, extract visual description
  if (prompt.trim().startsWith('{')) {
      try {
          const json = JSON.parse(prompt);
          const visual = json.veo_production_manifest?.timeline_script?.[0]?.elements?.visuals?.subject_action;
          const camera = json.veo_production_manifest?.timeline_script?.[0]?.elements?.camera?.primary_movement;
          const desc = json.veo_production_manifest?.description || json.veo_production_manifest?.shot_summary;
          
          if (visual) {
              textPrompt = `${camera ? camera + ' shot of ' : ''}${visual}. ${desc || ''} photorealistic, 8k, cinematic lighting.`;
          }
      } catch (e) {
          // Keep raw textPrompt if not valid JSON
      }
  }

  const parts: any[] = [{ text: textPrompt }];
  
  // Prioritize Reference Images
  // If this is a REFINE/EDIT operation, the 'referenceImages' array usually contains the [sourceImage, ...others]
  // We want the source image to be the primary driver.
  referenceImages.slice(0, 5).forEach(ref => {
    parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: ref } });
  });

  try {
    const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
        model: GEMINI_MODEL_IMAGE,
        contents: { parts },
        config: {
            imageConfig: { aspectRatio: aspectRatio as any, imageSize: resolution as any }
        }
    }));
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch(error: any) {
      if (isQuotaError(error)) {
          // Fallback to Flash Image (does not support imageSize)
          const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
            model: GEMINI_MODEL_IMAGE_FALLBACK,
            contents: { parts },
            config: { imageConfig: { aspectRatio: aspectRatio as any } }
          }));
          return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
      }
      throw error;
  }
};

// 3. Audio Generation (TTS)
export const generateSpeech = async (
    text: string,
    voiceName: string = 'Kore'
): Promise<string> => {
    const client = await getClient();
    const validVoice = VOICE_OPTIONS.includes(voiceName) ? voiceName : 'Kore';
    const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
        model: GEMINI_MODEL_TTS,
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: validVoice } } },
        },
    }));
    const base64PCM = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64PCM) throw new Error("TTS 服务未返回音频数据。");
    return pcmToWav(base64PCM);
};

// 4. Regenerate Veo Prompt (Updated Logic for Speed)
export const regenerateVeoPrompt = async (scene: SceneDraft): Promise<string> => {
  const client = await getClient();

  // Use Flash model for speed when regenerating/updating prompt based on user edits
  const systemInstruction = `
  You are an expert prompt engineer. Convert the user's scene details into the "veo_production_manifest" JSON format (Version 4.0).
  
  Input:
  Visual: ${scene.visual}
  Action: ${scene.action}
  Camera: ${scene.camera}
  Dialogue: ${scene.dialogue}
  
  Output: Return ONLY the raw JSON string. Translate Chinese inputs to English.
  Structure: { "veo_production_manifest": { ... } }
  Mandates: Ensure consistency check mandates are included for 0s, 2s, 4s, 6s.
  `;

  const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
    model: GEMINI_MODEL_ANALYSIS_FALLBACK, // USE FLASH FOR SPEED
    contents: { parts: [{ text: "Generate JSON" }] },
    config: {
      systemInstruction,
      responseMimeType: "application/json"
    }
  }));

  let jsonText = response.text || '{}';
  jsonText = jsonText.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  return jsonText;
};
