import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UploadCloud, FileText, X, CheckCircle2, Image as ImageIcon, Sparkles } from "lucide-react";
import { Card } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { useToast } from "../../components/common/Toast";
import { medicalDocumentApi } from "../../services/api";

interface UploadedDoc {
  id: string;
  name: string;
  size: string;
  type: string;
  status: "uploading" | "done";
  suggestions?: string[];
}

export default function UploadDocumentsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [docType, setDocType] = useState("LAB_REPORT");

  const loadDocuments = async () => {
    try {
      const res = await medicalDocumentApi.getMyDocuments();
      if (res.success && Array.isArray(res.data)) {
        const fetched = res.data.map((d: any) => ({
          id: d.id,
          name: d.fileName,
          size: d.fileSize ? `${(d.fileSize / 1024).toFixed(0)} KB` : "N/A",
          type: d.fileType === "IMAGE" ? "image" : "pdf",
          status: "done" as const,
          suggestions: d.extractedConditions ? d.extractedConditions.split(", ") : [],
        }));
        setDocs(fetched);
      }
    } catch (err) {
      console.warn("Could not fetch documents", err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
    const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

    for (const file of Array.from(files)) {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      const isExtensionValid = ALLOWED_EXTENSIONS.includes(ext);
      const isMimeValid = !file.type || ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

      if (!isExtensionValid || !isMimeValid) {
        showToast("error", `Invalid file format for "${file.name}". Allowed formats: PDF, JPG, PNG.`);
        continue;
      }

      if (file.size > MAX_SIZE) {
        showToast("error", `File "${file.name}" exceeds maximum allowed limit of 10MB.`);
        continue;
      }

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const isImage = file.type.startsWith("image/") || ext === ".jpg" || ext === ".jpeg" || ext === ".png";
      const newDoc: UploadedDoc = {
        id: tempId,
        name: file.name,
        size: `${(file.size / 1024).toFixed(0)} KB`,
        type: isImage ? "image" : "pdf",
        status: "uploading",
      };
      setDocs((prev) => [newDoc, ...prev]);

      try {
        const res = await medicalDocumentApi.upload(file, docType);
        if (res.success) {
          const suggestions = res.suggestedConditions || [];
          setDocs((prev) =>
            prev.map((d) =>
              d.id === tempId
                ? {
                    id: res.data.id,
                    name: res.data.fileName,
                    size: `${(res.data.fileSize / 1024).toFixed(0)} KB`,
                    type: isImage ? "image" : "pdf",
                    status: "done",
                    suggestions,
                  }
                : d
            )
          );
          if (suggestions.length > 0) {
            showToast("info", `Document uploaded! Suggested conditions detected: ${suggestions.join(", ")}`);
          } else {
            showToast("success", `${file.name} uploaded and encrypted in your Health Pack.`);
          }
        } else {
          setDocs((prev) => prev.filter((d) => d.id !== tempId));
          showToast("error", res.error || "Failed to upload document.");
        }
      } catch (err: any) {
        setDocs((prev) => prev.filter((d) => d.id !== tempId));
        showToast("error", err.message || "Upload error.");
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await medicalDocumentApi.delete(id);
      if (res.success) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
        showToast("info", "Document removed.");
      }
    } catch (err) {
      showToast("error", "Could not delete document.");
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-5 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary w-fit">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h2 className="font-bold text-navy text-lg">Upload your medical documents</h2>
        <p className="text-sm text-text-secondary mt-1">Reports, prescriptions, and scans are encrypted and added to your secure Health Pack.</p>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-xs font-semibold text-navy">Document Type:</label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="text-xs p-1.5 border rounded border-slate-300 bg-white"
        >
          <option value="LAB_REPORT">Blood / Lab Report</option>
          <option value="PRESCRIPTION">Prescription</option>
          <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
          <option value="DIAGNOSIS_REPORT">Diagnosis Report</option>
          <option value="OTHER">Other Medical Document</option>
        </select>
      </div>

      <Card
        className={`border-2 border-dashed text-center py-10 transition-colors ${dragOver ? "border-sky bg-paleblue" : "border-slate-200"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud className="w-9 h-9 text-sky mx-auto mb-3" />
        <p className="font-semibold text-navy text-sm">Drag & drop files here</p>
        <p className="text-xs text-text-secondary mt-1 mb-4">Allowed formats: PDF, JPG, PNG | Maximum size: 10 MB</p>
        <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
      </Card>

      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Uploaded documents</p>
        <div className="flex flex-col gap-2.5">
          {docs.length === 0 && <p className="text-xs text-slate-400 italic">No documents uploaded yet.</p>}
          {docs.map((d) => (
            <Card key={d.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-lightblue flex items-center justify-center shrink-0">
                    {d.type === "image" ? <ImageIcon className="w-4.5 h-4.5 text-navy-dark" /> : <FileText className="w-4.5 h-4.5 text-navy-dark" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-navy text-sm truncate">{d.name}</p>
                    <p className="text-xs text-text-secondary">{d.size}</p>
                  </div>
                </div>
                {d.status === "uploading" ? (
                  <span className="text-xs font-medium text-sky animate-pulse shrink-0">Uploading...</span>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Encrypted
                    </span>
                    <button onClick={() => handleDelete(d.id)} className="text-slate-400 hover:text-emergency" aria-label="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {d.suggestions && d.suggestions.length > 0 && (
                <div className="bg-paleblue p-2 rounded text-xs text-navy flex items-center gap-1.5 border border-sky/20">
                  <Sparkles className="w-3.5 h-3.5 text-sky shrink-0" />
                  <span><strong>Suggested conditions:</strong> {d.suggestions.join(", ")} (Confirm in Health Pack)</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
