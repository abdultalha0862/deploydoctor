import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./lib/prisma.js";
import { analyzeLogs } from "./services/analyzer.js";
import { analyzeWithAI } from "./services/ai-analyzer.js";

const app = Fastify({
  logger: true,
});

async function start() {
  await app.register(cors, {
    origin: true,
  });

  // Health check
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "deploydoctor-api",
    };
  });

  // Create an incident
  app.post<{
  Params: {
    id: string;
  };
}>("/incidents/:id/analyze", async (request, reply) => {
  const incident = await prisma.incident.findUnique({
    where: {
      id: request.params.id,
    },
  });

  if (!incident) {
    return reply.code(404).send({
      error: "Incident not found",
    });
  }

  if (!incident.logs) {
    return reply.code(400).send({
      error: "Incident does not contain logs",
    });
  }

  let diagnosis = analyzeLogs(incident.logs);

  // Use Gemini when the deterministic analyzer cannot confidently
  // identify the failure.
  if (diagnosis.confidence < 0.8) {
    if (!process.env.GEMINI_API_KEY) {
      return reply.code(500).send({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    diagnosis = await analyzeWithAI({
      title: incident.title,
      description: incident.description,
      environment: incident.environment,
      logs: incident.logs,
    });
  }

  const updatedIncident = await prisma.incident.update({
    where: {
      id: incident.id,
    },
    data: {
      diagnosis: diagnosis.diagnosis,
      likelyCause: diagnosis.likelyCause,
      evidence: diagnosis.evidence,
      recommendation: diagnosis.recommendation,
      confidence: diagnosis.confidence,
    },
  });

  return {
    incidentId: updatedIncident.id,
    ...diagnosis,
  };
});

  // Get an incident by ID
  app.get<{
    Params: {
      id: string;
    };
  }>("/incidents/:id", async (request, reply) => {
    const incident = await prisma.incident.findUnique({
      where: {
        id: request.params.id,
      },
    });

    if (!incident) {
      return reply.code(404).send({
        error: "Incident not found",
      });
    }

    return incident;
  });

  // Analyze an incident
  app.post<{
    Params: {
      id: string;
    };
  }>("/incidents/:id/analyze", async (request, reply) => {
    const incident = await prisma.incident.findUnique({
      where: {
        id: request.params.id,
      },
    });

    if (!incident) {
      return reply.code(404).send({
        error: "Incident not found",
      });
    }

    if (!incident.logs) {
      return reply.code(400).send({
        error: "Incident does not contain logs",
      });
    }

    const diagnosis = analyzeLogs(incident.logs);

    const updatedIncident = await prisma.incident.update({
      where: {
        id: incident.id,
      },
      data: {
        diagnosis: diagnosis.diagnosis,
        likelyCause: diagnosis.likelyCause,
        evidence: diagnosis.evidence,
        recommendation: diagnosis.recommendation,
        confidence: diagnosis.confidence,
      },
    });

    return {
      incidentId: updatedIncident.id,
      ...diagnosis,
    };
  });

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "0.0.0.0";

  try {
    await app.listen({
      port,
      host,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();