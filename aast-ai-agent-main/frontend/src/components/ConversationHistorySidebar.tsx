import { Check, MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ConversationSummary } from "../types";

interface ConversationHistorySidebarProps {
  conversations: ConversationSummary[];
  activeCid: string | null;
  collapsed: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  onSelectConversation: (cid: string) => void;
  onRenameConversation: (cid: string, title: string) => Promise<void>;
  onTogglePinConversation: (conversation: ConversationSummary) => Promise<void>;
  onDeleteConversation: (conversation: ConversationSummary) => Promise<void>;
}

type GroupKey = "pinned" | "today" | "yesterday" | "previous7" | "older";

const GROUP_LABELS: Record<GroupKey, string> = {
  pinned: "Pinned",
  today: "Today",
  yesterday: "Yesterday",
  previous7: "Previous 7 Days",
  older: "Older",
};

function getConversationTime(conversation: ConversationSummary) {
  return Number(conversation.lastActive) || Date.parse(conversation.updatedAt || conversation.createdAt) || 0;
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function groupConversations(conversations: ConversationSummary[]) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const grouped: Record<GroupKey, ConversationSummary[]> = {
    pinned: [],
    today: [],
    yesterday: [],
    previous7: [],
    older: [],
  };

  conversations.forEach((conversation) => {
    if (conversation.pinned) {
      grouped.pinned.push(conversation);
      return;
    }

    const time = getConversationTime(conversation);
    const date = new Date(time);

    if (time && isSameDay(date, now)) grouped.today.push(conversation);
    else if (time && isSameDay(date, yesterday)) grouped.yesterday.push(conversation);
    else if (time && date >= sevenDaysAgo) grouped.previous7.push(conversation);
    else grouped.older.push(conversation);
  });

  return grouped;
}

export default function ConversationHistorySidebar({
  conversations,
  activeCid,
  collapsed,
  loading,
  search,
  onSearchChange,
  onToggleCollapsed,
  onNewChat,
  onSelectConversation,
  onRenameConversation,
  onTogglePinConversation,
  onDeleteConversation,
}: ConversationHistorySidebarProps) {
  const [menuCid, setMenuCid] = useState<string | null>(null);
  const [editingCid, setEditingCid] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const grouped = useMemo(() => groupConversations(conversations), [conversations]);

  const startRename = (conversation: ConversationSummary) => {
    setMenuCid(null);
    setEditingCid(conversation.cid);
    setDraftTitle(conversation.title || "New Chat");
  };

  const cancelRename = () => {
    setEditingCid(null);
    setDraftTitle("");
  };

  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCid) return;

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      cancelRename();
      return;
    }

    await onRenameConversation(editingCid, nextTitle);
    cancelRename();
  };

  const renderConversation = (conversation: ConversationSummary) => {
    const isActive = conversation.cid === activeCid;
    const isEditing = conversation.cid === editingCid;

    return (
      <div
        key={conversation.cid}
        className={`group relative flex min-h-11 items-center rounded-xl transition ${
          isActive ? "bg-white/10 text-white ring-1 ring-white/10" : "text-slate-200 hover:bg-white/10"
        }`}
      >
        {isEditing ? (
          <form onSubmit={submitRename} className="flex min-w-0 flex-1 items-center gap-1 px-2">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              autoFocus
              className="min-w-0 flex-1 rounded border border-navy-500 bg-navy-950 px-2 py-1 text-sm text-white outline-none"
            />
            <button type="submit" className="rounded p-1 text-green-200 hover:bg-navy-800" aria-label="Save title">
              <Check size={16} />
            </button>
            <button type="button" onClick={cancelRename} className="rounded p-1 text-slate-300 hover:bg-navy-800" aria-label="Cancel rename">
              <X size={16} />
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSelectConversation(conversation.cid)}
              className="min-w-0 flex-1 px-3 py-2 text-left"
              title={conversation.title}
            >
              <span className="block truncate text-sm font-medium">{conversation.title || "New Chat"}</span>
              {conversation.preview && (
                <span className={`block truncate text-xs ${isActive ? "text-slate-300" : "text-slate-400 group-hover:text-slate-300"}`}>
                  {conversation.preview}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMenuCid(menuCid === conversation.cid ? null : conversation.cid)}
              className="mr-1 rounded-lg p-1.5 text-slate-300 opacity-100 hover:bg-white/10 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Conversation options"
            >
              <MoreHorizontal size={16} />
            </button>
          </>
        )}

        {menuCid === conversation.cid && !isEditing && (
          <div className="absolute right-1 top-10 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1 text-slate-700 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setMenuCid(null);
                void onTogglePinConversation(conversation);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              <Pin size={14} />
              {conversation.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              type="button"
              onClick={() => startRename(conversation)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              <Pencil size={14} />
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuCid(null);
                void onDeleteConversation(conversation);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (key: GroupKey) => {
    const items = grouped[key];
    if (!items.length) return null;

    return (
      <section className="space-y-1">
        <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {GROUP_LABELS[key]}
        </h3>
        {items.map(renderConversation)}
      </section>
    );
  };

  return (
    <aside
      className={`flex h-full shrink-0 flex-col rounded-2xl border border-white/10 bg-navy-900 text-white shadow-xl shadow-navy-950/20 transition-all ${
        collapsed ? "w-[76px] p-3" : "w-full p-4 md:w-[296px]"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          aria-label={collapsed ? "Expand chat history" : "Collapse chat history"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {!collapsed && (
          <button
            type="button"
            onClick={onNewChat}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gold-500 px-3 text-sm font-bold text-navy-950 shadow-lg shadow-navy-950/20 transition hover:-translate-y-0.5 hover:bg-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          >
            <Plus size={16} />
            New Chat
          </button>
        )}
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={onNewChat}
          className="mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500 text-navy-950 hover:bg-gold-400"
          aria-label="New chat"
        >
          <Plus size={18} />
        </button>
      ) : (
        <>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-navy-950/80 px-3 py-2 text-sm text-slate-300 transition focus-within:border-gold-500/70 focus-within:ring-2 focus-within:ring-gold-500/10">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search chats"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>

          <div className="custom-scrollbar mt-4 flex-1 space-y-5 overflow-y-auto pr-1">
            {loading && <p className="px-2 text-sm text-slate-400">Loading chats...</p>}
            {renderGroup("pinned")}
            {renderGroup("today")}
            {renderGroup("yesterday")}
            {renderGroup("previous7")}
            {renderGroup("older")}
            {!loading && conversations.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                <MessageSquare className="mb-2 h-4 w-4" aria-hidden="true" />
                No chats found.
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
