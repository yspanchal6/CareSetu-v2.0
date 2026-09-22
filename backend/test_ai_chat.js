/**
 * CareSetu Slice 11 verification — AI Chatbot + Safety Engine.
 *
 * Verifies:
 *   1. POST /api/chat/send with an emergency red-flag (e.g. "severe chest pain")
 *      short-circuits: isEmergency=true, severity RED, redirectSos=true, NO LLM reply.
 *   2. The deterministic Safety Rule Engine (M1) runs FIRST and makes the call.
 *   3. Emergency message is persisted: Conversation + AIMessage + AIAnalysis.
 *   4. Non-emergency message gets an assistant reply + AIAnalysis (intent, risk).
 *   5. Conversations list + detailed conversation endpoints.
 */
const prisma = require('./src/config/prisma');
const bcrypt = require('bcrypt');

const BASE = 'http://localhost:3000';

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed += 1; console.log(`  ✅ ${name}`); }
  else { failed += 1; console.log(`  ❌ ${name}${extra ? ' — ' + JSON.stringify(extra) : ''}`); }
}

async function api(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function cleanup(email) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  const patient = await prisma.patient.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (patient) {
    await prisma.patient.delete({ where: { id: patient.id } }).catch(() => { });
  }
  await prisma.user.delete({ where: { id: user.id } }).catch(() => { });
}

async function main() {
  const email = `chat_${Date.now()}@test.com`;
  await cleanup(email);

  const passHash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.create({
    data: {
      name: 'Chat Tester',
      email,
      password: passHash,
      role: 'PATIENT',
      patient: { create: { name: 'Chat Tester', age: 30, gender: 'M', phone: '9898000050' } },
    },
  });

  const login = await api('POST', '/auth/login', null, { email, password: 'password123' });
  const token = login.json.token;
  ok('Patient can log in', !!token, login.json);

  // ── 1. EMERGENCY MESSAGE → short-circuit, no LLM, redirect to SOS ──
  console.log('\n═══ 1. EMERGENCY RED-FLAG SHORT-CIRCUIT ═══\n');
  const emergencyRes = await api('POST', '/chat/send', token, {
    message: 'I am having severe chest pain right now',
  });
  ok('Chat send → 200', emergencyRes.status === 200, emergencyRes.json);
  ok('Emergency detected (isEmergency=true)', emergencyRes.json.isEmergency === true);
  ok('Severity = RED', emergencyRes.json.severity === 'RED', emergencyRes.json.severity);
  ok('safetyDecision = EMERGENCY', emergencyRes.json.safetyDecision === 'EMERGENCY');
  ok('redirectSos = true', emergencyRes.json.redirectSos === true);
  ok('detectedWords includes "chest pain"', (emergencyRes.json.detectedWords || []).some((w) => String(w).includes('chest pain')), emergencyRes.json.detectedWords);
  ok('NO assistant medical reply (short-circuit)', emergencyRes.json.reply === null, emergencyRes.json.reply);

  const convId = emergencyRes.json.conversationId;
  ok('Conversation created', typeof convId === 'string' && convId.length > 0);

  const conv = await prisma.conversation.findUnique({
    where: { id: convId },
    include: { messages: true, analyses: true },
  });
  ok('Conversation persisted in DB', !!conv);
  ok('Emergency analysis persisted (risk CRITICAL / decision EMERGENCY)',
    !!conv?.analyses?.[0] && conv.analyses[0].riskLevel === 'CRITICAL' && conv.analyses[0].safetyDecision === 'EMERGENCY',
    conv?.analyses?.[0]);
  ok('Emergency analysis persisted detectedWords + emergencySignals',
    conv?.analyses?.[0]?.detectedWords?.length >= 1 && conv?.analyses?.[0]?.emergencySignals?.length >= 1);
  ok('Only the USER message persisted (no assistant reply during emergency)',
    conv?.messages?.length === 1 && conv.messages[0].role === 'USER');
  ok('Analysis modelName = safety-rule-engine (AI did NOT decide)',
    conv?.analyses?.[0]?.modelName === 'safety-rule-engine', conv?.analyses?.[0]?.modelName);

  // ── 2. NON-EMERGENCY MESSAGE → assistant reply + analysis ──
  console.log('\n═══ 2. NON-EMERGENCY MESSAGE → ASSISTANT REPLY ═══\n');
  const normalRes = await api('POST', '/chat/send', token, {
    message: 'I have a mild headache and slight fever since yesterday',
    conversationId: convId,
  });
  ok('Chat send → 200', normalRes.status === 200, normalRes.json);
  ok('isEmergency=false', normalRes.json.isEmergency === false);
  ok('Assistant reply returned (non-empty)', typeof normalRes.json.reply === 'string' && normalRes.json.reply.trim().length > 0, normalRes.json.reply);
  ok('Same conversation continued', normalRes.json.conversationId === convId);

  const conv2 = await prisma.conversation.findUnique({
    where: { id: convId },
    include: { messages: { orderBy: { createdAt: 'asc' } }, analyses: { orderBy: { createdAt: 'asc' } } },
  });
  ok('Now 3 messages (USER, ASSISTANT, USER)', conv2?.messages?.length === 3, conv2?.messages?.map((m) => m.role));
  ok('2 analyses persisted (emergency + normal)', conv2?.analyses?.length === 2, conv2?.analyses?.length);
  ok('Normal analysis risk = LOW / decision = NORMAL',
    conv2?.analyses?.[1]?.riskLevel === 'LOW' && conv2?.analyses?.[1]?.safetyDecision === 'NORMAL',
    conv2?.analyses?.[1]);
  ok('Normal analysis intent = SYMPTOM_CHECK', conv2?.analyses?.[1]?.intent === 'SYMPTOM_CHECK', conv2?.analyses?.[1]?.intent);
  ok('Normal analysis symptoms extracted', conv2?.analyses?.[1]?.symptoms?.length >= 1, conv2?.analyses?.[1]?.symptoms);

  // ── 3. CONVERSATION ENDPOINTS ──
  console.log('\n═══ 3. CONVERSATION LIST + DETAIL ═══\n');
  const list = await api('GET', '/chat/conversations', token, null);
  ok('Conversations listed', Array.isArray(list.json.conversations) && list.json.conversations.length >= 1);
  ok('Our conversation is in the list', list.json.conversations.some((c) => c.id === convId));

  const detail = await api('GET', `/chat/conversations/${convId}`, token, null);
  ok('Conversation detail → 200', detail.status === 200);
  ok('Detail returns messages in persisted order (USER, USER, ASSISTANT)',
    detail.json.conversation?.messages?.length === 3
    && detail.json.conversation.messages[0].role === 'USER'
    && detail.json.conversation.messages[1].role === 'USER'
    && detail.json.conversation.messages[2].role === 'ASSISTANT',
    detail.json.conversation?.messages?.map((m) => m.role));

  // ── CLEANUP ──
  await prisma.conversation.deleteMany({ where: { userId: user.id } }).catch(() => { });
  await cleanup(email);

  console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed ═══\n`);
  prisma['$disconnect']();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL', e);
  prisma['$disconnect']();
  process.exit(1);
});