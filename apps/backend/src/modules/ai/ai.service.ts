import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { SYSTEM_GUIDES, SYSTEM_OVERVIEW, type SystemGuide } from './ai.knowledge.js';
import type { ChatMessageInput } from './ai.validators.js';

interface ChatResponse {
  reply: string;
  suggestedRoutes: { label: string; route: string }[];
  provider: 'gemini' | 'local_knowledge';
}

export const aiService = {
  async ask(input: ChatMessageInput, userRoles: string[] = []): Promise<ChatResponse> {
    const query = input.message.trim();

    // 1. Try Gemini API if key is configured
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== '') {
      try {
        const geminiResponse = await callGeminiAPI(query, input.history ?? [], userRoles);
        if (geminiResponse) {
          const suggestedRoutes = extractSuggestedRoutes(geminiResponse, query);
          return {
            reply: geminiResponse,
            suggestedRoutes,
            provider: 'gemini',
          };
        }
      } catch (err: any) {
        logger.warn({ err: err?.message }, '[AI] Gemini API failed, falling back to local ERP knowledge base');
      }
    }

    // 2. Fallback: Deterministic ERP Knowledge Engine (ALWAYS succeeds)
    const localAnswer = answerFromLocalKnowledge(query, userRoles);
    return {
      reply: localAnswer.text,
      suggestedRoutes: localAnswer.routes,
      provider: 'local_knowledge',
    };
  },
};

/**
 * Call Gemini 2.0 Flash via standard REST API
 */
