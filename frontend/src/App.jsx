import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Search,
  FileText,
  History,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  Newspaper,
  Sparkles,
  Upload,
  LayoutDashboard,
  FileSearch,
  Clock,
  X,
  Lightbulb,
} from "lucide-react";
import "./App.css";

const API_URL = "http://127.0.0.1:5000/api";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ARTICLE_LENGTH = 20000;
const HISTORY_KEY = "newsguard_history";

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function normalizeProbability(value) {
  const number = Number(value ?? 0);
  return number <= 1 ? number * 100 : number;
}

function getPredictionLabel(data) {
  const probabilities = data?.probabilities || {};

  const fake = normalizeProbability(probabilities.Fake);
  const real = normalizeProbability(probabilities.Real);

  if (fake > real) return "Fake";
  if (real > fake) return "Real";

  const label = String(
    data?.model_prediction || data?.prediction || "",
  ).toLowerCase();

  if (label.includes("fake")) return "Fake";
  if (label.includes("real")) return "Real";

  return "Uncertain";
}

function formatPercent(value) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [article, setArticle] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState(getHistory);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const saveToHistory = (articleText, analysis) => {
    const record = {
      id: Date.now(),
      article: articleText,
      prediction: analysis.prediction,
      model_prediction: analysis.model_prediction,
      confidence: analysis.confidence,
      probabilities: analysis.probabilities,
      explanations: analysis.explanations,
      explanation_note: analysis.explanation_note,
      date: new Date().toLocaleString(),
    };

    setHistory((previous) => [record, ...previous].slice(0, 50));
  };

  const analyzeArticle = async () => {
    setError("");
    setSuccess("");
    setResult(null);

    const cleanedArticle = article.trim();

    if (!cleanedArticle) {
      setError("Please enter a news article before analyzing.");
      return;
    }

    if (cleanedArticle.length > MAX_ARTICLE_LENGTH) {
      setError(
        "The article is too long. Please keep it under 20,000 characters.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article: cleanedArticle }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Unable to analyze the article.",
        );
      }

      const prediction = getPredictionLabel(data);

      const analysisResult = {
        prediction,
        model_prediction:
          data.model_prediction || data.prediction || prediction,
        confidence: normalizeProbability(data.confidence),
        probabilities: {
          Fake: normalizeProbability(data.probabilities?.Fake),
          Real: normalizeProbability(data.probabilities?.Real),
        },
        explanations: data.explanations || [],
        explanation_note: data.explanation_note || "",
        note: data.note || "",
      };

      setResult(analysisResult);
      saveToHistory(cleanedArticle, analysisResult);
      setSuccess("Article analysis completed.");
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the backend. Check that Flask is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccess("");
    setResult(null);

    const allowedExtensions = [".txt", ".pdf", ".docx"];
    const extension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setError("Please upload a TXT, PDF, or DOCX file.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File size must be 10 MB or less.");
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "File upload failed.");
      }

      const extractedText = data.text || data.article || "";

      if (!extractedText.trim()) {
        throw new Error("No readable text was found in this file.");
      }

      setArticle(extractedText.slice(0, MAX_ARTICLE_LENGTH));
      setPage("analysis");
      setSuccess(
        `Text extracted from ${file.name}. Click Analyze Article to check it.`,
      );
    } catch (err) {
      setError(err.message || "Unable to upload the document.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deleteRecord = (id) => {
    setHistory((previous) => previous.filter((item) => item.id !== id));
  };

  const clearHistory = () => {
    if (
      window.confirm("Are you sure you want to clear all analysis history?")
    ) {
      setHistory([]);
    }
  };

  const openRecord = (record) => {
    setArticle(record.article || "");

    const prediction = getPredictionLabel(record);

    setResult({
      prediction,
      model_prediction: record.model_prediction || prediction,
      confidence: normalizeProbability(record.confidence),
      probabilities: {
        Fake: normalizeProbability(record.probabilities?.Fake),
        Real: normalizeProbability(record.probabilities?.Real),
      },
      explanations: record.explanations || [],
      explanation_note: record.explanation_note || "",
      note: "",
    });

    setError("");
    setSuccess("");
    setPage("analysis");
  };

  const startNewAnalysis = () => {
    setArticle("");
    setResult(null);
    setError("");
    setSuccess("");
    setPage("analysis");
  };

  const totalAnalyses = history.length;

  const fakeCount = history.filter(
    (item) => getPredictionLabel(item) === "Fake",
  ).length;

  const realCount = history.filter(
    (item) => getPredictionLabel(item) === "Real",
  ).length;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={25} />
          </div>
          <div>
            <h2>NewsGuard AI</h2>
            <span>News credibility checker</span>
          </div>
        </div>

        <div className="sidebar-label">MENU</div>

        <nav className="sidebar-nav">
          <button
            className={page === "dashboard" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setPage("dashboard");
              setError("");
              setSuccess("");
            }}
          >
            <LayoutDashboard size={19} />
            Dashboard
          </button>

          <button
            className={page === "analysis" ? "nav-item active" : "nav-item"}
            onClick={startNewAnalysis}
          >
            <FileSearch size={19} />
            Analyze News
          </button>

          <button
            className={page === "history" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setPage("history");
              setError("");
              setSuccess("");
            }}
          >
            <History size={19} />
            Analysis History
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-info">
            <ShieldCheck size={21} />
            <div>
              <strong>NewsGuard AI</strong>
              <p>AI-powered news analysis</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>
              {page === "dashboard"
                ? "Dashboard"
                : page === "analysis"
                  ? "News Analysis"
                  : "Analysis History"}
            </h1>
            <p>Analyze news articles with artificial intelligence</p>
          </div>

          <button
            className="primary-button top-action"
            onClick={startNewAnalysis}
          >
            <Sparkles size={17} />
            New Analysis
          </button>
        </header>

        {error && (
          <div className="alert alert-error">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Close error">
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <span>{success}</span>
            <button onClick={() => setSuccess("")} aria-label="Close message">
              <X size={17} />
            </button>
          </div>
        )}

        {page === "dashboard" && (
          <Dashboard
            totalAnalyses={totalAnalyses}
            fakeCount={fakeCount}
            realCount={realCount}
            history={history}
            onAnalyze={startNewAnalysis}
            onHistory={() => setPage("history")}
            onOpenRecord={openRecord}
          />
        )}

        {page === "analysis" && (
          <section className="analysis-page">
            <div className="section-heading">
              <div>
                <h2>Analyze a News Article</h2>
                <p>
                  Paste an article or upload a document to check its
                  classification.
                </p>
              </div>
            </div>

            <div className="analysis-card">
              <div className="input-header">
                <label htmlFor="article-input">
                  <FileText size={18} />
                  Article Content
                </label>
                <span>
                  {article.length.toLocaleString()} /{" "}
                  {MAX_ARTICLE_LENGTH.toLocaleString()} characters
                </span>
              </div>

              <textarea
                id="article-input"
                className="article-textarea"
                placeholder="Paste a short, medium or long news article here..."
                value={article}
                maxLength={MAX_ARTICLE_LENGTH}
                onChange={(event) => {
                  setArticle(event.target.value);
                  setResult(null);
                  setError("");
                  setSuccess("");
                }}
              />

              <div className="input-footer">
                <span>
                  Short, medium and long articles accepted. No minimum length.
                </span>

                <label className="upload-button">
                  {uploading ? (
                    <>
                      <Loader2 size={17} className="spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={17} />
                      Upload File
                    </>
                  )}
                  <input
                    type="file"
                    accept=".txt,.pdf,.docx"
                    onChange={uploadDocument}
                    disabled={uploading}
                    hidden
                  />
                </label>
              </div>

              <button
                className="primary-button analyze-button"
                onClick={analyzeArticle}
                disabled={loading || uploading || !article.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={19} className="spin" />
                    Analyzing Article...
                  </>
                ) : (
                  <>
                    <Search size={19} />
                    Analyze Article
                  </>
                )}
              </button>
            </div>

            {result && <ResultCard result={result} />}
          </section>
        )}

        {page === "history" && (
          <HistoryPage
            history={history}
            onOpenRecord={openRecord}
            onDelete={deleteRecord}
            onClear={clearHistory}
            onNew={startNewAnalysis}
          />
        )}
      </main>
    </div>
  );
}

