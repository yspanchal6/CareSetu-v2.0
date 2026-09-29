import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, Send, ArrowLeft, Paperclip, AlertTriangle, Siren, Mic, MicOff, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { chatApi, emergencyApi } from "../../services/api";
import { useTranslation } from "../../i18n/I18nContext";

interface ChatMessage {
  id: number;
  from: "user" | "ai";
  text: string;
  isError?: boolean;
}

const starterPrompts = [
  "I have a headache and mild fever",
  "What could cause chest tightness?",
  "Explain my recent blood test report",
  "Is my medication safe to combine?",
];

export default function DoctorAIPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, from: "ai", text: `${t("doctorAi.title")}: ${t("doctorAi.disclaimer")}` },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [useHealthPack, setUseHealthPack] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number } | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [emergencySignal, setEmergencySignal] = useState<null | {
    severity: string;
    detectedWords: string[];
    message: string;
  }>(null);

  const [aiSymptoms, setAiSymptoms] = useState<string[]>([]);
  const [aiSeverity, setAiSeverity] = useState<string>('CRITICAL');
  const [aiEmergencyType, setAiEmergencyType] = useState<string>('OTHER');
  const [creatingSos, setCreatingSos] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(2);

  const detectEmergencyType = (symptoms: string[]) => {
    const text = symptoms.join(' ').toLowerCase();
    if (text.includes('chest') || text.includes('heart')) return 'CARDIAC';
    if (text.includes('breath') || text.includes('breathing')) return 'BREATHING';
    if (text.includes('bleed')) return 'BLEEDING';
    if (text.includes('stroke') || text.includes('paralysis')) return 'STROKE';
    if (text.includes('accident') || text.includes('injury')) return 'TRAUMA';
    return 'OTHER';
  };

  const handleEmergencyNow = async () => {
    if (creatingSos) return;
    setCreatingSos(true);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000,
        });
      });

      const symptomsText = aiSymptoms && aiSymptoms.length > 0
        ? aiSymptoms.join(', ')
        : 'Emergency triggered from AI chatbot analysis';

      const payload = {
        symptoms: symptomsText,
        emergencyType: aiEmergencyType || 'OTHER',
        severity: (aiSeverity as any) || 'CRITICAL',
        location: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          source: 'GPS' as const,
        },
        idempotencyKey: crypto.randomUUID(),
        source: 'CHATBOT',
      };

      const res = await emergencyApi.create(payload);
      const caseId = res.publicCaseId || res.caseId;
      if (!caseId) throw new Error('No case ID returned');

      navigate(`/patient/emergency/status/${caseId}`);

    } catch (err: any) {
      console.error('[SOS-Chatbot] Failed:', err);
      alert(`Failed to trigger emergency: ${err.message || 'Unknown error'}`);
      setCreatingSos(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file format. Only PDF, JPG, and PNG documents under 10MB are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10 MB limit.");
      return;
    }

    setAttachedFile({ name: file.name, size: file.size });
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your symptoms.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.error("Speech recognition error:", err);
      setIsListening(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text: string) => {
    if (!text.trim() || thinking) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const offlineMsg: ChatMessage = {
        id: nextIdRef.current++,
        from: "ai",
        isError: true,
        text: "Doctor AI requires an internet connection to respond. Please check your connection and try again. If this is an emergency, use Report Emergency or call 108.",
      };
      setMessages((prev) => [...prev, { id: nextIdRef.current++, from: "user", text } as ChatMessage, offlineMsg]);
      return;
    }

    let fullText = text;
    if (attachedFile) {
      fullText = `[Attached Document: ${attachedFile.name}] ${text}`;
      setAttachedFile(null);
    }

    const userMsg: ChatMessage = { id: nextIdRef.current++, from: "user", text: fullText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const res = await chatApi.send(fullText, conversationId);
      if (!conversationId) setConversationId(res.conversationId);

      if (res.isEmergency) {
        const detectedSyms = res.detectedWords && res.detectedWords.length > 0
          ? res.detectedWords
          : [fullText];
        setAiSymptoms(detectedSyms);
        setAiSeverity(res.severity || "CRITICAL");
        setAiEmergencyType(detectEmergencyType(detectedSyms));

        const safetyMsg: ChatMessage = {
          id: nextIdRef.current++,
          from: "ai",
          text: res.message || "Emergency red-flags detected. Click Report Emergency Now to request immediate assistance.",
        };
        setMessages((prev) => [...prev, safetyMsg]);
        setEmergencySignal({
          severity: res.severity || "RED",
          detectedWords: detectedSyms,
          message: res.message || "",
        });
      } else {
        const reply: ChatMessage = {
          id: nextIdRef.current++,
          from: "ai",
          text: res.reply || "I couldn't generate a reply. Please try again.",
        };
        setMessages((prev) => [...prev, reply]);
      }
    } catch (err: any) {
      const failed: ChatMessage = {
        id: nextIdRef.current++,
        from: "ai",
        isError: true,
        text: `I couldn't reach the assistant service right now (${err?.message || "network error"}). If this is urgent, use Report Emergency or call 108.`,
      };
      setMessages((prev) => [...prev, failed]);
    } finally {
      setThinking(false);
    }
  };

  const renderFormattedText = (text: string) => {
    return text.split('\n\n').map((paragraph, idx) => {
      if (paragraph.startsWith('**') && paragraph.includes(':**')) {
        const titleEnd = paragraph.indexOf(':**') + 3;
        const title = paragraph.slice(0, titleEnd).replace(/\*\*/g, '');
        const body = paragraph.slice(titleEnd).trim();
        return (
          <div key={idx} className="mb-2">
            <span className="font-bold text-sky-700 dark:text-sky-300 block text-xs uppercase tracking-wider mb-0.5">{title}</span>
            <span>{body}</span>
          </div>
        );
      }
      return <p key={idx} className="mb-1.5 last:mb-0">{paragraph}</p>;
    });
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 h-full pb-4 px-2 sm:px-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
          <Sparkles className="w-3.5 h-3.5" /> Doctor AI Medical Assistant
        </span>
      </div>

      {user?.isGuest && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Guest AI Mode:</strong> Symptom checking active. Sign in to link document uploads and HealthPack profiles.
            </span>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shrink-0 transition-colors"
          >
            Sign In
          </button>
        </div>
      )}

      <div className="bg-sky-50/80 dark:bg-slate-850 border border-sky-200/60 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>AI-assisted guidance only. Qualified doctor review required.</span>
        </div>
        <label className="flex items-center gap-1.5 font-semibold cursor-pointer text-sky-600 dark:text-sky-400 hover:text-sky-700">
          <input
            type="checkbox"
            checked={!user?.isGuest && useHealthPack}
            onChange={(e) => {
              if (user?.isGuest) {
                setShowGuestModal(true);
                setUseHealthPack(false);
                return;
              }
              setUseHealthPack(e.target.checked);
            }}
            className="rounded text-sky-500 focus:ring-sky-400"
          />
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Use HealthPack Profile</span>
        </label>
      </div>

      {emergencySignal && (
        <div className="bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 rounded-2xl p-4 shadow-emergency animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-rose-700 dark:text-rose-300 text-sm">Emergency Red-Flags Detected</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Severity: {emergencySignal.severity} — {emergencySignal.detectedWords.join(", ")}
              </p>
            </div>
          </div>
          <Button
            variant="emergency"
            size="md"
            fullWidth
            onClick={handleEmergencyNow}
            disabled={creatingSos}
            className="mt-3"
            icon={<Siren className="w-4 h-4" />}
          >
            {creatingSos ? 'Triggering Emergency...' : 'Report Emergency Now'}
          </Button>
        </div>
      )}

      <Card padded={false} className="flex flex-col h-[65vh] shadow-soft overflow-hidden">
        {/* Assistant Chat Header */}
        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-glow">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">CareSetu Doctor AI</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Conversational symptom checker & triage assistant</p>
          </div>
        </div>

        {/* Messages Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-3 p-4 bg-slate-50/40 dark:bg-slate-900">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.from === "user"
                  ? "bg-sky-500 text-white self-end rounded-br-none shadow-sm font-medium"
                  : m.isError
                  ? "bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200 self-start rounded-bl-none border border-rose-200 dark:border-rose-900"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 self-start rounded-bl-none border border-slate-200/80 dark:border-slate-700/60 shadow-card"
              }`}
            >
              {m.from === "ai" ? renderFormattedText(m.text) : m.text}
              {m.isError && (
                <button
                  onClick={() => send(messages[messages.length - 2]?.text || "")}
                  className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400 underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Retry Message
                </button>
              )}
            </div>
          ))}
          {thinking && (
            <div className="self-start bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-sky-500 animate-spin" />
              <span>Analyzing symptoms & formulating guidance...</span>
            </div>
          )}
        </div>

        {attachedFile && (
          <div className="px-4 py-2 bg-sky-50 dark:bg-sky-950 border-t border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200 flex items-center justify-between">
            <span>Attached Document: <strong>{attachedFile.name}</strong> ({(attachedFile.size / 1024).toFixed(1)} KB)</span>
            <button onClick={() => setAttachedFile(null)} className="text-rose-500 font-bold hover:underline">Remove</button>
          </div>
        )}

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-4 py-2 bg-slate-50/60 dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800">
            {starterPrompts.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-500 hover:text-sky-600 transition-colors shadow-xs"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          className="flex items-center gap-2 p-3 bg-white dark:bg-slate-850 border-t border-slate-200/80 dark:border-slate-800"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              if (user?.isGuest) {
                setShowGuestModal(true);
                return;
              }
              fileInputRef.current?.click();
            }}
            className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Attach medical document"
            title="Attach Health Pack document (PDF, JPG, PNG)"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2.5 rounded-xl transition-colors ${
              isListening ? "bg-rose-100 text-rose-600 animate-pulse" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title={isListening ? "Listening... Click to stop" : "Speak symptoms"}
            aria-label="Voice input"
          >
            {isListening ? <MicOff className="w-5 h-5 text-rose-600" /> : <Mic className="w-5 h-5" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your symptoms or ask a health question..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            aria-label="Symptom or health question input"
          />
          <Button type="submit" variant="primary" size="md" icon={<Send className="w-4 h-4" />}>
            Send
          </Button>
        </form>
      </Card>

      {showGuestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">This feature requires a registered account.</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Sign in or create a CareSetu account to upload medical documents, access your personalized HealthPack history, and get tailored AI analysis.
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <Button variant="primary" size="md" fullWidth onClick={() => navigate("/register")}>
                Create Account
              </Button>
              <Button variant="outline" size="md" fullWidth onClick={() => navigate("/login")}>
                Log In
              </Button>
              <button
                onClick={() => setShowGuestModal(false)}
                className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Continue in Guest Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}