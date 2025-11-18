"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";

const STORAGE_KEY = "signalflow_agent_state_v1";

type Platform = "Twitter" | "LinkedIn" | "Instagram" | "Facebook" | "TikTok" | "YouTube";

type Template = {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
};

type PostStatus = "pending" | "approved" | "scheduled" | "published";

type ScheduledPost = {
  id: string;
  templateId: string;
  templateName: string;
  values: Record<string, string>;
  finalMessage: string;
  platforms: Platform[];
  scheduledAt?: string;
  status: PostStatus;
  createdAt: string;
  approvedAt?: string;
  publishedAt?: string;
  notes?: string;
  mediaUrl?: string;
  reviewers: string[];
};

type ActivityEntry = {
  id: string;
  timestamp: string;
  summary: string;
  detail?: string;
  category: "template" | "post";
};

type AppState = {
  templates: Template[];
  posts: ScheduledPost[];
  activity: ActivityEntry[];
};

const defaultState: AppState = {
  templates: [
    {
      id: createId(),
      name: "Product Launch Pulse",
      description: "Announce a new feature drop with a compelling hook and CTA.",
      platforms: ["Twitter", "LinkedIn"],
      content:
        "🚀 {hook}\n\nMeet {feature_name}: {feature_summary}.\n\nWhy it matters: {value_point_one}\n{value_point_two}\n\nSave your spot for the live demo → {cta_link}",
      tags: ["#ProductUpdate", "#LaunchDay", "#SaaS"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 3,
    },
    {
      id: createId(),
      name: "Weekly Thought Leadership",
      description: "Share an insight, data point, and discussion prompt.",
      platforms: ["LinkedIn", "Instagram"],
      content:
        "💡 {insight_title}\n\nThis week we learned: {insight_body}\n\nData spotlight → {supporting_fact}\nPrompt: {discussion_question}\n\n{cta_line}",
      tags: ["#Leadership", "#GrowthMindset", "#WeeklyWins"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 5,
    },
  ],
  posts: [],
  activity: [],
};

const platformOptions: Platform[] = [
  "Twitter",
  "LinkedIn",
  "Instagram",
  "Facebook",
  "TikTok",
  "YouTube",
];

function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parsePlaceholders(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  const placeholders = new Set<string>();
  matches.forEach((token) => {
    const clean = token.replace(/[{}]/g, "").trim();
    if (clean) placeholders.add(clean);
  });
  return Array.from(placeholders);
}

function mergeTemplateContent(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    return values[key] ?? `{${key}}`;
  });
}

