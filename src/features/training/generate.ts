/**
 * Training packet generator. Role-based packets in plain old-school-friendly
 * language. LLM-generated via LangChain LCEL with deterministic fallback.
 *
 * The deterministic fallback produces complete, usable packets without any
 * LLM dependency. When an LLM is available (LANGSMITH_API_KEY set), the
 * LCEL chain enriches the prose while keeping the same structure.
 */

import type {
  TrainingInput,
  TrainingPacket,
  TrainingResult,
  TrainingRole,
  TrainingSection,
} from "./types";

const ROLES: TrainingRole[] = ["owner", "dispatcher", "driver", "csr"];

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Deterministic fallback ───────────────────────────────────────────

const ROLE_TITLES: Record<TrainingRole, string> = {
  owner: "Business Owner: Your New System at a Glance",
  dispatcher: "Dispatcher: Running Routes in the New System",
  driver: "Driver: Your Daily Route on the New System",
  csr: "Customer Service: Helping Customers in the New System",
};

const ROLE_SECTIONS: Record<TrainingRole, TrainingSection[]> = {
  owner: [
    {
      heading: "What Changed",
      body: "Your old system (RoutePro, QuickBooks, spreadsheets) has been moved into TrashLab. All your customers, sites, containers, agreements, routes, and scale tickets are now in one place. Nothing was lost.",
    },
    {
      heading: "What the Numbers Mean",
      body: "Of your records, most were mapped automatically. A small number needed a human to review them. Those have been resolved. The system is ready to use today.",
    },
    {
      heading: "Your Daily Check",
      body: "Once a day, open the dashboard and look at the exception queue. If anything needs your attention, it will be there. Pricing decisions still go through you.",
    },
    {
      heading: "Who Does What",
      body: "You handle pricing. Your dispatcher handles routes. Drivers use the mobile app. Customer service looks up accounts. Everyone has their own training packet.",
    },
  ],
  dispatcher: [
    {
      heading: "What Changed",
      body: "Your old route sheets and templates are now in TrashLab. Every route, every stop, every frequency is in the system. The routes you know are still the same. They just live in a new place.",
    },
    {
      heading: "Your Daily Loop",
      body: "Morning: open the route board. Check for any route conflicts flagged overnight. Resolve them with one click. Afternoon: adjust tomorrow's routes if needed. The system learns from your changes.",
    },
    {
      heading: "Route Conflicts",
      body: "Sometimes the system finds two routes that overlap or conflict. It will show you both and suggest the fix. You make the call. Your decisions are recorded so the system gets smarter.",
    },
    {
      heading: "Talking to Drivers",
      body: "Drivers see their routes on the mobile app. If a driver reports a problem, you can adjust their route from your screen and it updates on their phone right away.",
    },
  ],
  driver: [
    {
      heading: "What Changed",
      body: "Your daily route is now on a phone or tablet instead of paper. You will see every stop, every container, and any special instructions. The app works even without cell service.",
    },
    {
      heading: "Starting Your Day",
      body: "Open the app. Your route is already loaded. Tap Start Route. Follow the stops in order. At each stop, tap the container you are servicing. Take a photo if something looks wrong.",
    },
    {
      heading: "When Something Is Off",
      body: "If a container is not there, or it is overflowing, or the address looks wrong, tap the Flag button. Take a photo. Your dispatcher sees it right away. You do not need to call anyone.",
    },
    {
      heading: "End of Day",
      body: "Tap End Route when you are done. Your completed stops are saved. Any flags you raised are sent to the dispatcher. That is it. No paperwork.",
    },
  ],
  csr: [
    {
      heading: "What Changed",
      body: "Customer accounts, service agreements, and billing are now all in one screen. When a customer calls, you can see everything about their account without switching between systems.",
    },
    {
      heading: "Looking Up a Customer",
      body: "Type the customer name or phone number. You will see their sites, containers, service schedule, and billing history. Everything is on one page.",
    },
    {
      heading: "Common Questions",
      body: "When is my pickup? Check the service schedule tab. How much do I owe? Check the billing tab. I need a different size container? Create a service change request. It goes to the dispatcher.",
    },
    {
      heading: "Escalating Issues",
      body: "If a customer has a billing question you cannot answer, flag it for the owner. If they need a route change, flag it for the dispatcher. The system routes the request to the right person.",
    },
  ],
};

function buildDeterministicPacket(
  role: TrainingRole,
  input: TrainingInput,
): TrainingPacket {
  const sections = ROLE_SECTIONS[role].map((section) => {
    // Inject live numbers into the owner's "What the Numbers Mean" section
    if (role === "owner" && section.heading === "What the Numbers Mean") {
      return {
        ...section,
        body: `Of your ${input.totalRecords.toLocaleString()} records, ${input.autoMapped.toLocaleString()} were mapped automatically (${(input.autoMapRate * 100).toFixed(1)}%). ${input.exceptionCount.toLocaleString()} needed a human to review them. Those have been resolved. The system is ready to use today.`,
      };
    }
    return section;
  });

  return {
    role,
    title: ROLE_TITLES[role],
    sections,
    generatedAt: nowIso(),
    generatedBy: "fallback",
  };
}

