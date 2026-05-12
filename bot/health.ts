import { pool } from "./db";
    
interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: number;
  db?: boolean;
  error?: string;
}

export async function healthCheck(): Promise<HealthStatus> {
  const result: HealthStatus = {
    status: "unhealthy",
    timestamp: Date.now(),
    db: false,
    error: "Database pool is not initialized",
  };

  if (!pool) {
    return result;
  }

  try {
    await pool.query("SELECT 1");
    result.status = "healthy";
    result.db = true;
  } catch (error) {
    result.status = "unhealthy";
    result.db = false;
    result.error = String(error);
  }

  return result;
}
