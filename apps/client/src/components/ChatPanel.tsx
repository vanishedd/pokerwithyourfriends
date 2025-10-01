import { FormEvent, useState } from 'react';
import type { ChatMessage } from '@pwyf/shared';

interface ChatPanelProps {
  chat: ChatMessage[];
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatPanel = ({ chat, onSend, disabled }: ChatPanelProps) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage('');
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70">
      <div className="flex-1 space-y-2 overflow-y-auto p-4 text-sm">
        {chat.length === 0 && <p className="text-slate-500">Chat is empty</p>}
        {chat.map((entry) => (
          <div key={entry.id} className="rounded-lg bg-slate-950/60 px-3 py-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{entry.name}</span>
              <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="mt-1 text-slate-100">{entry.message}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-slate-800 p-3">
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-emerald-500"
            placeholder="Send a message"
            maxLength={160}
            disabled={disabled}
          />
          <button
            type="submit"
            disabled={disabled}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
