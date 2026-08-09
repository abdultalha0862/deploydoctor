export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Diagnosis = {
  diagnosis: string;
  likelyCause: string;
  evidence: string[];
  recommendation: string;
  nextSteps: string[];
  severity: Severity;
  category: string;
  confidence: number;
};

type Pattern = Diagnosis & {
  match: (logs: string) => boolean;
};

const PATTERNS: Pattern[] = [
  {
    category: "DATABASE",
    severity: "HIGH",
    confidence: 0.93,
    match: (l) =>
      l.includes("does not exist") &&
      (l.includes("relation") || l.includes("table")),
    diagnosis: "A database query referenced a table that does not exist.",
    likelyCause:
      "Database migrations have not been applied, so the schema is missing the table the application expects.",
    evidence: [
      'PostgreSQL reported: relation "..." does not exist.',
      "The query targets a table that is absent from the current schema.",
      "This usually means migrations were skipped or failed before startup.",
    ],
    recommendation:
      "Run your database migrations against the deployed database before starting the application.",
    nextSteps: [
      "Confirm DATABASE_URL points at the deployed database.",
      "Apply migrations (e.g. `npx prisma migrate deploy`).",
      "Redeploy and verify the table now exists.",
    ],
  },
  {
    category: "DATABASE",
    severity: "HIGH",
    confidence: 0.95,
    match: (l) => l.includes("econnrefused") && l.includes("5432"),
    diagnosis: "The application cannot connect to PostgreSQL.",
    likelyCause:
      "The app is connecting to PostgreSQL via localhost instead of the database service hostname.",
    evidence: [
      "Connection target: 127.0.0.1:5432.",
      "ECONNREFUSED means the target refused the connection.",
      "Port 5432 is the standard PostgreSQL port.",
    ],
    recommendation:
      "Check DATABASE_URL and use the PostgreSQL service hostname instead of localhost.",
    nextSteps: [
      "Inspect the DATABASE_URL value in your service environment.",
      "Verify the PostgreSQL service is running and healthy.",
      "Test connectivity (e.g. `pg_isready -h <host> -p 5432`).",
    ],
  },
  {
    category: "CACHE",
    severity: "MEDIUM",
    confidence: 0.92,
    match: (l) => l.includes("econnrefused") && l.includes("6379"),
    diagnosis: "The application cannot connect to the cache service.",
    likelyCause:
      "The app is unable to reach the Valkey/Redis service at the configured address.",
    evidence: [
      "ECONNREFUSED means the target refused the connection.",
      "Port 6379 is the standard Redis/Valkey port.",
    ],
    recommendation:
      "Verify the cache connection URL uses the correct service hostname and port.",
    nextSteps: [
      "Check the cache service hostname and port.",
      "Confirm the Valkey/Redis service is running.",
      "Test connectivity (e.g. `redis-cli -h <host> -p 6379 ping`).",
    ],
  },
  {
    category: "DOCKER",
    severity: "MEDIUM",
    confidence: 0.9,
    match: (l) =>
      l.includes("port is already allocated") ||
      l.includes("address already in use") ||
      (l.includes("bind for") && l.includes("failed")),
    diagnosis:
      "The container failed to start because the requested host port is already in use.",
    likelyCause:
      "Another process or container is already bound to the same host port.",
    evidence: [
      "Docker reported that the port bind failed.",
      "The host port is already allocated to another process.",
    ],
    recommendation:
      "Free the port or map the container to a different host port.",
    nextSteps: [
      "Find what holds the port (e.g. `lsof -i :<port>` or `docker ps`).",
      "Stop the conflicting container/process or change the host mapping.",
      "Restart the container.",
    ],
  },
  {
    category: "DOCKER",
    severity: "HIGH",
    confidence: 0.9,
    match: (l) =>
      (l.includes("manifest") && l.includes("not found")) ||
      l.includes("pull access denied") ||
      l.includes("no such image") ||
      l.includes("repository does not exist"),
    diagnosis: "Docker could not pull the requested image.",
    likelyCause:
      "The image name/tag is wrong, or the registry requires credentials the deployment does not have.",
    evidence: [
      "The registry could not resolve the requested image manifest.",
      "This points to an incorrect image reference or missing registry credentials.",
    ],
    recommendation:
      "Verify the image name and tag, and ensure the deployment can authenticate to the registry.",
    nextSteps: [
      "Double-check the image name and tag for typos.",
      "Confirm the image exists (`docker pull <image>` locally).",
      "Add registry credentials if the image is private.",
    ],
  },
  {
    category: "KUBERNETES",
    severity: "HIGH",
    confidence: 0.9,
    match: (l) => l.includes("crashloopbackoff"),
    diagnosis:
      "A Kubernetes pod is crashing repeatedly and entering CrashLoopBackOff.",
    likelyCause:
      "The container starts and then exits with an error, so Kubernetes keeps restarting it.",
    evidence: [
      "Pod status: CrashLoopBackOff.",
      "The container exits shortly after starting.",
      "Kubernetes backs off between restart attempts.",
    ],
    recommendation:
      "Inspect the previous container logs to find why it exits on startup.",
    nextSteps: [
      "View previous logs (`kubectl logs <pod> --previous`).",
      "Check the startup command and liveness/readiness probes.",
      "Fix the startup error, then redeploy.",
    ],
  },
  {
    category: "KUBERNETES",
    severity: "HIGH",
    confidence: 0.9,
    match: (l) =>
      l.includes("imagepullbackoff") || l.includes("errimagepull"),
    diagnosis: "Kubernetes cannot pull the container image for a pod.",
    likelyCause:
      "The image reference is invalid or the cluster lacks credentials to pull it.",
    evidence: [
      "Pod status: ImagePullBackOff / ErrImagePull.",
      "The kubelet failed to pull the specified image.",
    ],
    recommendation:
      "Verify the image reference and configure an imagePullSecret for private images.",
    nextSteps: [
      "Describe the pod for the exact error (`kubectl describe pod <pod>`).",
      "Verify the image name/tag and registry.",
      "Create/attach an imagePullSecret for private registries.",
    ],
  },
  {
    category: "RUNTIME",
    severity: "HIGH",
    confidence: 0.9,
    match: (l) =>
      l.includes("javascript heap out of memory") ||
      l.includes("out of memory") ||
      l.includes("oomkilled"),
    diagnosis: "The application ran out of memory.",
    likelyCause:
      "The process exceeded the available memory or the container memory limit.",
    evidence: [
      "The logs report an out-of-memory condition.",
      "For Node.js this often appears as 'JavaScript heap out of memory'.",
    ],
    recommendation:
      "Identify the source of high memory usage before simply raising the limit.",
    nextSteps: [
      "Profile memory usage to find leaks or large allocations.",
      "Raise the container memory limit if the workload truly needs it.",
      "For Node, consider tuning `--max-old-space-size`.",
    ],
  },
  {
    category: "CONFIG",
    severity: "HIGH",
    confidence: 0.9,
    match: (l) =>
      (l.includes("database_url") &&
        (l.includes("undefined") ||
          l.includes("is not defined") ||
          l.includes("not set") ||
          l.includes("missing"))) ||
      (l.includes("environment variable") &&
        (l.includes("not defined") ||
          l.includes("missing") ||
          l.includes("required"))),
    diagnosis: "A required environment variable is missing at runtime.",
    likelyCause:
      "The deployment is missing an environment variable the app needs (for example DATABASE_URL).",
    evidence: [
      "The app references an environment variable that is undefined.",
      "Configuration is read from the environment and one value is absent.",
    ],
    recommendation:
      "Set the missing environment variable in the service configuration and redeploy.",
    nextSteps: [
      "Identify which variable is undefined from the log line.",
      "Add it to the service environment / secrets.",
      "Redeploy and confirm the variable is present.",
    ],
  },
  {
    category: "NETWORK",
    severity: "HIGH",
    confidence: 0.9,
    match: (l) => l.includes("enotfound") || l.includes("getaddrinfo"),
    diagnosis: "The application could not resolve a hostname via DNS.",
    likelyCause:
      "The hostname is wrong, or the target service name is not resolvable in this environment.",
    evidence: [
      "DNS lookup failed with getaddrinfo ENOTFOUND.",
      "The hostname does not resolve to an address.",
    ],
    recommendation:
      "Verify the hostname and that the target service is reachable by that name.",
    nextSteps: [
      "Check the hostname/URL for typos.",
      "Confirm the service name matches the deployed service.",
      "Test resolution from the container (e.g. `nslookup <host>`).",
    ],
  },
  {
    category: "NETWORK",
    severity: "HIGH",
    confidence: 0.88,
    match: (l) => l.includes("bad gateway") || l.includes("502"),
    diagnosis: "The gateway/proxy returned 502 Bad Gateway.",
    likelyCause:
      "The upstream application is not responding — it crashed, never started, or listens on the wrong port.",
    evidence: [
      "HTTP 502 Bad Gateway from the proxy/load balancer.",
      "The upstream service did not return a valid response.",
    ],
    recommendation:
      "Ensure the app is running and listening on the port the proxy expects.",
    nextSteps: [
      "Confirm the app process is up and healthy.",
      "Verify the app listens on the expected port and on 0.0.0.0.",
      "Check the proxy/upstream configuration.",
    ],
  },
  {
    category: "SYSTEM",
    severity: "MEDIUM",
    confidence: 0.9,
    match: (l) =>
      l.includes("permission denied") || l.includes("eacces"),
    diagnosis:
      "The application does not have permission to access a required resource.",
    likelyCause:
      "The process is accessing a file, directory, socket, or port without sufficient permissions.",
    evidence: ["The logs contain a permission-related error (EACCES)."],
    recommendation:
      "Check the ownership/permissions of the resource and which user the app runs as.",
    nextSteps: [
      "Identify the resource and the user the app runs as.",
      "Adjust ownership/permissions (e.g. `chown`/`chmod`).",
      "Avoid binding privileged ports (<1024) as a non-root user.",
    ],
  },
];

const FALLBACK: Diagnosis = {
  diagnosis: "No known failure pattern was detected.",
  likelyCause:
    "The supplied logs do not match one of the currently supported diagnostic patterns.",
  evidence: [
    "The analyzer could not identify a recognized error signature.",
  ],
  recommendation:
    "Review the complete logs and provide additional deployment or runtime context.",
  nextSteps: [
    "Re-run with the full logs, not just the final line.",
    "Include the environment (Docker, Kubernetes, bare metal) and recent changes.",
  ],
  severity: "MEDIUM",
  category: "UNKNOWN",
  confidence: 0.4,
};

export function analyzeLogs(logs: string): Diagnosis {
  const normalizedLogs = logs.toLowerCase();

  for (const pattern of PATTERNS) {
    if (pattern.match(normalizedLogs)) {
      const { match, ...diagnosis } = pattern;
      return diagnosis;
    }
  }

  return FALLBACK;
}