function Dashboard({
  totalAnalyses,
  fakeCount,
  realCount,
  history,
  onAnalyze,
  onHistory,
  onOpenRecord,
}) {
  return (
    <section className="dashboard-page">
      <div className="welcome-card">
        <div>
          <span className="welcome-tag">
            <Sparkles size={15} /> AI NEWS ANALYSIS
          </span>
          <h2>Welcome to NewsGuard AI</h2>
          <p>
            Turn any news article into an AI-powered Fake or Real
            classification.
          </p>
          <button className="primary-button" onClick={onAnalyze}>
            <Search size={17} />
            Analyze an Article
          </button>
        </div>
        <div className="welcome-illustration">
          <Newspaper size={90} strokeWidth={1.2} />
          <ShieldCheck size={43} />
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          icon={<Activity size={22} />}
          title="Total Analyses"
          value={totalAnalyses}
          description="Articles analyzed"
        />
        <StatCard
          icon={<AlertTriangle size={22} />}
          title="Fake News"
          value={fakeCount}
          description="Classified as Fake"
        />
        <StatCard
          icon={<CheckCircle2 size={22} />}
          title="Real News"
          value={realCount}
          description="Classified as Real"
        />
      </div>

      <div className="recent-section">
        <div className="section-heading">
          <div>
            <h2>Recent Analyses</h2>
            <p>Your latest news classification results</p>
          </div>
          <button className="text-button" onClick={onHistory}>
            View All <span>→</span>
          </button>
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={<History size={30} />}
            title="No analyses yet"
            description="Your recent article analyses will appear here."
          />
        ) : (
          <div className="history-list">
            {history.slice(0, 5).map((record) => (
              <HistoryRow
                key={record.id}
                record={record}
                onOpen={() => onOpenRecord(record)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({ icon, title, value, description }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="stat-title">{title}</p>
        <h3>{value}</h3>
        <span>{description}</span>
      </div>
    </div>
  );
}

function ResultCard({ result }) {
  const isFake = result.prediction === "Fake";
  const fakeProbability = normalizeProbability(result.probabilities?.Fake);
  const realProbability = normalizeProbability(result.probabilities?.Real);

  const explanations = result.explanations || [];

  return (
    <div className="result-card">
      <div className="result-header">
        <div>
          <span className="result-eyebrow">ANALYSIS RESULT</span>
          <h2>News Classification</h2>
        </div>
        <span className="result-status">Completed</span>
      </div>

      <div className="prediction-content">
        <div
          className={
            isFake ? "prediction-icon fake-bg" : "prediction-icon real-bg"
          }
        >
          {isFake ? <AlertTriangle size={30} /> : <CheckCircle2 size={30} />}
        </div>

        <div className="prediction-details">
          <span>Predicted Classification</span>
          <h2 className={isFake ? "fake-text" : "real-text"}>
            {result.prediction === "Uncertain"
              ? "Uncertain"
              : isFake
                ? "Fake News"
                : "Real News"}
          </h2>
          <p>Model confidence: {formatPercent(result.confidence)}</p>
        </div>
      </div>

      <div className="probability-section">
        <h3 className="probability-title">Prediction Probabilities</h3>

        <div className="probability-item">
          <div className="probability-label">
            <span>Fake News</span>
            <strong>{formatPercent(fakeProbability)}</strong>
          </div>
          <div className="progress">
            <div
              className="fake-bar"
              style={{ width: `${Math.min(100, fakeProbability)}%` }}
            />
          </div>
        </div>

        <div className="probability-item">
          <div className="probability-label">
            <span>Real News</span>
            <strong>{formatPercent(realProbability)}</strong>
          </div>
          <div className="progress">
            <div
              className="real-bar"
              style={{ width: `${Math.min(100, realProbability)}%` }}
            />
          </div>
        </div>
      </div>

      {/* NEW: Prediction explanation */}
      <div className="probability-section explanation-section">
        <h3 className="probability-title">
          <Lightbulb size={19} />
          Why this prediction?
        </h3>

        <p className="explanation-description">
          These are the word patterns that influenced the model's prediction.
        </p>

        {explanations.length > 0 ? (
          <div className="explanation-list">
            {explanations.map((item, index) => (
              <div className="explanation-item" key={`${item.term}-${index}`}>
                <span className="explanation-term">{item.term}</span>

                <span
                  className={
                    item.influence === "supports_fake"
                      ? "history-badge fake-badge"
                      : "history-badge real-badge"
                  }
                >
                  {item.influence === "supports_fake"
                    ? "Supports Fake"
                    : "Supports Real"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="explanation-description">
            No strong word-level signals were available for this article.
          </p>
        )}

        <p className="explanation-disclaimer">
          {result.explanation_note ||
            "These patterns are statistical signals learned by the model, not proof of factual accuracy."}
        </p>
      </div>

      <div className="result-disclaimer">
        <AlertTriangle size={17} />
        <p>
          This result is an AI model prediction based on patterns learned from
          its training dataset. It is not independent fact-checking. Verify
          important information using reliable sources.
        </p>
      </div>
    </div>
  );
}

function HistoryPage({ history, onOpenRecord, onDelete, onClear, onNew }) {
  return (
    <section className="history-page">
      <div className="section-heading">
        <div>
          <h2>Analysis History</h2>
          <p>Review your previously analyzed articles.</p>
        </div>

        {history.length > 0 && (
          <button className="danger-button" onClick={onClear}>
            <Trash2 size={16} />
            Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={<History size={30} />}
          title="Your history is empty"
          description="Analyze a news article to see it listed here."
          action={
            <button className="primary-button" onClick={onNew}>
              <Search size={17} />
              Start Analysis
            </button>
          }
        />
      ) : (
        <div className="history-list">
          {history.map((record) => (
            <HistoryRow
              key={record.id}
              record={record}
              onOpen={() => onOpenRecord(record)}
              onDelete={() => onDelete(record.id)}
              showDelete
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryRow({ record, onOpen, onDelete, showDelete = false }) {
  const prediction = getPredictionLabel(record);
  const isFake = prediction === "Fake";
  const preview = (record.article || "").replace(/\s+/g, " ").trim();

  return (
    <div className="history-row">
      <div className="history-row-icon">
        <FileText size={21} />
      </div>

      <button className="history-row-content" onClick={onOpen}>
        <strong>{preview.slice(0, 100) || "Untitled article"}</strong>
        <span>
          <Clock size={13} />
          {record.date || "Previous analysis"}
        </span>
      </button>

      <span
        className={
          isFake ? "history-badge fake-badge" : "history-badge real-badge"
        }
      >
        {prediction}
      </span>

      <span className="history-confidence">
        {formatPercent(normalizeProbability(record.confidence))}
      </span>

      {showDelete && (
        <button
          className="icon-button delete-button"
          onClick={onDelete}
          aria-label="Delete this record"
        >
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
