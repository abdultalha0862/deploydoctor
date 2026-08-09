import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./lib/prisma.js";

const app = Fastify({
  logger: true,
});

async function start() {
  await app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "deploydoctor-api",
    };
  });

  app.post<{
    Body: {
      title: string;
      description?: string;
      environment?: string;
      logs?: string;
      severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    };
  }>("/incidents", async (request, reply) => {
    const incident = await prisma.incident.create({
      data: {
        title: request.body.title,
        description: request.body.description,
        environment: request.body.environment,
        logs: request.body.logs,
        severity: request.body.severity,
      },
    });

    return reply.code(201).send(incident);
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