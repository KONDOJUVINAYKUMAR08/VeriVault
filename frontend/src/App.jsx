import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  UserPlus,
  Users,
  Terminal,
  FileLock2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  FileText,
  Key,
  Server,
  Cloud,
  ExternalLink,
  Cpu,
  LogOut,
  Sliders,
  Sparkles,
  Info
} from "lucide-react";

// Set base URL for APIs (works in both local development and when served by FastAPI)
const API_BASE = "";

function App() {
  const [activeTab, setActiveTab] = useState("onboarding"); // "onboarding" | "hr-dashboard" | "soc"
  const [isAwsConsoleOpen, setIsAwsConsoleOpen] = useState(true);
  
  // State for Onboarding Form
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    department: "Engineering",
    ssn: "",
    bankAccount: ""
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);
  const [onboardingSuccessMsg, setOnboardingSuccessMsg] = useState("");
  const [onboardingErrorMsg, setOnboardingErrorMsg] = useState("");

  // State for HR Dashboard
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [decryptedPII, setDecryptedPII] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");
  const [isGeneratingDocUrl, setIsGeneratingDocUrl] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  // State for SOC / Logs
  const [awsLogs, setAwsLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLogPolling, setIsLogPolling] = useState(true);
  const [selectedAwsLog, setSelectedAwsLog] = useState(null);
  const [logSearchText, setLogSearchText] = useState("");
  const [selectedLogService, setSelectedLogService] = useState("All");

  // Ref for auto-scrolling AWS terminal
  const terminalEndRef = useRef(null);

  // Fetch candidates and logs on load
  useEffect(() => {
    fetchCandidates();
    fetchAuditLogs();
    fetchAwsLogs();
  }, []);

  // Poll AWS logs and Audit logs every 2 seconds
  useEffect(() => {
    let interval;
    if (isLogPolling) {
      interval = setInterval(() => {
        fetchAwsLogs();
        fetchAuditLogs();
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isLogPolling]);

  // Scroll to bottom of terminal when logs update
  useEffect(() => {
    if (terminalEndRef.current && isAwsConsoleOpen) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [awsLogs, isAwsConsoleOpen]);

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/candidates`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (e) {
      console.error("Failed to fetch candidates:", e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit-logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error("Failed to fetch audit logs:", e);
    }
  };

  const fetchAwsLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/aws-logs`);
      if (res.ok) {
        const data = await res.json();
        setAwsLogs(data);
      }
    } catch (e) {
      console.error("Failed to fetch AWS logs:", e);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setOnboardingErrorMsg("Please upload your Government Photo ID document.");
      return;
    }

    setIsOnboardingSubmitting(true);
    setOnboardingErrorMsg("");
    setOnboardingSuccessMsg("");

    const data = new FormData();
    data.append("fullName", formData.fullName);
    data.append("email", formData.email);
    data.append("department", formData.department);
    data.append("ssn", formData.ssn);
    data.append("bankAccount", formData.bankAccount);
    data.append("document", selectedFile);

    try {
      const res = await fetch(`${API_BASE}/api/onboard`, {
        method: "POST",
        body: data
      });

      const resData = await res.json();

      if (res.ok) {
        setOnboardingSuccessMsg(
          "Your onboarding profile has been registered securely in VeriVault! All sensitive fields were encrypted instantly using AWS KMS Customer Managed Keys, and your document was uploaded to an encrypted S3 Bucket (SSE-KMS)."
        );
        // Clear form
        setFormData({
          fullName: "",
          email: "",
          department: "Engineering",
          ssn: "",
          bankAccount: ""
        });
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById("file-upload");
        if (fileInput) fileInput.value = "";
        
        // Refresh Lists
        fetchCandidates();
        fetchAwsLogs();
        fetchAuditLogs();
      } else {
        setOnboardingErrorMsg(resData.detail || "Onboarding submission failed.");
      }
    } catch (err) {
      setOnboardingErrorMsg("Unable to connect to the backend server. Please make sure the API is running.");
    } finally {
      setIsOnboardingSubmitting(false);
    }
  };

  const handleSelectCandidate = async (candidate) => {
    setSelectedCandidate(candidate);
    setDecryptedPII(null);
    setDocumentUrl("");
    
    // Fetch complete details including keys
    try {
      const res = await fetch(`${API_BASE}/api/candidates/${candidate.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCandidate(data);
      }
    } catch (e) {
      console.error("Failed to load candidate detail:", e);
    }
  };

  const handleDecryptPII = async (id) => {
    setIsDecrypting(true);
    try {
      const res = await fetch(`${API_BASE}/api/candidates/${id}/decrypt`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setDecryptedPII(data);
        // Refresh logs immediately
        fetchAwsLogs();
        fetchAuditLogs();
      } else {
        alert("Failed to decrypt sensitive data using AWS KMS. Permission Denied.");
      }
    } catch (e) {
      alert("Error calling KMS decrypt API.");
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleGetDocumentUrl = async (id) => {
    setIsGeneratingDocUrl(true);
    try {
      const res = await fetch(`${API_BASE}/api/candidates/${id}/document-url`);
      if (res.ok) {
        const data = await res.json();
        setDocumentUrl(data.presigned_url);
        // Refresh logs immediately
        fetchAwsLogs();
        fetchAuditLogs();
      } else {
        alert("Failed to generate S3 Presigned URL.");
      }
    } catch (e) {
      alert("Error calling S3 presigned URL generator API.");
    } finally {
      setIsGeneratingDocUrl(false);
    }
  };

  const handleTriggerBackgroundCheck = async (id) => {
    setIsVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/api/candidates/${id}/verify`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        // Update local candidate state
        if (selectedCandidate && selectedCandidate.id === id) {
          setSelectedCandidate((prev) => ({
            ...prev,
            status: data.status,
            background_check_result: data.result
          }));
        }
        // Refresh Lists
        fetchCandidates();
        fetchAwsLogs();
        fetchAuditLogs();
      } else {
        alert("Secrets Manager credential retrieval failed.");
      }
    } catch (e) {
      alert("Error calling Background check API.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/candidates/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        if (selectedCandidate && selectedCandidate.id === id) {
          setSelectedCandidate((prev) => ({ ...prev, status: newStatus }));
        }
        fetchCandidates();
        fetchAuditLogs();
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  // Helper to get styling badges for candidate status
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Verified":
      case "Approved":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Rejected":
      case "Verification Failed":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "Background Check In Progress":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse";
      default:
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
  };

  const getBackgroundResultBadgeClass = (res) => {
    switch (res) {
      case "Passed":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Review Required":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "In Progress":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-700";
    }
  };

  // Filter logs for search
  const filteredAwsLogs = awsLogs.filter((log) => {
    const matchesService = selectedLogService === "All" || log.service === selectedLogService;
    const matchesSearch =
      log.operation.toLowerCase().includes(logSearchText.toLowerCase()) ||
      JSON.stringify(log.parameters).toLowerCase().includes(logSearchText.toLowerCase());
    return matchesService && matchesSearch;
  });

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "All" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#080c16] text-slate-100 font-sans">
      
      {/* 1. TOP HEADER BRAND */}
      <header className="border-b border-slate-800 bg-[#0c1222]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/10 border border-indigo-400/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent">
                VeriVault
              </span>
              <span className="text-[10px] font-bold text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/5 uppercase">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400">Secure Candidate & Vendor Background Vault</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 bg-slate-900/85 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab("onboarding")}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === "onboarding"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Onboarding Portal</span>
          </button>
          
          <button
            onClick={() => setActiveTab("hr-dashboard")}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === "hr-dashboard"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>HR Compliance Dashboard</span>
          </button>
          
          <button
            onClick={() => setActiveTab("soc")}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === "soc"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Security Operations Center</span>
          </button>
        </nav>

        {/* Console toggle & Refresh info */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsAwsConsoleOpen(!isAwsConsoleOpen)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${
              isAwsConsoleOpen
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-lg shadow-amber-500/5"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>AWS Console Logs ({isAwsConsoleOpen ? "ON" : "OFF"})</span>
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* VIEWPORT CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
          
          {/* SIMULATION EXPLAINER NOTIFICATION */}
          <div className="mb-6 bg-gradient-to-r from-blue-900/10 to-indigo-900/10 border border-blue-500/20 rounded-xl p-4 flex items-start space-x-3 shadow-md shadow-blue-500/2">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-blue-300">AWS Integration Highlights:</span> This platform implements 
              <strong className="text-blue-100"> Envelope Encryption (AWS KMS)</strong> on SSN and Bank numbers,
              <strong className="text-blue-100"> S3 SSE-KMS storage</strong> for files with 60s Presigned URLs, and retrieves background check keys on demand from 
              <strong className="text-blue-100"> AWS Secrets Manager</strong>. All backend SDK code runs standard logic, outputting detailed parameters to the right side console.
            </div>
          </div>

          {/* TAB 1: PUBLIC ONBOARDING PORTAL */}
          {activeTab === "onboarding" && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Onboarding Profile Portal</h1>
                <p className="text-slate-400 text-sm">
                  Complete your contractor profile below. To meet corporate security compliance policies, your PII is instantly encrypted using dedicated cryptographic keys in AWS KMS, and your ID document is stored securely in S3.
                </p>
              </div>

              {onboardingSuccessMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-sm text-emerald-400 space-y-3 shadow-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="font-bold">Submission Confirmed & Securely Encrypted!</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{onboardingSuccessMsg}</p>
                  <button
                    onClick={() => {
                      setOnboardingSuccessMsg("");
                      setActiveTab("hr-dashboard");
                    }}
                    className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1.5 px-4 rounded-md text-xs transition shadow-md"
                  >
                    Go to HR Dashboard
                  </button>
                </div>
              )}

              {onboardingErrorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-400 flex items-start space-x-2 shadow-lg">
                  <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Submission Error</span>
                    <p className="text-slate-300">{onboardingErrorMsg}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleOnboardSubmit} className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6 shadow-xl">
                <h3 className="text-lg font-bold text-slate-200 border-b border-slate-800 pb-3 flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-blue-500" />
                  <span>Personal Details</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Full Name</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      placeholder="Jane Doe"
                      required
                      className="w-full bg-[#11192e] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="jane.doe@enterprise.com"
                      required
                      className="w-full bg-[#11192e] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Department</label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full bg-[#11192e] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Finance">Finance</option>
                      <option value="Human Resources">Human Resources</option>
                      <option value="Executive Management">Executive Management</option>
                    </select>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-200 border-b border-slate-800 pb-3 pt-4 flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  <span>PII Secured with AWS KMS Envelope Encryption</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Social Security Number (SSN) / National ID
                    </label>
                    <input
                      type="password"
                      name="ssn"
                      value={formData.ssn}
                      onChange={handleInputChange}
                      placeholder="XXX-XX-XXXX"
                      required
                      className="w-full bg-[#11192e] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Direct Deposit Bank Account Number
                    </label>
                    <input
                      type="password"
                      name="bankAccount"
                      value={formData.bankAccount}
                      onChange={handleInputChange}
                      placeholder="Routing: 123456789 | Account: 987654321"
                      required
                      className="w-full bg-[#11192e] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-200 border-b border-slate-800 pb-3 pt-4 flex items-center space-x-2">
                  <Cloud className="w-5 h-5 text-indigo-400" />
                  <span>S3 Photo ID Secure Document Upload (SSE-KMS Enabled)</span>
                </h3>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Scanned Government Photo ID (Passport or Driver's License)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-800 border-dashed rounded-xl bg-[#11192e]/40 hover:bg-[#11192e]/75 transition-all">
                    <div className="space-y-1 text-center">
                      <FileText className="mx-auto h-12 w-12 text-slate-500" />
                      <div className="flex text-sm text-slate-400 justify-center">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-transparent rounded-md font-semibold text-blue-400 hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Upload a file</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} required />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-slate-500">PNG, JPG, PDF up to 10MB</p>
                      {selectedFile && (
                        <div className="mt-2 text-xs font-bold text-emerald-400 bg-emerald-400/5 py-1 px-3 border border-emerald-500/20 rounded-md inline-flex items-center space-x-1">
                          <span>✓ File selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isOnboardingSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl text-sm shadow-xl hover:shadow-indigo-500/10 focus:outline-none transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isOnboardingSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Performing KMS Encryption & Uploading to S3...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Submit Secure Profile</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Graphical workflow */}
              <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center space-x-1.5">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span>VeriVault Architectural Workflow</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <div className="font-semibold text-blue-400 mb-1">1. User Inputs PII</div>
                    <span className="text-slate-400">Plaintext SSN entered; React client submits form to FastAPI backend securely over TLS.</span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <div className="font-semibold text-indigo-400 mb-1">2. KMS Envelope Key</div>
                    <span className="text-slate-400">FastAPI triggers `kms:GenerateDataKey`. Local payload is encrypted, data key destroyed. Ciphertext key stored in DB.</span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <div className="font-semibold text-emerald-400 mb-1">3. S3 Bucket Encryption</div>
                    <span className="text-slate-400">ID Uploaded to S3 with S3 default SSE-KMS setting. S3 talks to KMS on backend before writing.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HR COMPLIANCE DASHBOARD */}
          {activeTab === "hr-dashboard" && (
            <div className="space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <h1 className="text-2xl font-extrabold text-white">HR Compliance Dashboard</h1>
                  <p className="text-slate-400 text-sm">Review, verify, and approve vendor and employee onboarding files with auditable KMS decryption.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search candidate..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-56"
                    />
                  </div>

                  {/* Filter Dropdown */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="All">All Onboarding Statuses</option>
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="Background Check In Progress">Background Check In Progress</option>
                    <option value="Verified">Verified</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  <button
                    onClick={() => { fetchCandidates(); fetchAuditLogs(); }}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
                    title="Refresh Candidate List"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* CANDIDATES GRID (Left: List, Right: Selected Detail Card) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* List Table */}
                <div className="xl:col-span-2 bg-[#0c1222] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  {filteredCandidates.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                      <p className="font-medium text-sm">No candidates found</p>
                      <p className="text-xs mt-1 text-slate-600">Onboard a new candidate using the "Onboarding Portal" tab.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900/50 border-b border-slate-800/80 text-xs text-slate-400 font-bold uppercase tracking-wider">
                            <th className="px-5 py-4">Candidate / Email</th>
                            <th className="px-5 py-4">Department</th>
                            <th className="px-5 py-4">Onboarding Status</th>
                            <th className="px-5 py-4">Verification</th>
                            <th className="px-5 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-xs">
                          {filteredCandidates.map((c) => (
                            <tr
                              key={c.id}
                              onClick={() => handleSelectCandidate(c)}
                              className={`hover:bg-slate-800/20 cursor-pointer transition-all ${
                                selectedCandidate && selectedCandidate.id === c.id
                                  ? "bg-blue-600/10 border-l-2 border-l-blue-500"
                                  : ""
                              }`}
                            >
                              <td className="px-5 py-4">
                                <div className="font-bold text-slate-200">{c.full_name}</div>
                                <div className="text-slate-500 mt-0.5 font-medium">{c.email}</div>
                              </td>
                              <td className="px-5 py-4 text-slate-300 font-medium">{c.department}</td>
                              <td className="px-5 py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusBadgeClass(c.status)}`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getBackgroundResultBadgeClass(c.background_check_result)}`}>
                                  {c.background_check_result}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleSelectCandidate(c)}
                                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-1.5 px-3 rounded-md transition-all border border-slate-700 hover:border-slate-600"
                                >
                                  View PII
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Candidate Security Action Center (Right Panel) */}
                <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6 flex flex-col justify-between">
                  {selectedCandidate ? (
                    <div className="space-y-6">
                      
                      {/* Name & Title */}
                      <div className="border-b border-slate-800 pb-4">
                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">SECURE FILE DETECTOR</span>
                        <h3 className="text-lg font-bold text-white mt-1">{selectedCandidate.full_name}</h3>
                        <p className="text-xs text-slate-500">{selectedCandidate.email}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeClass(selectedCandidate.status)}`}>
                            {selectedCandidate.status}
                          </span>
                        </div>
                      </div>

                      {/* KMS ENVELOPE DETAILS BLOCK */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                            <Lock className="w-4 h-4 text-indigo-400" />
                            <span>KMS Envelope Encrypted fields</span>
                          </h4>
                          
                          <button
                            onClick={() => handleDecryptPII(selectedCandidate.id)}
                            disabled={isDecrypting}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 px-2.5 rounded-md text-[10px] transition disabled:opacity-50 flex items-center space-x-1 shadow-md shadow-indigo-600/10"
                          >
                            {isDecrypting ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Decrypting...</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" />
                                <span>Decrypt with KMS</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* SSN Field */}
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Social Security Number</span>
                          {decryptedPII ? (
                            <div className="text-sm font-mono text-emerald-400 flex items-center space-x-2">
                              <span>{decryptedPII.ssn}</span>
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded">
                                Decrypted
                              </span>
                            </div>
                          ) : (
                            <div className="text-xs font-mono text-slate-500 flex flex-col space-y-1">
                              <span className="text-slate-400">••••-••-••••</span>
                              <div className="text-[9px] text-indigo-400 flex items-center space-x-1">
                                <Key className="w-2.5 h-2.5" />
                                <span className="truncate">Key ID: ...key/hr-pii-encryption</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bank Field */}
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Bank Account Info</span>
                          {decryptedPII ? (
                            <div className="text-sm font-mono text-emerald-400 flex items-center space-x-2">
                              <span>{decryptedPII.bank_account}</span>
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded">
                                Decrypted
                              </span>
                            </div>
                          ) : (
                            <div className="text-xs font-mono text-slate-500 flex flex-col space-y-1">
                              <span className="text-slate-400">••••••••••••••</span>
                              <div className="text-[9px] text-indigo-400 flex items-center space-x-1">
                                <Key className="w-2.5 h-2.5" />
                                <span className="truncate">Key ID: ...key/hr-pii-encryption</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* S3 ENCRYPTED DOCUMENT BLOCK */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                          <Cloud className="w-4 h-4 text-blue-400" />
                          <span>S3 Secure Document Vault</span>
                        </h4>

                        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-300 truncate max-w-[180px]">
                              📁 {selectedCandidate.document_name}
                            </span>
                            <span className="text-[9px] text-blue-400 font-bold border border-blue-500/20 px-1.5 py-0.5 rounded bg-blue-500/5">
                              SSE-KMS Active
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                            This document is stored in bucket <code className="text-slate-400">verivault-candidate-documents</code> and is double-encrypted using an S3 bucket key. Decrypting the key is restricted. To view it, request a 60s temporary URL below.
                          </p>

                          <div className="space-y-2">
                            <button
                              onClick={() => handleGetDocumentUrl(selectedCandidate.id)}
                              disabled={isGeneratingDocUrl}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/10"
                            >
                              {isGeneratingDocUrl ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Generating Presigned URL...</span>
                                </>
                              ) : (
                                <>
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Request S3 Presigned URL</span>
                                </>
                              )}
                            </button>

                            {documentUrl && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 space-y-2 animate-fade-in">
                                <div className="text-[10px] font-bold text-emerald-400 flex items-center space-x-1">
                                  <span>✓ Generated Signed S3 URL! Valid for 60s.</span>
                                </div>
                                <div className="flex space-x-2">
                                  <a
                                    href={documentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-2 rounded text-center text-[10px] transition flex items-center justify-center space-x-1"
                                  >
                                    <span>Open Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* AWS SECRETS MANAGER BACKGROUND VERIFICATION */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                          <Server className="w-4 h-4 text-indigo-400" />
                          <span>Secrets Manager Verification System</span>
                        </h4>

                        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 text-xs space-y-3">
                          <p className="text-[10px] text-slate-500 leading-relaxed">
                            Triggers background check by using 
                            <strong className="text-slate-400"> AWS Secrets Manager</strong> to fetch API endpoint credentials (API Keys, Client ID) on-the-fly and authenticates with the screening agency.
                          </p>

                          <button
                            onClick={() => handleTriggerBackgroundCheck(selectedCandidate.id)}
                            disabled={isVerifying || selectedCandidate.background_check_result === "Passed"}
                            className={`w-full font-bold py-1.5 px-3 rounded-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 shadow-md ${
                              selectedCandidate.background_check_result === "Passed"
                                ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10"
                            }`}
                          >
                            {isVerifying ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Contacting Agency via Secrets Manager...</span>
                              </>
                            ) : (
                              <>
                                <Shield className="w-3.5 h-3.5" />
                                <span>
                                  {selectedCandidate.background_check_result === "Passed"
                                    ? "Background Verified (Passed)"
                                    : "Run Background Check"}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* ADMINISTRATIVE STATUS ACTIONS */}
                      <div className="border-t border-slate-800 pt-4 space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Update Candidate Status</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(selectedCandidate.id, "Approved")}
                            className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold py-1.5 rounded transition text-[10px]"
                          >
                            Approve Candidate
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(selectedCandidate.id, "Rejected")}
                            className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold py-1.5 rounded transition text-[10px]"
                          >
                            Reject Candidate
                          </button>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-600 space-y-2 my-12">
                      <Lock className="w-12 h-12 text-slate-700" />
                      <p className="font-semibold text-sm text-slate-500">No Candidate Selected</p>
                      <p className="text-xs">Click on any candidate profile in the list to open the AWS Secure Action Panel.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: SECURITY OPERATIONS CENTER (SOC) */}
          {activeTab === "soc" && (
            <div className="space-y-6">
              
              <div className="border-b border-slate-800 pb-5">
                <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                  <Shield className="w-7 h-7 text-indigo-400" />
                  <span>Security Operations Center & Audit Logs</span>
                </h1>
                <p className="text-slate-400 text-sm">Review full compliance histories, tamper-evident application logs, and system operations ledger in real time.</p>
              </div>

              {/* AUDIT LOG TABLE */}
              <div className="bg-[#0c1222] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-slate-900/50 px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-200 text-sm flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-indigo-400" />
                      <span>Tamper-Evident Security Audit Ledger</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">Stores operational security events in local compliance-secured table.</p>
                  </div>
                  <button
                    onClick={fetchAuditLogs}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Ledger</span>
                  </button>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    No security events recorded. Use the "Onboarding Portal" or "HR Compliance Dashboard" to generate traffic.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/30 border-b border-slate-800 text-slate-400 font-semibold">
                          <th className="px-5 py-3">Timestamp (UTC)</th>
                          <th className="px-5 py-3">Security Actor</th>
                          <th className="px-5 py-3">Action Event</th>
                          <th className="px-5 py-3">Description Details</th>
                          <th className="px-5 py-3">Resource Target</th>
                          <th className="px-5 py-3 text-right">Node IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-slate-300 font-medium">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/10">
                            <td className="px-5 py-3 font-mono text-slate-500 text-[10px] whitespace-nowrap">
                              {log.timestamp}
                            </td>
                            <td className="px-5 py-3 font-bold text-slate-200">
                              {log.actor}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                                log.action.includes("FAILED")
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : log.action.includes("DECRYPT")
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-400 max-w-sm font-sans leading-normal">
                              {log.detail}
                            </td>
                            <td className="px-5 py-3 font-mono text-[10px] text-slate-500 truncate max-w-[150px]">
                              {log.resource}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-500 font-mono text-[10px]">
                              {log.ip_address}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* AWS OPERATIONS ANALYSIS BOX */}
              <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h4 className="text-sm font-bold text-slate-200 flex items-center space-x-1.5 border-b border-slate-800 pb-3">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  <span>Interactive AWS Key Policy & Architecture Analysis</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-400 leading-relaxed">
                  <div className="space-y-2">
                    <span className="font-bold text-slate-200 block">KMS Envelope Key Policies:</span>
                    <p>
                      In our production AWS environment, the KMS Key Policy for <code className="text-slate-300">key/hr-pii-encryption</code> restricts access only to active HR Admins and specific IAM roles assigned to background-check microservices. Standard developers, database admins, and guest users are blocked from executing <code className="text-indigo-400 font-semibold">kms:Decrypt</code>, meaning even if the SQL database is leaked, raw Social Security Numbers remain fully secure.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="font-bold text-slate-200 block">Secrets Manager Automated Rotation:</span>
                    <p>
                      Our mock background-check endpoint utilizes keys fetched on-the-fly from Secrets Manager. In AWS, the service can run serverless Lambda scripts to rotate the API credential for the screening agency every 30 days automatically. This eliminates the risk of hardcoded environment keys across developer repositories, and limits security exposure during key rotations.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>

        {/* 2. PERSISTENT DYNAMIC AWS CONSOLE PANEL (RIGHT BAR) */}
        {isAwsConsoleOpen && (
          <aside className="w-[360px] xl:w-[420px] bg-[#03060c] border-l border-slate-800 flex flex-col justify-between overflow-hidden relative">
            
            {/* Console Header */}
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4.5 h-4.5 text-amber-500" />
                <span className="font-bold font-mono text-xs text-amber-400 tracking-wider">AWS CLOUD OPERATIONAL CONSOLE</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsLogPolling(!isLogPolling)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                    isLogPolling ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {isLogPolling ? "LIVE POLL" : "PAUSED"}
                </button>
                <button
                  onClick={() => setAwsLogs([])}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                  title="Clear Console"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Filter Sub-Header */}
            <div className="px-4 py-2 bg-[#060a12] border-b border-slate-800 flex items-center justify-between text-[10px]">
              <div className="flex space-x-1">
                {["All", "KMS", "S3", "SecretsManager"].map((svc) => (
                  <button
                    key={svc}
                    onClick={() => setSelectedLogService(svc)}
                    className={`px-2 py-0.5 rounded font-mono ${
                      selectedLogService === svc
                        ? "bg-amber-500 text-black font-extrabold"
                        : "text-slate-400 hover:text-slate-200 bg-slate-900/60"
                    }`}
                  >
                    {svc}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Filter logs..."
                value={logSearchText}
                onChange={(e) => setLogSearchText(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-slate-200 placeholder-slate-600 focus:outline-none w-28 font-mono"
              />
            </div>

            {/* Logs Output Terminal */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-3 custom-scrollbar bg-slate-950/40">
              {filteredAwsLogs.length === 0 ? (
                <div className="text-slate-600 italic text-center pt-8">
                  -- Waiting for AWS API events --<br />
                  <span className="text-[9px] mt-1 block">Onboard a candidate, decrypt PII, or request a document URL to trigger AWS SDK actions in real time!</span>
                </div>
              ) : (
                filteredAwsLogs.map((log) => {
                  const isKMS = log.service === "KMS";
                  const isS3 = log.service === "S3";
                  const svcColor = isKMS ? "text-indigo-400" : isS3 ? "text-blue-400" : "text-purple-400";
                  const opColor = isKMS ? "text-indigo-300" : isS3 ? "text-blue-300" : "text-purple-300";

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedAwsLog(log)}
                      className={`p-2 border rounded-lg cursor-pointer transition-all ${
                        selectedAwsLog && selectedAwsLog.id === log.id
                          ? "bg-slate-900/90 border-amber-500/50"
                          : "bg-slate-900/40 border-slate-900 hover:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 text-[9px] text-slate-500">
                        <span>{log.timestamp.split("T")[1].replace("Z", "")}</span>
                        <span className={`font-bold uppercase ${svcColor}`}>{log.service}</span>
                      </div>
                      <div className="flex items-center justify-between text-amber-400">
                        <span className={`font-bold ${opColor}`}>aws {log.service.toLowerCase()} {log.operation}</span>
                        <span className="text-emerald-400 text-[9px] font-bold">200 OK</span>
                      </div>
                      <div className="text-slate-400 truncate mt-1 text-[9px]">
                        {JSON.stringify(log.parameters)}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Selected AWS Log Inspector Drawer (Overlay at bottom of Console) */}
            {selectedAwsLog && (
              <div className="bg-[#0b101c] border-t border-amber-500/30 p-4 space-y-3 absolute bottom-0 left-0 right-0 max-h-[70%] overflow-y-auto custom-scrollbar z-20 animate-slide-up shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold text-[10px] font-mono text-amber-400 uppercase">
                      API Payload Inspector
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedAwsLog(null)}
                    className="text-slate-400 hover:text-white font-bold text-xs"
                  >
                    [X] CLOSE
                  </button>
                </div>

                <div className="space-y-2 text-[9px] font-mono leading-normal">
                  <div>
                    <span className="text-amber-500">Service:</span>{" "}
                    <span className="text-slate-300 font-bold">{selectedAwsLog.service}</span>
                  </div>
                  <div>
                    <span className="text-amber-500">SDK Operation:</span>{" "}
                    <span className="text-emerald-400 font-bold">{selectedAwsLog.operation}</span>
                  </div>
                  <div>
                    <span className="text-amber-500 block mb-1">Request Parameters:</span>
                    <pre className="bg-[#03060c] p-2 rounded border border-slate-800 text-slate-300 overflow-x-auto text-[9px] custom-scrollbar max-h-32">
                      {JSON.stringify(selectedAwsLog.parameters, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-amber-500 block mb-1">Response Payload:</span>
                    <pre className="bg-[#03060c] p-2 rounded border border-slate-800 text-emerald-400 overflow-x-auto text-[9px] custom-scrollbar max-h-36">
                      {JSON.stringify(selectedAwsLog.response_payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Quick architectural footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 leading-normal font-sans">
              <span className="font-bold text-slate-400 block mb-0.5">Secure Storage Verification:</span>
              SQLite database records can be browsed in the compliance panel. Actual encrypted binary payloads are generated securely in python.
            </div>

          </aside>
        )}

      </div>
    </div>
  );
}

export default App;
