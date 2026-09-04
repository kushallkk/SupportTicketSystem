/* eslint-disable no-console */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { categoryDisplayName } from "../src/lib/categories";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
const DEMO_PASSWORD = "password123";

const AGENT_NAMES = ["Alex Chen", "Morgan Reyes", "Sam Okafor", "Jordan Blake", "Taylor Nguyen"];
const USER_NAMES = [
  "Priya Sharma", "Liam O'Connor", "Aisha Khan", "Diego Ramirez", "Emma Wilson",
  "Noah Kim", "Sofia Rossi", "Ethan Park", "Maya Patel", "Lucas Silva",
  "Grace Lee", "Ben Carter", "Zara Ahmed", "Ivy Zhang", "Omar Farouk",
];

type Template = { title: string; description: string; category: string; priority: string };

const TEMPLATES: Template[] = [
  { title: "Charged twice for this month's subscription", description: "I was billed two times for my monthly plan on the same day. Please refund the duplicate charge.", category: "billing", priority: "HIGH" },
  { title: "Invoice total doesn't match what I agreed to", description: "The invoice I received shows an amount higher than my plan price. Can someone correct this?", category: "billing", priority: "MEDIUM" },
  { title: "How do I update my payment method", description: "My card is expiring soon and I want to add a new one before it's declined.", category: "billing", priority: "LOW" },
  { title: "Requesting a refund for accidental upgrade", description: "I upgraded my plan by mistake yesterday and would like it reversed with a refund.", category: "billing", priority: "MEDIUM" },
  { title: "Unauthorized charge on my card", description: "There's a charge on my card from your service that I don't recognize and never authorized.", category: "billing", priority: "CRITICAL" },
  { title: "Can't find my past invoices", description: "I need my invoices from the last three months for expense reporting but can't locate them.", category: "billing", priority: "LOW" },
  { title: "Coupon code not applying at checkout", description: "I have a valid discount code but it won't apply during checkout, the total stays the same.", category: "billing", priority: "LOW" },
  { title: "Payment declined but amount was still deducted", description: "Checkout said payment failed, yet the amount was deducted from my bank account.", category: "billing", priority: "HIGH" },

  { title: "App crashes when opening settings", description: "Every time I tap on settings the app closes immediately. Happens on every attempt.", category: "technical", priority: "HIGH" },
  { title: "Getting 500 error on file upload", description: "Uploading any file larger than 5MB returns a server error and the upload fails.", category: "technical", priority: "HIGH" },
  { title: "Dashboard loads very slowly", description: "The main dashboard takes over 30 seconds to load today, it used to be instant.", category: "technical", priority: "MEDIUM" },
  { title: "Production is completely down", description: "Nothing is loading on the site right now, all pages show a timeout error. This is urgent.", category: "technical", priority: "CRITICAL" },
  { title: "Dark mode preference doesn't persist", description: "I turn on dark mode but it resets back to light mode after I refresh the page.", category: "technical", priority: "LOW" },
  { title: "API returning rate limit errors constantly", description: "We're getting 429 responses on nearly every API call even though we're well under the documented limit.", category: "technical", priority: "HIGH" },
  { title: "Blank white screen after login on mobile", description: "On my phone, after I log in the screen just goes blank. Works fine on desktop.", category: "technical", priority: "HIGH" },
  { title: "CSV export missing a column", description: "When I export ticket data to CSV, the priority column is missing from the file.", category: "technical", priority: "MEDIUM" },

  { title: "Can't reset my password", description: "I click forgot password on the login page and never receive the reset email, even after checking spam.", category: "account", priority: "HIGH" },
  { title: "Forgot password email never arrives", description: "Requested a password reset three times now and the email just doesn't show up in my inbox.", category: "account", priority: "HIGH" },
  { title: "Locked out after failed login attempts", description: "I mistyped my password a few times and now my account says it's locked. How do I get back in?", category: "account", priority: "HIGH" },
  { title: "Need to change my account email", description: "I switched jobs and need to update the email address tied to my account.", category: "account", priority: "MEDIUM" },
  { title: "Account was suspended without explanation", description: "I logged in today and my account is suspended, I have no idea why. Please investigate.", category: "account", priority: "CRITICAL" },
  { title: "Suspicious login from unknown device", description: "I got a notification about a login from a device and location I don't recognize.", category: "account", priority: "CRITICAL" },
  { title: "How do I enable two-factor authentication", description: "I want to add an extra layer of security to my account, where do I turn on 2FA?", category: "account", priority: "LOW" },
  { title: "Want to permanently delete my account", description: "Please delete my account and all associated data, I no longer need the service.", category: "account", priority: "MEDIUM" },

  { title: "Please add dark mode scheduling", description: "It would be great if dark mode could switch on automatically at sunset.", category: "feature_request", priority: "LOW" },
  { title: "Support exporting reports as PDF", description: "Right now we can only export as CSV, a PDF option would help for client-facing reports.", category: "feature_request", priority: "LOW" },
  { title: "Slack integration for notifications", description: "Would love to get ticket notifications posted directly into our team Slack channel.", category: "feature_request", priority: "LOW" },
  { title: "Bulk edit support for tickets", description: "Selecting multiple tickets and changing their status at once would save a lot of time.", category: "feature_request", priority: "MEDIUM" },
  { title: "Keyboard shortcuts for common actions", description: "Power users would benefit a lot from keyboard shortcuts to navigate and update tickets.", category: "feature_request", priority: "LOW" },
  { title: "Mobile app would be really helpful", description: "The website is hard to use on my phone, a dedicated mobile app would be great.", category: "feature_request", priority: "MEDIUM" },

  { title: "Question about your data retention policy", description: "How long do you keep ticket data after an account is closed?", category: "other", priority: "LOW" },
  { title: "What are your support hours", description: "Just wondering what hours your support team is available, especially on weekends.", category: "other", priority: "LOW" },
  { title: "Do you offer student discounts", description: "I'm a student and was wondering if there's a discounted plan available.", category: "other", priority: "LOW" },
  { title: "Loving the new update, thanks team", description: "Just wanted to say the redesign looks fantastic, great work.", category: "other", priority: "LOW" },
];

