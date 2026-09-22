import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, Send, ArrowLeft, Paperclip, AlertTriangle, Siren, Mic, MicOff, RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { chatApi, emergencyApi } from "../../services/api";

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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, from: "ai", text: `Hi ${user?.name?.split(" ")[0] ?? "there"}, I'm CareSetu Doctor AI. Describe your symptoms or ask a health question, and I'll help you understand next steps. I am an AI assistant, not a doctor — for urgent emergencies, use Report Emergency.` },
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

    // Check if device is offline before attempting API call
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
            <span className="font-bold text-navy block text-xs uppercase tracking-wider mb-0.5">{title}</span>
            <span>{body}</span>
          </div>
        );
      }
      return <p key={idx} className="mb-1.5 last:mb-0">{paragraph}</p>;
    });
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 h-full pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary w-fit">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {user?.isGuest && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Guest AI Mode:</strong> Normal chat is available. Sign in to access document upload and personalized HealthPack features.
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

      <div className="bg-paleblue border border-lightblue rounded-xl p-3 flex items-center justify-between text-xs text-navy-dark">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-accent-dark" />
          <span>AI-assisted guidance only. Qualified doctor review required.</span>
        </div>
        <label className="flex items-center gap-1.5 font-medium cursor-pointer text-sky-700 hover:text-navy">
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
            className="rounded text-sky-600 focus:ring-sky-400"
          />
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Use HealthPack Profile</span>
        </label>
      </div>

      {emergencySignal && (
        <div className="bg-emergency/5 border border-emergency rounded-xl p-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emergency text-white flex items-center justify-center shrink-0">
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-emergency text-sm">Emergency Red-Flags Detected</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Severity: {emergencySignal.severity} — {emergencySignal.detectedWords.join(", ")}
              </p>
            </div>
          </div>
          <button
            onClick={handleEmergencyNow}
            disabled={creatingSos}
            className="mt-3 w-full flex items-center justify-center gap-2 text-sm font-bold text-white bg-emergency rounded-xl py-3 px-4 hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Siren className="w-4 h-4" /> {creatingSos ? 'Triggering Emergency...' : 'Report Emergency Now'}
          </button>
        </div>
      )}

      <Card className="flex flex-col h-[65vh]">
        <div className="flex items-center gap-2.5 pb-3 mb-1 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-lightblue flex items-center justify-center">
            <BrainCircuit className="w-4.5 h-4.5 text-navy-dark" />
          </div>
          <div>
            <p className="font-bold text-navy text-sm">CareSetu Doctor AI</p>
            <p className="text-[11px] text-text-secondary">Symptom checker & AI health assistant</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-3 py-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.from === "user"
                  ? "bg-sky text-navy self-end rounded-br-sm"
                  : m.isError
                  ? "bg-red-50 text-red-700 self-start rounded-bl-sm border border-red-200"
                  : "bg-slate-50 text-navy self-start rounded-bl-sm"
              }`}
            >
              {m.from === "ai" ? renderFormattedText(m.text) : m.text}
              {m.isError && (
                <button
                  onClick={() => send(messages[messages.length - 2]?.text || "")}
                  className="mt-2 text-xs font-semibold text-red-700 underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Retry Message
                </button>
              )}
            </div>
          ))}
          {thinking && (
            <div className="self-start bg-slate-50 px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm text-text-secondary flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing symptoms & formulating guidance...</span>
            </div>
          )}
        </div>

        {attachedFile && (
          <div className="px-3 py-1.5 bg-sky-50 border border-sky-100 rounded-xl text-xs text-navy flex items-center justify-between mb-2">
            <span>Attached Document: <strong>{attachedFile.name}</strong> ({(attachedFile.size / 1024).toFixed(1)} KB)</span>
            <button onClick={() => setAttachedFile(null)} className="text-red-500 font-bold hover:underline">Remove</button>
          </div>
        )}

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 pb-3">
            {starterPrompts.map((p) => (
              <button key={p} onClick={() => send(p)} className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 text-navy hover:border-sky">
                {p}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex items-center gap-2 pt-3 border-t border-slate-100"
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
            className="p-2 rounded-xl text-text-secondary hover:bg-slate-50"
            aria-label="Attach medical document"
            title="Attach Health Pack document (PDF, JPG, PNG)"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2 rounded-xl transition-colors ${
              isListening ? "bg-emergency/15 text-emergency animate-pulse" : "text-text-secondary hover:bg-slate-50"
            }`}
            title={isListening ? "Listening... Click to stop" : "Speak symptoms"}
            aria-label="Voice input"
          >
            {isListening ? <MicOff className="w-4.5 h-4.5 text-emergency" /> : <Mic className="w-4.5 h-4.5" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your symptoms or ask a health question..."
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none"
            aria-label="Symptom or health question input"
          />
          <Button type="submit" variant="primary" size="sm" icon={<Send className="w-4 h-4" />}>
            Send
          </Button>
        </form>
      </Card>

      {showGuestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-navy">This feature requires a registered account.</h3>
            <p className="text-sm text-text-secondary mt-2">
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
                className="mt-2 text-xs font-semibold text-text-secondary hover:text-navy"
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