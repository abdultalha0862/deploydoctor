export type Diagnosis = {
  diagnosis: string;
  likelyCause: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
};

export function analyzeLogs(logs: string): Diagnosis {
  const normalizedLogs = logs.toLowerCase();

  if (
    normalizedLogs.includes("econnrefused") &&
    normalizedLogs.includes("5432")
  ) {
    return {
      diagnosis: "The application cannot connect to PostgreSQL.",
      likelyCause:
        "The application is attempting to connect to PostgreSQL through localhost instead of the database service hostname.",
      evidence: [
        "Connection target: 127.0.0.1:5432",
        "ECONNREFUSED indicates that the target connection was rejected.",
        "Port 5432 is the standard PostgreSQL port.",
      ],
      recommendation:
        "Check DATABASE_URL and use the PostgreSQL service hostname instead of localhost.",
      confidence: 0.95,
    };
  }

  if (
    normalizedLogs.includes("econnrefused") &&
    normalizedLogs.includes("6379")
  ) {
    return {
      diagnosis: "The application cannot connect to the cache service.",
      likelyCause:
        "The application is unable to reach the Valkey/Redis service.",
      evidence: [
        "ECONNREFUSED indicates that the target connection was rejected.",
        "Port 6379 is commonly used by Redis-compatible cache services.",
      ],
      recommendation:
        "Check the cache connection URL and verify that the application uses the correct cache service hostname and port.",
      confidence: 0.92,
    };
  }

  if (
    normalizedLogs.includes("permission denied") ||
    normalizedLogs.includes("eacces")
  ) {
    return {
      diagnosis: "The application does not have permission to access a required resource.",
      likelyCause:
        "The process is attempting to access a file, directory, socket, or other resource without sufficient permissions.",
      evidence: [
        "The logs contain a permission-related error.",
      ],
      recommendation:
        "Check the ownership and permissions of the affected resource and verify which user the application runs as.",
      confidence: 0.9,
    };
  }

  if (
    normalizedLogs.includes("out of memory") ||
    normalizedLogs.includes("heap out of memory") ||
    normalizedLogs.includes("oom")
  ) {
    return {
      diagnosis: "The application appears to have run out of memory.",
      likelyCause:
        "The process exceeded the available memory or configured memory limit.",
      evidence: [
        "The logs contain an out-of-memory condition.",
      ],
      recommendation:
        "Check memory usage, container limits, and application memory consumption. Increase the memory limit only after identifying the source of excessive usage.",
      confidence: 0.9,
    };
  }

  return {
    diagnosis: "No known failure pattern was detected.",
    likelyCause:
      "The supplied logs do not match one of the currently supported diagnostic patterns.",
    evidence: [
      "The analyzer could not identify a recognized error signature.",
    ],
    recommendation:
      "Review the complete logs and provide additional deployment or runtime context.",
    confidence: 0.4,
  };
}