const RESOLUTION_NOTES: Record<string, string> = {
  billing: "Confirmed the duplicate charge in our payment logs and issued a full refund to the original payment method. Should reflect within 3-5 business days.",
  technical: "Identified the root cause in our latest deploy and shipped a hotfix. Please hard-refresh or clear your cache if you still see the issue.",
  account: "Verified your identity and manually reset the account lock / triggered a fresh password reset email from our end.",
  feature_request: "Logged this in our roadmap backlog for the product team to prioritize in an upcoming planning cycle.",
  other: "Answered directly in the ticket thread — let us know if you have any follow-up questions.",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cosineSim(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already normalized
}

async function classify(title: string, description: string, fallback: Template) {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("bad response");
    return (await res.json()) as { category: string; priority: string; confidence: number; embedding: number[] };
  } catch {
    return { category: fallback.category, priority: fallback.priority, confidence: 0.5, embedding: [] as number[] };
  }
}

async function main() {
  const mlHealthy = await fetch(`${ML_SERVICE_URL}/health`).then((r) => r.ok).catch(() => false);
  console.log(mlHealthy ? "ML service detected — seeding with real classifications/embeddings." : "ML service not reachable — seeding with template fallbacks (no embeddings).");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: "admin@resolveiq.dev" },
    update: {},
    create: { name: "Admin", email: "admin@resolveiq.dev", passwordHash, role: "ADMIN" },
  });

  const agents = [];
  for (const name of AGENT_NAMES) {
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@resolveiq.dev`;
    const agent = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name,
        email,
        passwordHash,
        role: "AGENT",
        agentProfile: { create: {} },
      },
      include: { agentProfile: true },
    });
    agents.push(agent);
  }

  const users = [];
  for (const name of USER_NAMES) {
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, passwordHash, role: "USER" },
    });
    users.push(user);
  }

  const categorySlugs = Array.from(new Set(TEMPLATES.map((t) => t.category)));
  const categories = new Map<string, { id: string }>();
  for (const slug of categorySlugs) {
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name: categoryDisplayName(slug), slug },
    });
    categories.set(slug, category);
  }

  console.log(`Seeding ${TEMPLATES.length * 4} tickets...`);

  const resolvedEmbeddingsByCategory = new Map<string, { ticketId: string; embedding: number[] }[]>();
  let created = 0;

  // Repeat templates with light variation to comfortably exceed 100 tickets.
  for (let round = 0; round < 4; round++) {
    for (const template of TEMPLATES) {
      const raisedBy = pick(users);
      const { category, priority, confidence, embedding } = await classify(template.title, template.description, template);

      const roll = Math.random();
      const status = roll < 0.22 ? "OPEN" : roll < 0.42 ? "IN_PROGRESS" : roll < 0.8 ? "RESOLVED" : "CLOSED";

      const categoryRow = categories.get(category) ?? categories.get(template.category);
      const assignedTo = agents.length ? pick(agents) : null;

      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 86_400_000 - Math.floor(Math.random() * 86_400_000));
      let resolvedAt: Date | null = null;
      let closedAt: Date | null = null;
      let resolutionNote: string | null = null;

      if (status === "RESOLVED" || status === "CLOSED") {
        resolvedAt = new Date(createdAt.getTime() + (30 + Math.random() * 2000) * 60_000);
        resolutionNote = RESOLUTION_NOTES[category] ?? RESOLUTION_NOTES.other;
        if (status === "CLOSED") closedAt = new Date(resolvedAt.getTime() + Math.random() * 3 * 86_400_000);
      }

      // Check for a duplicate among already-seeded resolved tickets in the same category.
      let duplicateOfId: string | null = null;
      let similarityScore: number | null = null;
      if (embedding.length > 0) {
        const pool = resolvedEmbeddingsByCategory.get(category) ?? [];
        let best: { ticketId: string; sim: number } | null = null;
        for (const entry of pool) {
          const sim = cosineSim(embedding, entry.embedding);
          if (!best || sim > best.sim) best = { ticketId: entry.ticketId, sim };
        }
        if (best && best.sim >= 0.8) {
          duplicateOfId = best.ticketId;
          similarityScore = Math.round(best.sim * 10000) / 10000;
        }
      }

      const ticket = await prisma.ticket.create({
        data: {
          title: round === 0 ? template.title : `${template.title}${round > 1 ? ` (#${round})` : ""}`,
          description: template.description,
          status,
          priority: priority as never,
          categoryId: categoryRow?.id,
          raisedById: raisedBy.id,
          assignedToId: status === "OPEN" ? (Math.random() < 0.7 ? assignedTo?.id : null) : assignedTo?.id,
          aiCategory: category,
          aiPriority: priority,
          aiConfidence: confidence,
          aiSuggestedAgentId: assignedTo?.id,
          embedding,
          duplicateOfId,
          similarityScore,
          resolvedAt,
          closedAt,
          resolutionNote,
          createdAt,
          updatedAt: resolvedAt ?? createdAt,
        },
      });
      created++;

      if (assignedTo?.id) {
        await prisma.assignmentLog.create({
          data: {
            ticketId: ticket.id,
            aiSuggestedAgentId: assignedTo.id,
            aiSuggestedScore: 0.5 + Math.random() * 0.5,
            finalAgentId: ticket.assignedToId,
            wasOverridden: Math.random() < 0.1,
          },
        });
      }

      if ((status === "RESOLVED" || status === "CLOSED") && embedding.length > 0) {
        const pool = resolvedEmbeddingsByCategory.get(category) ?? [];
        pool.push({ ticketId: ticket.id, embedding });
        resolvedEmbeddingsByCategory.set(category, pool);
      }

      // A comment or two, plus a rating for closed tickets.
      if (status !== "OPEN" && assignedTo) {
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            authorId: assignedTo.id,
            body: "Looking into this now, will update shortly.",
            isInternal: false,
          },
        });
      }
      if (resolutionNote && assignedTo) {
        await prisma.comment.create({
          data: { ticketId: ticket.id, authorId: assignedTo.id, body: resolutionNote, isInternal: false },
        });
      }
      if (status === "CLOSED") {
        await prisma.rating.create({
          data: {
            ticketId: ticket.id,
            userId: raisedBy.id,
            score: Math.random() < 0.75 ? 4 + Math.round(Math.random()) : 2 + Math.round(Math.random()),
            feedback: Math.random() < 0.4 ? "Thanks for the quick help!" : null,
          },
        });
      }

      // Roll up agent category stats so the load-balancer has real history from the start.
      if ((status === "RESOLVED" || status === "CLOSED") && assignedTo && categoryRow && resolvedAt) {
        const minutes = (resolvedAt.getTime() - createdAt.getTime()) / 60000;
        const agentProfile = await prisma.agentProfile.findUnique({ where: { userId: assignedTo.id } });
        if (agentProfile) {
          const stat = await prisma.agentCategoryStat.findUnique({
            where: { agentProfileId_categoryId: { agentProfileId: agentProfile.id, categoryId: categoryRow.id } },
          });
          const prevCount = stat?.resolvedCount ?? 0;
          const prevAvg = stat?.avgResolutionMins ?? minutes;
          const newAvg = (prevAvg * prevCount + minutes) / (prevCount + 1);
          await prisma.agentCategoryStat.upsert({
            where: { agentProfileId_categoryId: { agentProfileId: agentProfile.id, categoryId: categoryRow.id } },
            update: { resolvedCount: prevCount + 1, avgResolutionMins: newAvg, accuracyScore: 0.6 + Math.random() * 0.35 },
            create: {
              agentProfileId: agentProfile.id,
              categoryId: categoryRow.id,
              resolvedCount: 1,
              avgResolutionMins: minutes,
              accuracyScore: 0.6 + Math.random() * 0.35,
            },
          });
        }
      }

      if (created % 20 === 0) console.log(`  ${created} tickets created...`);
    }
  }

  console.log(`Done. Created ${created} tickets, ${agents.length} agents, ${users.length} users.`);
  console.log(`All seeded accounts use password: ${DEMO_PASSWORD}`);
  console.log(`Admin: admin@resolveiq.dev / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
