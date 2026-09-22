// chat.controller.js
// AI Chatbot — Safety Engine (M1) runs first, then the AI client (M2).
// AI never triggers SOS directly: the deterministic Safety Rule Engine decides.

const { z } = require('zod');
const prisma = require('../config/prisma');
const aiRedflag = require('../services/ai-redflag.service');
const aiClient = require('../services/ai-client.service');

const sendSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.').max(2000, 'Message too long (max 2000 characters).'),
  conversationId: z.string().min(1).optional(),
  includeHealthPack: z.boolean().optional(),
});

// 1. Send a message
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, conversationId, includeHealthPack } = sendSchema.parse(req.body);
    const userId = req.user.userId;

    // SAFETY ENGINE FIRST — deterministic, before any LLM involvement.
    const safety = aiRedflag.detect(message);

    // Resolve (or create) the conversation.
    let conversation = null;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: message.slice(0, 60).trim() || 'New chat',
        },
      });
    }

    const started = Date.now();

    // Persist the user message.
    await prisma.aIMessage.create({
      data: { conversationId: conversation.id, role: 'USER', content: message },
    });

    // EMERGENCY → short-circuit; no LLM call, signal the frontend to redirect to SOS.
    if (safety.isEmergency) {
      await prisma.aIAnalysis.create({
        data: {
          conversationId: conversation.id,
          intent: 'EMERGENCY',
          riskLevel: safety.riskLevel,
          safetyDecision: 'EMERGENCY',
          symptoms: safety.symptoms,
          detectedWords: safety.detectedWords,
          emergencySignals: safety.emergencySignals,
          ragUsed: false,
          modelName: 'safety-rule-engine',
          processingTimeMs: Date.now() - started,
        },
      });

      return res.json({
        success: true,
        conversationId: conversation.id,
        isEmergency: true,
        severity: safety.severity,
        riskLevel: safety.riskLevel,
        safetyDecision: safety.safetyDecision,
        detectedWords: safety.detectedWords,
        emergencySignals: safety.emergencySignals,
        message: `Emergency red-flags detected (${safety.detectedWords.join(', ')}). You will be redirected to Report Emergency.`,
        redirectSos: true,
        reply: null,
      });
    }

    // HealthPack Context retrieval if authorized (registered users only)
    let patientContext = null;
    if (includeHealthPack && !req.user.isGuest && req.user.role !== 'GUEST') {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (patient) {
        patientContext = {
          bloodGroup: patient.bloodGroup || 'Not specified',
          allergies: patient.allergies || 'None recorded',
          medicalConditions: patient.medicalConditions || patient.conditions || 'None recorded',
          heartCondition: patient.heartCondition || 'UNKNOWN',
          diabetesStatus: patient.diabetesStatus || 'UNKNOWN',
          hypertensionStatus: patient.hypertensionStatus || 'UNKNOWN',
          medications: patient.medications || 'None recorded',
        };
      }
    }

    // NON-EMERGENCY → AI client (sidecar → LLM → deterministic fallback).
    const result = await aiClient.processMessage(message, safety, patientContext);

    const VALID_AI_INTENTS = ['GENERAL_HEALTH', 'SYMPTOM_CHECK', 'EMERGENCY', 'MEDICATION', 'FIRST_AID', 'HOSPITAL_SEARCH', 'HEALTH_PACK', 'APPOINTMENT', 'OTHER'];
    const safeIntent = VALID_AI_INTENTS.includes(safety.intent) ? safety.intent : 'GENERAL_HEALTH';

    await prisma.aIAnalysis.create({
      data: {
        conversationId: conversation.id,
        intent: safeIntent,
        riskLevel: safety.riskLevel,
        safetyDecision: safety.safetyDecision,
        symptoms: safety.symptoms,
        detectedWords: safety.detectedWords,
        emergencySignals: [],
        ragUsed: !!result.ragUsed,
        confidence: null,
        modelName: result.modelName,
        processingTimeMs: result.processingTimeMs,
      },
    });

    await prisma.aIMessage.create({
      data: { conversationId: conversation.id, role: 'ASSISTANT', content: result.reply },
    });

    return res.json({
      success: true,
      conversationId: conversation.id,
      isEmergency: false,
      reply: result.reply,
      source: result.source,
      ragUsed: !!result.ragUsed,
      safetyDecision: safety.safetyDecision,
    });
  } catch (error) {
    next(error);
  }
};

// 2. List the user's conversations
exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
      take: 50,
    });
    res.json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
};

// 3. One conversation with messages + analyses
exports.getConversation = async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        analyses: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    res.json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
};