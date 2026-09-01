import { createOsuClient } from "../../shared/osu/client";

export function hasOsuCredentials(): boolean {
  return Boolean(process.env.OSU_CLIENT_ID && process.env.OSU_CLIENT_SECRET);
}

function client() {
  const clientId = process.env.OSU_CLIENT_ID;
  const clientSecret = process.env.OSU_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("OSU_CLIENT_ID / OSU_CLIENT_SECRET are not configured");
  return createOsuClient({ clientId, clientSecret });
}

const osu = hasOsuCredentials() ? client() : null;

export const fetchScore: ReturnType<typeof createOsuClient>["fetchScore"] = (...args) => clientOrThrow().fetchScore(...args);
export const getModdedBeatmapAttributes: ReturnType<typeof createOsuClient>["getModdedBeatmapAttributes"] = (...args) => clientOrThrow().getModdedBeatmapAttributes(...args);
export const fetchLeaderboardPosition: ReturnType<typeof createOsuClient>["fetchLeaderboardPosition"] = (...args) => clientOrThrow().fetchLeaderboardPosition(...args);

function clientOrThrow() {
  return osu ?? client();
}