async function callGeminiAPI(
  userQuery: string,
  history: { role: string; content: string }[],
  userRoles: string[],
): Promise<string | null> {
  const apiKey = env.GEMINI_API_KEY!;
  // Use stable model identifier
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Prepare system knowledge text
  const guidesText = SYSTEM_GUIDES.map(
    (g) => `### Feature: ${g.topic} (Route: ${g.route})
${g.summary}
${g.requiredRole ? `Required Role: ${g.requiredRole}` : ''}
Steps:
${g.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`,
  ).join('\n\n');

  const systemInstruction = `${SYSTEM_OVERVIEW}

Current user's active roles: [${userRoles.join(', ') || 'STAFF'}].
Tailor your answers so they are helpful for someone with these roles, and clarify permissions if an action requires other roles.

Complete ERP Features Knowledge Base:
${guidesText}`;

  // Map conversation history
  const contents = [
    ...history.slice(-6).map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    })),
    {
      role: 'user',
      parts: [{ text: userQuery }],
    },
  ];

  const payload = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (HTTP ${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return candidate ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────
// SYNONYM MAP: Maps common alternative words to core keywords
// This ensures that short or colloquial queries still match.
// ─────────────────────────────────────────────────────────────
const SYNONYM_MAP: Record<string, string[]> = {
  'organization': ['organization', 'organisation', 'hospital details', 'hospital profile', 'branch', 'department'],
  'org': ['organization', 'hospital profile', 'branch'],
  'hospital': ['organization', 'hospital details', 'hospital profile', 'branch'],
  'profile': ['organization', 'hospital profile'],
  'admit': ['admission', 'ipd', 'inpatient', 'admit patient', 'bed'],
  'admission': ['admit', 'ipd', 'inpatient', 'admit patient', 'bed'],
  'ipd': ['admission', 'admit', 'inpatient', 'bed', 'ward', 'discharge'],
  'inpatient': ['admission', 'admit', 'ipd', 'bed', 'ward'],
  'lab': ['laboratory', 'lab test', 'lab order', 'lab results', 'test catalog'],
  'laboratory': ['lab', 'lab test', 'lab order', 'lab results', 'test catalog'],
  'test': ['lab test', 'lab order', 'diagnostic', 'test catalog'],
  'result': ['lab results', 'enter results', 'test value'],
  'sample': ['collect sample', 'specimen', 'sample collection'],
  'verify': ['verify lab', 'verify results', 'approve lab', 'verify order'],
  'medicine': ['pharmacy', 'drug', 'medication', 'stock', 'batch'],
  'drug': ['medicine', 'pharmacy', 'medication'],
  'stock': ['pharmacy stock', 'inventory', 'adjust stock', 'edit stock', 'batch stock'],
  'inventory': ['stock', 'pharmacy stock', 'batch'],
  'dispense': ['pharmacy queue', 'sell medicine', 'rx', 'prescription dispense'],
  'bill': ['billing', 'invoice', 'payment', 'receipt'],
  'invoice': ['billing', 'bill', 'payment', 'receipt'],
  'payment': ['billing', 'invoice', 'collect payment', 'receipt'],
  'cash': ['cash closing', 'cash register', 'finance', 'daily cash'],
  'finance': ['accounts', 'ledger', 'expense', 'income', 'cash closing'],
  'expense': ['finance', 'operational expense', 'accounts'],
  'user': ['users', 'staff', 'roles', 'permissions', 'invite user'],
  'staff': ['users', 'roles', 'invite user'],
  'role': ['roles', 'permissions', 'user management'],
  'permission': ['roles', 'permissions', 'user management'],
  'appointment': ['book appointment', 'schedule', 'doctor slot', 'queue token'],
  'schedule': ['appointment', 'book appointment', 'doctor slot'],
  'consultation': ['doctor', 'opd', 'prescription', 'clinical notes', 'vitals', 'diagnosis'],
  'doctor': ['consultation', 'opd', 'prescription', 'clinical notes'],
  'opd': ['consultation', 'doctor', 'outpatient'],
  'prescription': ['consultation', 'doctor', 'dispense', 'rx'],
  'patient': ['register', 'add patient', 'uhid', 'new patient', 'registration'],
  'register': ['patient', 'add patient', 'new patient', 'registration'],
  'attachment': ['document', 'upload', 'patient files', 'scan'],
  'document': ['attachment', 'upload', 'patient files'],
  'upload': ['attachment', 'document', 'patient files'],
  'supplier': ['vendor', 'purchase', 'purchase order', 'grn'],
  'purchase': ['supplier', 'purchase order', 'receive purchase', 'grn'],
  'vendor': ['supplier', 'purchase', 'purchase order'],
  'ward': ['ipd', 'bed', 'room', 'location', 'ipd location'],
  'bed': ['ipd', 'ward', 'room', 'location', 'ipd location', 'admission'],
  'room': ['ipd', 'ward', 'bed', 'location'],
  'discharge': ['ipd bill', 'discharge patient', 'ipd billing'],
  'barcode': ['print barcode', 'medicine', 'batch'],
  'offline': ['sync', 'internet', 'dexie', 'network'],
  'sync': ['offline', 'internet', 'dexie', 'network'],
  'pricing': ['ipd pricing', 'bed pricing', 'rate', 'room pricing', 'ward'],
  'price': ['pricing', 'ipd pricing', 'bed pricing', 'rate'],
};

/**
 * Built-in Semantic Search & Knowledge Engine
 * Uses synonym expansion + tokenized scoring for robust matching.
 */
function answerFromLocalKnowledge(query: string, userRoles: string[]) {
  const lower = query.toLowerCase().trim();
  const STOP_WORDS = new Set([
    'how', 'do', 'i', 'to', 'the', 'a', 'an', 'in', 'of', 'for', 'and', 'or',
    'can', 'we', 'is', 'what', 'where', 'this', 'that', 'it', 'me', 'my', 'about',
    'tell', 'show', 'please', 'help', 'want', 'need', 'know', 'explain', 'give',
    'get', 'go', 'find', 'use', 'does', 'will', 'would', 'could', 'should',
  ]);

  // Extract meaningful tokens from the query
  const rawTokens = lower
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  // Expand tokens using synonym map
  const expandedTokens = new Set<string>(rawTokens);
  for (const token of rawTokens) {
    const synonyms = SYNONYM_MAP[token];
    if (synonyms) {
      for (const syn of synonyms) {
        // Add each word of multi-word synonyms individually
        syn.split(/\s+/).forEach((w) => expandedTokens.add(w));
      }
    }
  }

  // Score each guide based on keyword and token hits
  const scored = SYSTEM_GUIDES.map((guide) => {
    let score = 0;
    const lowerTopic = guide.topic.toLowerCase();

    // Direct topic substring match (strongest signal)
    if (lower.includes(lowerTopic)) score += 30;

    // Check if any raw token is a direct substring of the topic
    for (const token of rawTokens) {
      if (lowerTopic.includes(token)) score += 6;
    }

    // Keyword match with phrase length weighting
    for (const kw of guide.keywords) {
      const lowerKw = kw.toLowerCase();

      // Full keyword phrase found in query
      if (lower.includes(lowerKw)) {
        score += 15 + lowerKw.split(/\s+/).length * 5;
      }

      // Individual keyword words matched by expanded tokens
      const kwWords = lowerKw.split(/\s+/);
      let kwMatches = 0;
      for (const kwWord of kwWords) {
        if (expandedTokens.has(kwWord)) kwMatches++;
      }
      if (kwMatches > 0) {
        score += kwMatches * 3;
      }
    }

    // Expanded token match against summary
    for (const token of expandedTokens) {
      if (guide.summary.toLowerCase().includes(token)) score += 1;
    }

    return { guide, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const bestMatch = scored[0];

  if (bestMatch && bestMatch.score > 0) {
    const g = bestMatch.guide;
    let reply = `### How to: ${g.topic}\n\n`;
    reply += `${g.summary}\n\n`;

    if (g.requiredRole) {
      const hasRole = userRoles.some((r) => g.requiredRole?.includes(r));
      reply += `> **Permissions Note:** This feature is accessible to **${g.requiredRole}**. ${hasRole ? '*(Your current role has access)*' : ''}\n\n`;
    }

    reply += `**Step-by-step instructions:**\n`;
    g.steps.forEach((step, idx) => {
      reply += `${idx + 1}. ${step}\n`;
    });

    reply += `\n**Quick Link:** Click here to navigate directly: [${g.topic} (${g.route})](${g.route})`;

    // Also suggest closely related guides (score > 50% of best)
    const relatedRoutes: { label: string; route: string }[] = [{ label: g.topic, route: g.route }];
    for (const item of scored.slice(1, 4)) {
      if (item.score > bestMatch.score * 0.4 && item.score > 0 && item.guide.route !== g.route) {
        relatedRoutes.push({ label: item.guide.topic, route: item.guide.route });
      }
    }

    return {
      text: reply,
      routes: relatedRoutes.slice(0, 3),
    };
  }

  // Generic fallback if no specific feature matched
  const allTopics = SYSTEM_GUIDES.map((g) => `- [${g.topic}](${g.route})`).join('\n');
  return {
    text: `Hello! I am your **Hospital ERP Assistant**. I can guide you step-by-step on how to use any feature in this software.\n\nHere are some of the key workflows you can ask me about:\n${allTopics}\n\n*For example, try asking: "How do I add a new patient?" or "How do I edit medicine stock?"*`,
    routes: [
      { label: 'Patients', route: '/patients' },
      { label: 'Appointments', route: '/appointments' },
      { label: 'Pharmacy Stock', route: '/pharmacy/stock' },
      { label: 'Billing Invoices', route: '/billing/invoices' },
    ],
  };
}

/**
 * Extract suggested clickable routes from the answer or query
 */
function extractSuggestedRoutes(reply: string, query: string): { label: string; route: string }[] {
  const routes: { label: string; route: string }[] = [];
  const seen = new Set<string>();

  for (const g of SYSTEM_GUIDES) {
    if (reply.includes(g.route) || query.toLowerCase().includes(g.topic.toLowerCase())) {
      if (!seen.has(g.route)) {
        seen.add(g.route);
        routes.push({ label: g.topic, route: g.route });
      }
    }
  }

  return routes.slice(0, 3);
}
