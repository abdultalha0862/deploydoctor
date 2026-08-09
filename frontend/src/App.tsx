import { useState } from "react";
import "./App.css";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Diagnosis = {
  diagnosis: string;
  likelyCause: string;
  evidence: string[];
  recommendation: string;
  nextSteps?: string[];
  severity?: Severity;
  category?: string;
  confidence: number;
};

type Example = {
  label: string;
  title: string;
  environment: string;
  description: string;
  logs: string;
};

const EXAMPLES: Example[] = [
  {
    label: "PostgreSQL",
    title: "PostgreSQL connection failure",
    environment: "docker",
    description: "App fails to boot after deploy.",
    logs: "Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect [as oncomplete]",
  },
  {
    label: "Migrations",
    title: "Query fails at runtime",
    environment: "docker",
    description: "Endpoint 500s on first request.",
    logs: 'PrismaClientKnownRequestError: The table `public.users` does not exist\nerror: relation "users" does not exist',
  },
  {
    label: "Redis",
    title: "Cache unreachable",
    environment: "docker",
    description: "Sessions stopped persisting.",
    logs: "Error: connect ECONNREFUSED 10.0.0.5:6379\n    at Socket.<anonymous> (ioredis)",
  },
  {
    label: "Docker port",
    title: "Container won't start",
    environment: "docker",
    description: "Fails immediately on docker run.",
    logs: "docker: Error response from daemon: driver failed programming external connectivity: Bind for 0.0.0.0:3000 failed: port is already allocated.",
  },
  {
    label: "Docker image",
    title: "Image pull failed",
    environment: "docker",
    description: "Deploy can't fetch the image.",
    logs: "Error response from daemon: manifest for myorg/api:latest not found: manifest unknown",
  },
  {
    label: "CrashLoopBackOff",
    title: "Pod keeps restarting",
    environment: "kubernetes",
    description: "New rollout never becomes ready.",
    logs: "NAME              READY   STATUS             RESTARTS\napi-7d9f8c6b-2xk   0/1     CrashLoopBackOff   6",
  },
  {
    label: "Node OOM",
    title: "Process crashes under load",
    environment: "docker",
    description: "Container restarts during traffic spikes.",
    logs: "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
  },
  {
    label: "DNS ENOTFOUND",
    title: "External service unreachable",
    environment: "docker",
    description: "Outbound call fails intermittently.",
    logs: "Error: getaddrinfo ENOTFOUND api.internal.svc.cluster.local",
  },
  {
    label: "502",
    title: "App returns 502",
    environment: "nginx",
    description: "Users see Bad Gateway after deploy.",
    logs: "[error] connect() failed (111: Connection refused) while connecting to upstream\nHTTP/1.1 502 Bad Gateway",
  },
  {
    label: "Missing env",
    title: "App exits on boot",
    environment: "docker",
    description: "Crashes before serving traffic.",
    logs: "Error: DATABASE_URL is undefined\n    at loadConfig (/app/dist/config.js:12:11)",
  },
];

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function App() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState("docker");
  const [logs, setLogs] = useState("");

  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function loadExample(example: Example) {
    setTitle(example.title);
    setEnvironment(example.environment);
    setDescription(example.description);
    setLogs(example.logs);
    setDiagnosis(null);
    setError("");
  }

  async function analyzeIncident() {
    setLoading(true);
    setError("");
    setDiagnosis(null);

    try {
      const createResponse = await fetch(`${API_URL}/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          environment,
          logs,
          severity: "HIGH",
        }),
      });

      if (!createResponse.ok) {
        throw new Error("Failed to create incident");
      }

      const incident = await createResponse.json();

      const analyzeResponse = await fetch(
        `${API_URL}/incidents/${incident.id}/analyze`,
        {
          method: "POST",
        },
      );

      if (!analyzeResponse.ok) {
        const response = await analyzeResponse.json().catch(() => null);

        throw new Error(
          response?.error || "Failed to analyze incident",
        );
      }

      const result: Diagnosis = await analyzeResponse.json();

      setDiagnosis(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the incident.",
      );
    } finally {
      setLoading(false);
    }
  }

  const confidencePct = diagnosis
    ? Math.round(diagnosis.confidence * 100)
    : 0;
  const logLineCount = logs ? logs.split("\n").length : 0;

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img">
              <path
                d="M1 12h5l2-7 4 14 2-7h9"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-name">DeployDoctor</span>
            <span className="brand-tag">incident diagnostics</span>
          </span>
        </a>

        <div className="status" title="Analyzer status">
          <span className="status-dot" aria-hidden="true" />
          <span>analyzer online</span>
        </div>
      </header>

      <section className="intro">
        <h1>
          Read the failure.
          <br />
          Ship the fix.
        </h1>
        <p className="lede">
          Paste a deployment or runtime log. DeployDoctor pinpoints the
          likely cause and tells you exactly what to do next — no
          guesswork, no scrolling through a wall of stack traces.
        </p>
      </section>

      <section className="workspace">
        <div className="panel panel-input">
          <div className="panel-head">
            <span className="panel-kicker">01 — Incident</span>
            <h2>Describe the failure</h2>
          </div>

          <div className="examples">
            <span className="examples-label">Try an example</span>
            <div className="chips">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  className="chip"
                  onClick={() => loadExample(example)}
                  disabled={loading}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form">
            <div className="field-row">
              <label className="field">
                <span className="field-label">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Database migration failed"
                />
              </label>

              <label className="field">
                <span className="field-label">Environment</span>
                <input
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(event.target.value)
                  }
                  placeholder="docker"
                />
              </label>
            </div>

            <label className="field">
              <span className="field-label">
                Description <span className="optional">optional</span>
              </span>
              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="What changed? When did it start failing?"
                rows={2}
              />
            </label>

            <div className="field">
              <span className="field-label">Deployment logs</span>
              <div className="console">
                <div className="console-bar">
                  <span className="dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="console-file">incident.log</span>
                  <span className="console-meta">
                    {logLineCount} {logLineCount === 1 ? "line" : "lines"}
                  </span>
                </div>
                <textarea
                  className="logs"
                  value={logs}
                  onChange={(event) => setLogs(event.target.value)}
                  placeholder={
                    "Paste your deployment or runtime logs here…\n\n" +
                    'Migration failed: relation "users" does not exist'
                  }
                  rows={11}
                  spellCheck={false}
                />
              </div>
            </div>

            <button
              className="analyze-button"
              onClick={analyzeIncident}
              disabled={loading || !title || !logs}
            >
              {loading ? "Analyzing…" : "Run diagnosis"}
            </button>
          </div>
        </div>

        <div className="panel panel-output">
          {!diagnosis && !loading && !error && (
            <div className="placeholder">
              <div className="ekg" aria-hidden="true">
                <svg viewBox="0 0 240 60" role="img">
                  <polyline
                    points="0,30 70,30 84,30 92,10 104,50 116,30 130,30 240,30"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2>Awaiting a log</h2>
              <p>
                Once you run a diagnosis, the likely cause, supporting
                evidence, and the recommended fix show up here.
              </p>
            </div>
          )}

          {loading && (
            <div className="placeholder">
              <div className="spinner" />
              <h2>Analyzing incident…</h2>
              <p>
                Matching known failure signatures, then consulting the AI
                analyzer for anything unfamiliar.
              </p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <span className="panel-kicker error-kicker">
                Analysis failed
              </span>
              <h2>We couldn&apos;t complete the diagnosis</h2>
              <p>{error}</p>
            </div>
          )}

          {diagnosis && (
            <div className="diagnosis">
              <div className="diagnosis-head">
                <div className="badges">
                  {diagnosis.severity && (
                    <span
                      className={`badge badge--${diagnosis.severity.toLowerCase()}`}
                    >
                      {diagnosis.severity}
                    </span>
                  )}
                  {diagnosis.category && (
                    <span className="badge badge--category">
                      {diagnosis.category}
                    </span>
                  )}
                </div>
                <h2>{diagnosis.diagnosis}</h2>

                <div className="confidence">
                  <div className="confidence-top">
                    <span>Confidence</span>
                    <strong>{confidencePct}%</strong>
                  </div>
                  <div
                    className="meter"
                    role="progressbar"
                    aria-valuenow={confidencePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${confidencePct}%` }} />
                  </div>
                </div>
              </div>

              <div className="result-section">
                <h3>Likely cause</h3>
                <p>{diagnosis.likelyCause}</p>
              </div>

              <div className="result-section">
                <h3>Evidence</h3>
                <ul className="evidence">
                  {diagnosis.evidence.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="recommendation">
                <h3>Recommended fix</h3>
                <p>{diagnosis.recommendation}</p>
              </div>

              {diagnosis.nextSteps && diagnosis.nextSteps.length > 0 && (
                <div className="next-steps">
                  <h3>Next steps</h3>
                  <ol>
                    {diagnosis.nextSteps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="page-foot">
        <span>DeployDoctor</span>
        <span className="foot-sep">/</span>
        <span>from red logs to a green deploy</span>
      </footer>
    </div>
  );
}

export default App;