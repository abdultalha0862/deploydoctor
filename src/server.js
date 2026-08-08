"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const app = (0, fastify_1.default)({
    logger: true,
});
async function start() {
    await app.register(cors_1.default, {
        origin: true,
    });
    app.get("/health", async () => {
        return {
            status: "ok",
            service: "deploydoctor-api",
        };
    });
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || "0.0.0.0";
    try {
        await app.listen({
            port,
            host,
        });
    }
    catch (error) {
        app.log.error(error);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=server.js.map