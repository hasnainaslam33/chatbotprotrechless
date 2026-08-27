import OpenAI from 'openai';
import fs from 'fs/promises';
import { config } from '../config.js';
import { buildSystemPrompt, buildUserInput } from './prompt-builder.js';
import { fallbackAnswer } from './fallback-ai.js';
import { findUpload } from './storage.js';
import { cleanText } from '../utils/safe.js';

let client = null;

const imageMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const fileInputMimes = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'text/html',
  'text/xml',
  'application/xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

export function getClient() {
  if (!config.openaiApiKey) return null;
  if (!client) client = new OpenAI({ apiKey: config.openaiApiKey });
  return client;
}

export function extractOutputText(response) {
  if (response?.output_text) return response.output_text;
  if (Array.isArray(response?.output)) {
    return response.output
      .flatMap((item) => item.content || [])
      .map((content) => content.text || content.output_text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

export function parseJsonFromText(text) {
  const trimmed = String(text || '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonText = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    return null;
  }
}

function parseStructuredAnswer(text) {
  const result = {
    urgencyLevel: '',
    estimatedCost: '',
    aiReviewSummary: '',
    summary: '',
    likelyCauseCategories: [],
    recommendedNextSteps: [],
    questionsToAskOrInformationToGather: [],
    softCTA: '',
    disclaimer: '',
    whatICanSee: '',
    links: []
  };

  if (!text) return result;
  const json = parseJsonFromText(text);
  if (json && typeof json === 'object') {
    return {
      ...result,
      ...json,
      likelyCauseCategories: Array.isArray(json.likelyCauseCategories) ? json.likelyCauseCategories : [],
      recommendedNextSteps: Array.isArray(json.recommendedNextSteps) ? json.recommendedNextSteps : [],
      questionsToAskOrInformationToGather: Array.isArray(json.questionsToAskOrInformationToGather) ? json.questionsToAskOrInformationToGather : [],
      links: Array.isArray(json.links) ? json.links : []
    };
  }

  let currentKey = null;
  const sectionMap = {
    'urgency level': 'urgencyLevel',
    'estimated cost': 'estimatedCost',
    'ai review summary': 'aiReviewSummary',
    'summary': 'summary',
    'problem': 'summary',
    'description': 'summary',
    'likely cause categories': 'likelyCauseCategories',
    'recommended next steps': 'recommendedNextSteps',
    'questions to ask': 'questionsToAskOrInformationToGather',
    'questions to ask or information to gather': 'questionsToAskOrInformationToGather',
    'soft cta': 'softCTA',
    'disclaimer': 'disclaimer',
    'what i can see': 'whatICanSee',
    'links': 'links'
  };

  const lines = String(text || '').replace(/\r/g, '').split('\n');
  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const headingMatch = line.match(/^([A-Za-z0-9 /]+)\s*[:\-–]\s*(.*)$/);
    if (headingMatch) {
      const heading = headingMatch[1].toLowerCase().trim();
      const value = headingMatch[2].trim();
      if (sectionMap[heading]) {
        currentKey = sectionMap[heading];
        if (currentKey === 'links') {
          if (value) {
            const linkMatch = value.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
              result.links.push({ text: linkMatch[1], href: linkMatch[2] });
            }
          }
        } else if (Array.isArray(result[currentKey])) {
          if (value) {
            result[currentKey].push(value);
          }
        } else {
          result[currentKey] = value;
        }
        continue;
      }
    }

    const listMatch = line.match(/^[\-•*]\s+(.*)$/);
    if (listMatch && currentKey) {
      const item = listMatch[1].trim();
      if (Array.isArray(result[currentKey])) {
        result[currentKey].push(item);
      } else {
        result[currentKey] += (result[currentKey] ? ' ' : '') + item;
      }
      continue;
    }

    if (currentKey) {
      if (Array.isArray(result[currentKey])) {
        result[currentKey].push(line);
      } else {
        result[currentKey] += (result[currentKey] ? ' ' : '') + line;
      }
    }
  }

  return result;
}

function isImageFile(file) {
  return imageMimes.has(String(file?.mimeType || '').toLowerCase());
}

function isVideoFile(file) {
  return String(file?.mimeType || '').toLowerCase().startsWith('video/');
}

function isFileInput(file) {
  const mime = String(file?.mimeType || '').toLowerCase();
  return fileInputMimes.has(mime) || mime.startsWith('text/');
}

async function readFileAsBase64(file) {
  if (!file?.path) return null;
  const buffer = await fs.readFile(file.path);
  return {
    base64: buffer.toString('base64'),
    bytes: buffer.length
  };
}

export async function buildMultimodalContent({ textInput, uploadedFiles }) {
  const content = [{ type: 'input_text', text: textInput }];
  const notes = [];
  let imageCount = 0;
  let fileCount = 0;
  let totalFileBytes = 0;

  for (const file of uploadedFiles) {
    try {
      const mime = String(file.mimeType || '').toLowerCase();

      if (isImageFile(file)) {
        if (imageCount >= config.maxVisionImages) {
          notes.push(`Skipped image "${file.originalName}" because the per-request image limit was reached.`);
          continue;
        }
        const data = await readFileAsBase64(file);
        if (!data) continue;
        if (data.bytes > config.maxVisionImageMb * 1024 * 1024) {
          notes.push(`Skipped image "${file.originalName}" because it is larger than ${config.maxVisionImageMb} MB.`);
          continue;
        }
        content.push({
          type: 'input_image',
          image_url: `data:${mime};base64,${data.base64}`,
          detail: config.visionDetail
        });
        imageCount += 1;
        continue;
      }

      if (isVideoFile(file)) {
        notes.push(`Uploaded video "${file.originalName}" was stored. Raw video is not sent directly to the AI. The browser extracts still frames from videos and uploads them as image files when supported; those frames are reviewed if present.`);
        continue;
      }

      if (isFileInput(file)) {
        const data = await readFileAsBase64(file);
        if (!data) continue;
        const nextTotal = totalFileBytes + data.bytes;
        if (fileCount >= config.maxInputFiles || nextTotal > config.maxInputFileBytes) {
          notes.push(`Skipped document "${file.originalName}" because the file input limit was reached.`);
          continue;
        }
        content.push({
          type: 'input_file',
          filename: file.originalName || 'uploaded-file',
          file_data: `data:${mime};base64,${data.base64}`,
          detail: mime === 'application/pdf' ? config.fileDetail : undefined
        });
        fileCount += 1;
        totalFileBytes = nextTotal;
      }
    } catch (error) {
      notes.push(`Could not attach "${file.originalName}" to the AI request: ${error.message}`);
    }
  }

  if (notes.length) {
    content.push({
      type: 'input_text',
      text: `Upload processing notes:\n${notes.map((note) => `- ${note}`).join('\n')}`
    });
  }

  return { content, imageCount, fileCount, notes };
}

export async function createAiAnswer({ module, userType, messages = [], formContext = {}, uploadedFileIds = [] }) {
  const latest = messages[messages.length - 1]?.content || '';
  const uploadedFiles = [];
  for (const id of uploadedFileIds.slice(0, 20)) {
    const upload = await findUpload(cleanText(id, 100));
    if (upload) uploadedFiles.push(upload);
  }

  const openai = getClient();
  if (!openai) {
    return {
      mode: 'fallback',
      answer: fallbackAnswer({ module, message: latest, userType, formContext }),
      model: 'local-fallback'
    };
  }

  const instructions = buildSystemPrompt({ module, userType });
  const textInput = buildUserInput({ messages, formContext, uploadedFiles });
  const { content, imageCount, fileCount } = await buildMultimodalContent({ textInput, uploadedFiles });

  try {
    const response = await openai.responses.create({
      model: config.openaiModel,
      instructions,
      input: [
        {
          role: 'user',
          content
        }
      ],
      temperature: config.aiTemperature
    });

    const answer = extractOutputText(response) || fallbackAnswer({ module, message: latest, userType, formContext });
    return {
      mode: imageCount || fileCount ? 'openai-multimodal' : 'openai',
      answer,
      structuredAnswer: parseStructuredAnswer(answer),
      model: config.openaiModel,
      responseId: response.id || null
    };
  } catch (error) {
    console.error('OpenAI request failed:', error);
    return {
      mode: 'openai-error-fallback',
      answer: `${fallbackAnswer({ module, message: latest, userType, formContext })}\n\nAI provider error: ${error.message}. Check that the model supports image/file input, your API key has billing enabled, and uploaded files are under the configured size limits.`,
      model: config.openaiModel
    };
  }
}