function formatDateTime(value?: string): string {
  if (!value) return "No schedule";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "No schedule";
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function appendActivity(entries: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] {
  return [entry, ...entries].slice(0, 40);
}

type PersistentState = [AppState, Dispatch<SetStateAction<AppState>>, boolean];

function usePersistentState(): PersistentState {
  const [state, setState] = useState<AppState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AppState;
        window.setTimeout(() => {
          setState(parsed);
        }, 0);
      } catch (error) {
        console.warn("Failed to parse saved state", error);
      }
    }
    window.setTimeout(() => {
      setHydrated(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  return [state, setState, hydrated];
}

type TemplateFormState = {
  id?: string;
  name: string;
  description: string;
  content: string;
  platforms: Platform[];
  tags: string;
};

const initialTemplateForm: TemplateFormState = {
  name: "",
  description: "",
  content: "",
  platforms: ["Twitter"],
  tags: "",
};

type TemplateManagerProps = {
  templates: Template[];
  selectedTemplateId?: string;
  onSelect: (id: string) => void;
  onSave: (template: Template) => void;
  onDelete: (id: string) => void;
};

function TemplateManager({
  templates,
  selectedTemplateId,
  onSelect,
  onSave,
  onDelete,
}: TemplateManagerProps) {
  const [form, setForm] = useState<TemplateFormState>(initialTemplateForm);
  const [isEditing, setIsEditing] = useState(false);

  const placeholders = useMemo(() => parsePlaceholders(form.content), [form.content]);

  const reset = () => {
    setForm(initialTemplateForm);
    setIsEditing(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.content.trim()) {
      return;
    }
    const timestamp = new Date().toISOString();
    const payload: Template = {
      id: form.id ?? createId(),
      name: form.name.trim(),
      description: form.description.trim() || "Untitled template",
      platforms: form.platforms,
      content: form.content.trim(),
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      createdAt: form.id
        ? templates.find((tpl) => tpl.id === form.id)?.createdAt ?? timestamp
        : timestamp,
      updatedAt: timestamp,
      usageCount: form.id
        ? templates.find((tpl) => tpl.id === form.id)?.usageCount ?? 0
        : 0,
    };
    onSave(payload);
    reset();
  };

  const startEditing = (template: Template) => {
    setForm({
      id: template.id,
      name: template.name,
      description: template.description,
      content: template.content,
      platforms: template.platforms,
      tags: template.tags.join(", "),
    });
    setIsEditing(true);
  };

  return (
    <div className="section-card">
      <div className="section-title">
        <span role="img" aria-label="template">
          🧩
        </span>
        Template Studio
      </div>
      <form onSubmit={handleSubmit} className="list-item" style={{ marginBottom: "1.2rem" }}>
        <div className="form-group">
          <label htmlFor="template-name">Template name</label>
          <input
            id="template-name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Product announcement cadence"
          />
        </div>
        <div className="form-group">
          <label htmlFor="template-description">Context</label>
          <input
            id="template-description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Short summary for collaborators"
          />
        </div>
        <div className="form-group">
          <label>Primary platforms</label>
          <div className="tag-group">
            {platformOptions.map((platform) => {
              const isActive = form.platforms.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  className="button secondary"
                  style={{
                    background: isActive ? "var(--accent)" : "rgba(148, 163, 184, 0.2)",
                    color: isActive ? "#0f172a" : "var(--text)",
                  }}
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      platforms: isActive
                        ? prev.platforms.filter((item) => item !== platform)
                        : [...prev.platforms, platform],
                    }));
                  }}
                >
                  {platform}
                </button>
              );
            })}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="template-content">Message structure</label>
          <textarea
            id="template-content"
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            placeholder="Draft your framework. Use {curly_braces} for dynamic fields."
          />
        </div>
        <div className="form-group">
          <label htmlFor="template-tags">Default tags or hashtags</label>
          <input
            id="template-tags"
            value={form.tags}
            onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            placeholder="#brand, #update, #launch"
          />
        </div>
        {placeholders.length > 0 && (
          <div className="badge" style={{ marginBottom: "0.5rem" }}>
            Placeholders:{" "}
            {placeholders.map((token) => `{${token}}`).join(" • ")}
          </div>
        )}
        <div className="form-inline">
          <button className="button" type="submit">
            {isEditing ? "Update template" : "Save template"}
          </button>
          {isEditing && (
            <button className="button secondary" type="button" onClick={reset}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
      {templates.length === 0 ? (
        <div className="empty-state">No templates yet. Create your first framework above.</div>
      ) : (
        <div className="list">
          {templates.map((template) => {
            const placeholdersList = parsePlaceholders(template.content);
            return (
              <div key={template.id} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{template.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{template.description}</div>
                  </div>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => onSelect(template.id)}
                    style={{
                      background:
                        selectedTemplateId === template.id
                          ? "var(--accent)"
                          : "rgba(148, 163, 184, 0.18)",
                      color: selectedTemplateId === template.id ? "#0f172a" : "var(--text)",
                    }}
                  >
                    Use
                  </button>
                </div>
                <div className="tag-group">
                  {template.platforms.map((platform) => (
                    <span key={platform} className="tag">
                      {platform}
                    </span>
                  ))}
                </div>
                {placeholdersList.length > 0 && (
                  <div className="tag-group">
                    {placeholdersList.map((token) => (
                      <span key={token} className="tag">
                        {'{'}
                        {token}
                        {'}'}
                      </span>
                    ))}
                  </div>
                )}
                <div className="template-content">{template.content}</div>
                <div className="list-item-actions">
                  <button className="button secondary" type="button" onClick={() => startEditing(template)}>
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => onDelete(template.id)}
                    style={{ color: "var(--danger)" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ComposerProps = {
  templates: Template[];
  onCompose: (post: ScheduledPost) => void;
};

type ComposerState = {
  templateId: string;
  values: Record<string, string>;
  scheduledAt?: string;
  platforms: Platform[];
  notes: string;
  mediaUrl: string;
  reviewers: string;
};

function PostComposer({ templates, onCompose }: ComposerProps) {
  const firstTemplateId = templates[0]?.id ?? "";
  const [state, setState] = useState<ComposerState>({
    templateId: firstTemplateId,
    values: {},
    scheduledAt: undefined,
    platforms: templates[0]?.platforms ?? ["Twitter"],
    notes: "",
    mediaUrl: "",
    reviewers: "",
  });

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === state.templateId),
    [state.templateId, templates],
  );

  useEffect(() => {
    if (templates.length === 0) {
      window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          templateId: "",
          platforms: [],
        }));
      }, 0);
      return;
    }
    const stillExists = templates.some((template) => template.id === state.templateId);
    if (!stillExists) {
      window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          templateId: templates[0].id,
          platforms: templates[0].platforms,
          values: {},
        }));
      }, 0);
    }
  }, [templates, state.templateId]);

  const placeholders = useMemo(
    () => parsePlaceholders(activeTemplate?.content ?? ""),
    [activeTemplate?.content],
  );

  const finalMessage = activeTemplate
    ? mergeTemplateContent(activeTemplate.content, state.values)
    : "Select a template to begin";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTemplate) {
      return;
    }
    const timestamp = new Date().toISOString();
    const payload: ScheduledPost = {
      id: createId(),
      templateId: activeTemplate.id,
      templateName: activeTemplate.name,
      values: state.values,
      finalMessage,
      platforms: state.platforms,
      scheduledAt: state.scheduledAt,
      status: "pending",
      createdAt: timestamp,
      notes: state.notes.trim() || undefined,
      mediaUrl: state.mediaUrl.trim() || undefined,
      reviewers: state.reviewers
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    };
    onCompose(payload);
    setState((prev) => ({
      ...prev,
      values: {},
      notes: "",
      mediaUrl: "",
      reviewers: "",
    }));
  };

  return (
    <div className="section-card">
      <div className="section-title">
        <span role="img" aria-label="compose">
          ✍️
        </span>
        Compose & Stage
      </div>
      <form onSubmit={submit} className="list-item" style={{ gap: "1.2rem" }}>
        <div className="form-group">
          <label htmlFor="composer-template">Choose template</label>
          <select
            id="composer-template"
            value={state.templateId}
            onChange={(event) => {
              const nextId = event.target.value;
              const nextTemplate = templates.find((template) => template.id === nextId);
              setState((prev) => ({
                ...prev,
                templateId: nextId,
                values: {},
                platforms: nextTemplate?.platforms ?? [],
              }));
            }}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        {placeholders.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {placeholders.map((placeholder) => (
              <div key={placeholder} className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor={`placeholder-${placeholder}`}>{placeholder}</label>
                <textarea
                  id={`placeholder-${placeholder}`}
                  value={state.values[placeholder] ?? ""}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      values: { ...prev.values, [placeholder]: event.target.value },
                    }))
                  }
                  placeholder={`Fill in ${placeholder}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">This template has no dynamic fields.</div>
        )}
        <div className="form-group">
          <label htmlFor="composer-schedule">Schedule (optional)</label>
          <input
            id="composer-schedule"
            type="datetime-local"
            value={state.scheduledAt ?? ""}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                scheduledAt: event.target.value || undefined,
              }))
            }
          />
        </div>
        <div className="form-group">
          <label>Publish to</label>
          <div className="tag-group">
            {platformOptions.map((platform) => {
              const isSelected = state.platforms.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  className="button secondary"
                  style={{
                    background: isSelected ? "var(--accent)" : "rgba(148, 163, 184, 0.2)",
                    color: isSelected ? "#0f172a" : "var(--text)",
                  }}
                  onClick={() => {
                    setState((prev) => ({
                      ...prev,
                      platforms: isSelected
                        ? prev.platforms.filter((item) => item !== platform)
                        : [...prev.platforms, platform],
                    }));
                  }}
                >
                  {platform}
                </button>
              );
            })}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="composer-reviewers">Required approvers (comma separated)</label>
          <input
            id="composer-reviewers"
            value={state.reviewers}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                reviewers: event.target.value,
              }))
            }
            placeholder="e.g. Maya, Alex"
          />
        </div>
        <div className="form-group">
          <label htmlFor="composer-media">Reference assets (URL)</label>
          <input
            id="composer-media"
            value={state.mediaUrl}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                mediaUrl: event.target.value,
              }))
            }
            placeholder="https://assets.myteam.com/dropbox-folder"
          />
        </div>
        <div className="form-group">
          <label htmlFor="composer-notes">Internal notes</label>
          <textarea
            id="composer-notes"
            value={state.notes}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                notes: event.target.value,
              }))
            }
            placeholder="Share context or approvals requirements"
          />
        </div>
        {activeTemplate && activeTemplate.tags.length > 0 && (
          <div className="tag-group">
            {activeTemplate.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="preview-card">
          <div className="preview-header">
            <span>{activeTemplate?.name ?? "Template preview"}</span>
            <span>{state.platforms.join(" · ") || "No platforms selected"}</span>
          </div>
          <div className="preview-body">{finalMessage}</div>
        </div>
        <button className="button" type="submit" disabled={!activeTemplate}>
          Send to approval queue
        </button>
      </form>
    </div>
  );
}

type ApprovalQueueProps = {
  posts: ScheduledPost[];
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onSchedule: (id: string) => void;
  onDelete: (id: string) => void;
};

function ApprovalQueue({ posts, onApprove, onPublish, onSchedule, onDelete }: ApprovalQueueProps) {
  const sorted = [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <div className="section-card" style={{ marginTop: "2rem" }}>
      <div className="section-title">
        <span role="img" aria-label="approval">
          ✅
        </span>
        Approval Queue
      </div>
      {sorted.length === 0 ? (
        <div className="empty-state">No posts waiting. Compose something new to kick off the flow.</div>
      ) : (
        <div className="list">
          {sorted.map((post) => (
            <div key={post.id} className="list-item">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{post.templateName}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    Created {formatDateTime(post.createdAt)}
                  </div>
                </div>
                <div className={`status-pill ${post.status}`}>
                  {post.status === "pending" && "Pending review"}
                  {post.status === "approved" && "Approved"}
                  {post.status === "scheduled" && "Scheduled"}
                  {post.status === "published" && "Published"}
                </div>
              </div>
              <div className="preview-card" style={{ padding: "1rem" }}>
                <div className="preview-header">
                  <span>{post.platforms.join(" · ")}</span>
                  <span>{formatDateTime(post.scheduledAt)}</span>
                </div>
                <div className="preview-body">{post.finalMessage}</div>
              </div>
              {post.mediaUrl && (
                <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  Assets: <a href={post.mediaUrl}>{post.mediaUrl}</a>
                </div>
              )}
              {post.notes && <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Notes: {post.notes}</div>}
              {post.reviewers.length > 0 && (
                <div className="tag-group">
                  {post.reviewers.map((reviewer) => (
                    <span key={reviewer} className="tag">
                      Needs: {reviewer}
                    </span>
                  ))}
                </div>
              )}
              <div className="list-item-actions">
                {post.status === "pending" && (
                  <button className="button" type="button" onClick={() => onApprove(post.id)}>
                    Approve
                  </button>
                )}
                {post.status === "approved" && post.scheduledAt && (
                  <button className="button" type="button" onClick={() => onSchedule(post.id)}>
                    Mark as scheduled
                  </button>
                )}
                {(post.status === "approved" || post.status === "scheduled") && (
                  <button className="button" type="button" onClick={() => onPublish(post.id)}>
                    Publish now
                  </button>
                )}
                <button className="button secondary" type="button" onClick={() => onDelete(post.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type StatsBarProps = {
  templates: Template[];
  posts: ScheduledPost[];
};

function StatsBar({ templates, posts }: StatsBarProps) {
  const pendingCount = posts.filter((post) => post.status === "pending").length;
  const approvedCount = posts.filter((post) => post.status === "approved").length;
  const publishedCount = posts.filter((post) => post.status === "published").length;
  const usageLeader = templates.reduce<Template | null>((acc, template) => {
    if (!acc || template.usageCount > acc.usageCount) return template;
    return acc;
  }, null);

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <span className="stat-label">Templates</span>
        <span className="stat-value">{templates.length}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          {usageLeader ? `${usageLeader.name} is the all-star` : "Build your first reusable format"}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Awaiting approval</span>
        <span className="stat-value">{pendingCount}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Keep reviewers unblocked</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Ready to ship</span>
        <span className="stat-value">{approvedCount}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Green lights for publishing</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Published</span>
        <span className="stat-value">{publishedCount}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Autopilot momentum</span>
      </div>
    </div>
  );
}

type ActivityLogProps = {
  entries: ActivityEntry[];
};

function ActivityLog({ entries }: ActivityLogProps) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="section-card" style={{ marginTop: "2rem" }}>
      <div className="section-title">
        <span role="img" aria-label="activity">
          📈
        </span>
        Activity feed
      </div>
      <div className="list">
        {entries.slice(0, 12).map((entry) => (
          <div key={entry.id} className="list-item">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600 }}>{entry.summary}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {formatDateTime(entry.timestamp)}
              </span>
            </div>
            {entry.detail && <div style={{ color: "var(--muted)" }}>{entry.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [state, setState, hydrated] = usePersistentState();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(
    state.templates[0]?.id,
  );

  useEffect(() => {
    if (state.templates.length === 0) {
      window.setTimeout(() => {
        setSelectedTemplateId(undefined);
      }, 0);
      return;
    }
    if (!selectedTemplateId || !state.templates.some((tpl) => tpl.id === selectedTemplateId)) {
      window.setTimeout(() => {
        setSelectedTemplateId(state.templates[0]?.id);
      }, 0);
    }
  }, [state.templates, selectedTemplateId]);

  const upsertTemplate = (template: Template) => {
    setState((prev) => {
      const exists = prev.templates.some((item) => item.id === template.id);
      const templates = exists
        ? prev.templates.map((item) => (item.id === template.id ? template : item))
        : [template, ...prev.templates];
      const activityEntry: ActivityEntry = exists
        ? {
            id: createId(),
            timestamp: template.updatedAt,
            summary: `Template updated: ${template.name}`,
            detail: "Structure refreshed",
            category: "template",
          }
        : {
            id: createId(),
            timestamp: template.createdAt,
            summary: `New template: ${template.name}`,
            detail: `Platforms: ${template.platforms.join(", ")}`,
            category: "template",
          };
      return {
        ...prev,
        templates,
        activity: appendActivity(prev.activity, activityEntry),
      };
    });
  };

  const removeTemplate = (id: string) => {
    setState((prev) => ({
      ...prev,
      templates: prev.templates.filter((template) => template.id !== id),
      activity: appendActivity(prev.activity, {
        id: createId(),
        timestamp: new Date().toISOString(),
        summary: "Template archived",
        detail: "Removed from library",
        category: "template",
      }),
    }));
  };

  const addPost = (post: ScheduledPost) => {
    setState((prev) => ({
      ...prev,
      posts: [post, ...prev.posts],
      templates: prev.templates.map((template) =>
        template.id === post.templateId
          ? { ...template, usageCount: template.usageCount + 1 }
          : template,
      ),
      activity: appendActivity(prev.activity, {
        id: createId(),
        timestamp: new Date().toISOString(),
        summary: `Staged: ${post.templateName}`,
        detail: `Awaiting approval for ${post.platforms.join(", ")}`,
        category: "post",
      }),
    }));
  };

  const setPostStatus = (id: string, status: PostStatus) => {
    const timestamp = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      posts: prev.posts.map((post) => {
        if (post.id !== id) return post;
        if (status === "approved") {
          return { ...post, status, approvedAt: timestamp };
        }
        if (status === "published") {
          return { ...post, status, publishedAt: timestamp };
        }
        if (status === "scheduled") {
          return { ...post, status };
        }
        return { ...post, status };
      }),
    }));
  };

  const deletePost = (id: string) => {
    setState((prev) => ({
      ...prev,
      posts: prev.posts.filter((post) => post.id !== id),
      activity: appendActivity(prev.activity, {
        id: createId(),
        timestamp: new Date().toISOString(),
        summary: "Post removed",
        detail: "Cleared from queue",
        category: "post",
      }),
    }));
  };

  const handleApprove = (id: string) => {
    const post = state.posts.find((item) => item.id === id);
    if (!post) {
      setPostStatus(id, "approved");
      return;
    }
    const timestamp = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      posts: prev.posts.map((item) =>
        item.id === id ? { ...item, status: "approved", approvedAt: timestamp } : item,
      ),
      activity: appendActivity(prev.activity, {
        id: createId(),
        timestamp,
        summary: `Approved: ${post.templateName}`,
        detail: `Ready for ${post.platforms.join(", ")}`,
        category: "post",
      }),
    }));
  };

  const handlePublish = (id: string) => {
    const post = state.posts.find((item) => item.id === id);
    if (!post) {
      setPostStatus(id, "published");
      return;
    }
    const timestamp = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      posts: prev.posts.map((item) =>
        item.id === id ? { ...item, status: "published", publishedAt: timestamp } : item,
      ),
      activity: appendActivity(prev.activity, {
        id: createId(),
        timestamp,
        summary: `Published: ${post.templateName}`,
        detail: `Shipped to ${post.platforms.join(", ")}`,
        category: "post",
      }),
    }));
  };

  const handleSchedule = (id: string) => {
    const post = state.posts.find((item) => item.id === id);
    if (!post) {
      setPostStatus(id, "scheduled");
      return;
    }
    const timestamp = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      posts: prev.posts.map((item) =>
        item.id === id ? { ...item, status: "scheduled" } : item,
      ),
      activity: appendActivity(prev.activity, {
        id: createId(),
        timestamp,
        summary: `Scheduled: ${post.templateName}`,
        detail: post.scheduledAt ? `Publishes ${formatDateTime(post.scheduledAt)}` : undefined,
        category: "post",
      }),
    }));
  };

  if (!hydrated) {
    return (
      <main>
        <div className="section-card">
          <div className="section-title">Loading workspace…</div>
          <div className="empty-state">Syncing your automation cockpit.</div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header style={{ marginBottom: "2.5rem" }}>
        <div className="badge">SignalFlow • Social Automation Agent</div>
        <h1 style={{ fontSize: "2.4rem", margin: "0.6rem 0" }}>Plan, approve, and publish with confidence.</h1>
        <p style={{ color: "var(--muted)", maxWidth: "620px" }}>
          Build reusable playbooks, capture reviewer alignment, and only go live once every stakeholder signs off.
          Everything syncs locally so you can iterate quickly.
        </p>
      </header>

      <StatsBar templates={state.templates} posts={state.posts} />

      <div className="grid">
        <TemplateManager
          templates={state.templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          onSave={upsertTemplate}
          onDelete={removeTemplate}
        />
        <PostComposer templates={state.templates} onCompose={addPost} />
      </div>

      <ApprovalQueue
        posts={state.posts}
        onApprove={handleApprove}
        onPublish={handlePublish}
        onSchedule={handleSchedule}
        onDelete={deletePost}
      />

      <ActivityLog entries={state.activity} />
    </main>
  );
}