// ─── LangChain LCEL generator ─────────────────────────────────────────

/**
 * Build a LangChain LCEL chain for training packet generation.
 * Uses ChatOpenAI or a compatible model. Falls back to deterministic
 * if the LLM is unavailable or the call fails.
 */
async function buildLcelChain(): Promise<unknown> {
  try {
    // Dynamic import to avoid bundling LangChain when not used
    const openaiPkg = "@langchain/openai";
    const openaiModule = await import(openaiPkg);
    const { ChatOpenAI } = openaiModule;
    const { ChatPromptTemplate } = await import("@langchain/core/prompts");
    const { StringOutputParser } = await import("@langchain/core/output_parsers");

    const model = new ChatOpenAI({
      modelName: process.env.TRAINING_LLM_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 500,
    });

    const prompt = ChatPromptTemplate.fromTemplate(`You are writing a training packet for a {role} at a waste management company that just migrated to new software.

Context:
- {autoMapped} out of {totalRecords} records were mapped automatically ({autoMapRate}%).
- {exceptionCount} exceptions were reviewed and resolved by a human.
- Go-live took {goLiveDays} days.

Write a training packet with 4 short sections. Each section has a heading and 2-3 sentences of body text.
Use plain, old-school-friendly language. No jargon. No em-dashes. Write like you are explaining it to someone who has been doing this job for 20 years.

Return the response as a JSON object with this exact shape:
{{ "sections": [{{ "heading": "...", "body": "..." }}, ...] }}

Only return the JSON object, nothing else.`);

    return prompt.pipe(model).pipe(new StringOutputParser());
  } catch {
    return null;
  }
}

let cachedChain: unknown = null;
let chainInitFailed = false;

async function getChain(): Promise<unknown> {
  if (cachedChain) return cachedChain;
  if (chainInitFailed) return null;
  cachedChain = await buildLcelChain();
  if (!cachedChain) chainInitFailed = true;
  return cachedChain;
}

/**
 * Parse the LLM JSON response into sections, with validation.
 */
function parseLlmResponse(raw: string): TrainingSection[] | null {
  try {
    // Strip markdown code fences if present
    let json = raw.trim();
    if (json.startsWith("```")) {
      json = json.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(json) as { sections?: Array<{ heading?: string; body?: string }> };

    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return null;
    }

    return parsed.sections.map((s) => ({
      heading: String(s.heading || "Section"),
      body: String(s.body || ""),
    }));
  } catch {
    return null;
  }
}

async function buildLlmPacket(
  role: TrainingRole,
  input: TrainingInput,
): Promise<TrainingPacket | null> {
  const chain = await getChain();
  if (!chain) return null;

  try {
    const chainWithInvoke = chain as { invoke: (input: Record<string, string>) => Promise<string> };
    const raw = await chainWithInvoke.invoke({
      role,
      autoMapped: String(input.autoMapped),
      totalRecords: String(input.totalRecords),
      autoMapRate: `${(input.autoMapRate * 100).toFixed(1)}%`,
      exceptionCount: String(input.exceptionCount),
      goLiveDays: String(input.goLiveDays),
    });

    const sections = parseLlmResponse(raw);
    if (!sections) return null;

    return {
      role,
      title: ROLE_TITLES[role],
      sections,
      generatedAt: nowIso(),
      generatedBy: "llm",
    };
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Generate training packets for all four roles.
 * Tries LLM first, falls back to deterministic per-role.
 */
export async function generateTrainingPackets(
  input: TrainingInput,
): Promise<TrainingResult> {
  const packets: TrainingPacket[] = [];
  let anyLlm = false;

  for (const role of ROLES) {
    const llmPacket = await buildLlmPacket(role, input);
    if (llmPacket) {
      packets.push(llmPacket);
      anyLlm = true;
    } else {
      packets.push(buildDeterministicPacket(role, input));
    }
  }

  return {
    packets,
    generatedBy: anyLlm ? "llm" : "fallback",
  };
}

/**
 * Synchronous deterministic-only generator. Used when you know the LLM
 * is unavailable and want to skip the async import attempt.
 */
export function generateTrainingPacketsSync(input: TrainingInput): TrainingResult {
  const packets = ROLES.map((role) => buildDeterministicPacket(role, input));
  return { packets, generatedBy: "fallback" };
}

/**
 * Get a single training packet for a specific role.
 */
export function getPacketForRole(
  packets: TrainingPacket[],
  role: TrainingRole,
): TrainingPacket | undefined {
  return packets.find((p) => p.role === role);
}
