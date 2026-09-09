import type { PeerOptions } from "peerjs";

export function getPeerOptions(): PeerOptions {
  const configuredHost = import.meta.env.VITE_PEER_HOST as string | undefined;
  if (!configuredHost) return { debug: import.meta.env.DEV ? 1 : 0 };
  const host = configuredHost === "auto" ? window.location.hostname : configuredHost;
  return {
    host,
    port: Number(import.meta.env.VITE_PEER_PORT || 9000),
    path: import.meta.env.VITE_PEER_PATH || "/peerjs",
    secure: import.meta.env.VITE_PEER_SECURE === "true",
    debug: Number(import.meta.env.VITE_PEER_DEBUG || 1),
    pingInterval: 5000,
  };
}
