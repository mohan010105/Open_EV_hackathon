/**
 * Dashboard — displays live environment observation state:
 *   current app, task description, step count, reward,
 *   email list, selected email, calendar events, documents.
 */

export default function Dashboard({ obs, mode, difficulty, isActive }) {
  if (!obs) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        No active session — click Reset to start.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Task description ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">🎯</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Current Task</p>
            <p className="text-sm text-gray-200 leading-relaxed">{obs.task_description || obs.current_task || "—"}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {obs.task_id && <Chip color="violet">{obs.task_id}</Chip>}
          {difficulty && <Chip color={diffColor(difficulty)}>{difficulty}</Chip>}
          {mode && <Chip color={mode === "evaluation" ? "orange" : "blue"}>{mode}</Chip>}
        </div>
      </div>

      {/* ── Current app + actions ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Current App</span>
          <span className="text-sm font-semibold text-blue-300">{appLabel(obs.current_app)}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(obs.available_actions || []).map((a) => (
            <span key={a} className="font-mono text-[11px] bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-gray-400">
              {a}
            </span>
          ))}
        </div>
      </div>

      {/* ── Email list ── */}
      {obs.email_list && obs.email_list.length > 0 && (
        <Section title="📧 Emails" count={obs.email_list.length}>
          {obs.email_list.map((e) => (
            <EmailRow key={e.id} email={e} isSelected={obs.selected_email?.id === e.id} />
          ))}
        </Section>
      )}

      {/* ── Open email ── */}
      {obs.selected_email && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2">Open Email</p>
          <p className="text-sm font-semibold text-gray-200">{obs.selected_email.subject}</p>
          <p className="text-xs text-gray-500 mb-2">From: {obs.selected_email.sender}</p>
          <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono bg-black/20 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed">
            {obs.selected_email.body}
          </pre>
        </div>
      )}

      {/* ── Calendar events ── */}
      {obs.calendar_events && obs.calendar_events.length > 0 && (
        <Section title="📅 Calendar" count={obs.calendar_events.length}>
          {obs.calendar_events.map((ev) => (
            <div key={ev.id} className={`flex gap-3 py-2 border-b border-white/[0.06] last:border-none ${ev.created_from_email ? "text-purple-300" : "text-gray-300"}`}>
              <span className="font-mono text-[11px] text-purple-400 shrink-0 pt-0.5">{ev.date} {ev.time}</span>
              <span className="text-sm truncate">{ev.title}</span>
              {ev.created_from_email && <span className="ml-auto shrink-0 text-[10px] text-purple-400 border border-purple-500/30 rounded px-1.5 py-0.5">New</span>}
            </div>
          ))}
        </Section>
      )}

      {/* ── Documents ── */}
      {obs.documents && obs.documents.length > 0 && (
        <Section title="📁 Documents" count={obs.documents.length}>
          {obs.documents.map((d) => (
            <div key={d.id} className="flex items-center gap-2 py-2 border-b border-white/[0.06] last:border-none">
              <span className="text-base">{fileIcon(d.type)}</span>
              <span className="text-sm text-gray-300 flex-1 truncate">{d.name}</span>
              <span className="text-[11px] text-gray-500 shrink-0">{d.folder}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</span>
        <span className="text-[11px] bg-white/10 rounded-full px-2 py-0.5 text-gray-400">{count}</span>
      </div>
      {children}
    </div>
  );
}

function EmailRow({ email, isSelected }) {
  return (
    <div className={`flex items-start gap-2 py-2 border-b border-white/[0.06] last:border-none ${isSelected ? "text-blue-300" : ""}`}>
      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${email.read ? "border border-gray-600" : "bg-blue-400"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{email.sender}</p>
        <p className="text-xs text-gray-500 truncate">{email.subject}</p>
      </div>
      {email.has_meeting_details && (
        <span className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded px-1.5 py-0.5 shrink-0">📅 Mtg</span>
      )}
    </div>
  );
}

function Chip({ color, children }) {
  const map = {
    violet: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    blue:   "bg-blue-500/15   text-blue-300   border-blue-500/30",
    orange: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    green:  "bg-green-500/15  text-green-300  border-green-500/30",
    red:    "bg-red-500/15    text-red-300    border-red-500/30",
    yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  };
  return (
    <span className={`text-[11px] border rounded-full px-2.5 py-0.5 font-medium ${map[color] || map.blue}`}>
      {children}
    </span>
  );
}

function appLabel(app) {
  const m = { email_inbox: "📧 Email Inbox", email_detail: "📨 Email Detail", calendar: "📅 Calendar", documents: "📁 Documents", task_manager: "✅ Task Manager" };
  return m[app] || app || "—";
}
function diffColor(d) { return { easy: "green", medium: "yellow", hard: "red" }[d] || "blue"; }
function fileIcon(t) { return { PDF: "📄", Spreadsheet: "📊", Document: "📝", Image: "🖼️" }[t] || "📎"; }
