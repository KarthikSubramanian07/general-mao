import type {
  ChatMessage,
  ClientMessage,
  LedgerEntry,
  PublicGameState,
  SelfView,
  ServerMessage,
} from "@mao/protocol";
import { PartySocket } from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import { WS_HOST } from "./config.js";
import { getName, getPlayerId, getTableToken, setTableToken } from "./identity.js";

export interface FeedItem {
  id: string;
  kind: "chat" | "general" | "verdict";
  name: string;
  text: string;
}

export interface Toast {
  id: number;
  level: "info" | "warn" | "error" | "penalty" | "verdict";
  text: string;
}

export interface TableView {
  status: "connecting" | "open" | "closed";
  youId: string | null;
  state: PublicGameState | null;
  you: SelfView | null;
  feed: FeedItem[];
  toasts: Toast[];
  /** Bumps on every penalty, so the hand can play the slide animation. */
  penaltyPulse: { entry: LedgerEntry; n: number } | null;
}

let toastSeq = 1;
let sysSeq = 1;

export function useTable(code: string, spectate: boolean) {
  const [view, setView] = useState<TableView>({
    status: "connecting",
    youId: null,
    state: null,
    you: null,
    feed: [],
    toasts: [],
    penaltyPulse: null,
  });
  const socketRef = useRef<PartySocket | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    seen.current = new Set();
    const socket = new PartySocket({
      host: WS_HOST,
      party: "table",
      room: code,
      query: {
        id: getPlayerId(),
        name: getName(),
        token: getTableToken(code),
        spectate: spectate ? "1" : "0",
      },
    });
    socketRef.current = socket;

    const pushToast = (level: Toast["level"], text: string) => {
      const id = toastSeq++;
      setView((v) => ({ ...v, toasts: [...v.toasts, { id, level, text }] }));
      setTimeout(
        () => {
          setView((v) => ({ ...v, toasts: v.toasts.filter((t) => t.id !== id) }));
        },
        level === "error" ? 5200 : 4200,
      );
    };

    const mergeChat = (msgs: ChatMessage[]) =>
      setView((v) => {
        const add: FeedItem[] = [];
        for (const m of msgs) {
          if (seen.current.has(m.id)) continue;
          seen.current.add(m.id);
          add.push({
            id: m.id,
            kind: m.system ? "general" : "chat",
            name: m.playerName,
            text: m.text,
          });
        }
        return add.length ? { ...v, feed: [...v.feed, ...add] } : v;
      });

    const onMessage = (raw: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(raw.data as string) as ServerMessage;
      } catch {
        return;
      }
      switch (msg.t) {
        case "welcome":
          if (msg.token) setTableToken(code, msg.token);
          setView((v) => ({ ...v, youId: msg.youId }));
          break;
        case "snapshot":
          setView((v) => ({ ...v, state: msg.state, you: msg.you }));
          mergeChat(msg.chat);
          break;
        case "chat":
          mergeChat([msg.message]);
          break;
        case "system": {
          const id = `sys-${sysSeq++}`;
          seen.current.add(id);
          setView((v) => ({
            ...v,
            feed: [...v.feed, { id, kind: "general", name: "The General", text: msg.text }],
          }));
          break;
        }
        case "verdict": {
          const id = `vd-${msg.verdict.seq}`;
          if (!seen.current.has(id)) {
            seen.current.add(id);
            setView((v) => ({
              ...v,
              feed: [
                ...v.feed,
                { id, kind: "verdict", name: "The General", text: msg.verdict.text },
              ],
            }));
          }
          break;
        }
        case "penalty":
          setView((v) => ({
            ...v,
            penaltyPulse: { entry: msg.entry, n: (v.penaltyPulse?.n ?? 0) + 1 },
          }));
          pushToast("penalty", msg.entry.reason);
          break;
        case "toast":
          pushToast(msg.level, msg.text);
          break;
        case "error":
          pushToast("error", msg.message);
          break;
      }
    };

    const onOpen = () => setView((v) => ({ ...v, status: "open" }));
    const onClose = () => setView((v) => ({ ...v, status: "closed" }));

    socket.addEventListener("message", onMessage);
    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);

    return () => {
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
      socket.close();
    };
  }, [code, spectate]);

  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const dismissToast = useCallback((id: number) => {
    setView((v) => ({ ...v, toasts: v.toasts.filter((t) => t.id !== id) }));
  }, []);

  return { ...view, send, dismissToast };
}
