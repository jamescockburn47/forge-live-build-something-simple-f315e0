(function () {
  "use strict";

  const STORAGE_KEY = "quick-notes:v1";
  const MAX_LENGTH = 500;

  const form = document.getElementById("note-form");
  const input = document.getElementById("note-input");
  const charCount = document.getElementById("char-count");
  const list = document.getElementById("notes-list");
  const emptyState = document.getElementById("empty-state");
  const clearBtn = document.getElementById("clear-btn");
  const filterButtons = document.querySelectorAll(".filter-btn");

  let notes = loadNotes();
  let currentFilter = "all";
  let saveWarned = false;

  // ---------- Storage ----------
  function isValidNote(n) {
    return (
      n &&
      typeof n === "object" &&
      typeof n.text === "string" &&
      typeof n.id === "string" &&
      typeof n.done === "boolean"
    );
  }

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Validate each note's shape so a corrupted entry can't crash render.
      return parsed.filter(isValidNote).map((n) => ({
        id: n.id,
        text: n.text,
        done: n.done,
        createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
        updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : n.createdAt || Date.now(),
      }));
    } catch (err) {
      console.warn("Could not load notes:", err);
      return [];
    }
  }

  function saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.warn("Could not save notes:", err);
      // Surface quota errors so the user knows edits aren't being persisted.
      const isQuota =
        err &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          err.code === 22 ||
          err.code === 1014);
      if (isQuota && !saveWarned) {
        saveWarned = true;
        alert(
          "Browser storage is full. Your changes are showing on screen but aren't being saved. Try deleting some notes to free up space."
        );
      }
    }
  }

  // ---------- Helpers ----------
  function formatDate(timestamp) {
    const d = new Date(timestamp);
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const opts = sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
    return d.toLocaleString(undefined, opts);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateCharCount() {
    const len = input.value.length;
    charCount.textContent = `${len} / ${MAX_LENGTH}`;
    charCount.style.color = len > MAX_LENGTH ? "var(--danger)" : "var(--muted)";
  }

  function getFilteredNotes() {
    if (currentFilter === "active") return notes.filter((n) => !n.done);
    if (currentFilter === "done") return notes.filter((n) => n.done);
    return notes;
  }

  // ---------- Rendering ----------
  function render() {
    const filtered = getFilteredNotes();
    list.innerHTML = "";

    if (filtered.length === 0) {
      emptyState.hidden = false;
      if (notes.length === 0) {
        emptyState.textContent = "No notes yet. Add one above to get started!";
      } else {
        emptyState.textContent = "Nothing here for this filter.";
      }
      return;
    }

    emptyState.hidden = true;

    const frag = document.createDocumentFragment();
    filtered.forEach((note) => {
      const li = document.createElement("li");
      li.className = "note" + (note.done ? " done" : "");
      li.dataset.id = note.id;

      li.innerHTML = `
        <input
          type="checkbox"
          class="checkbox"
          aria-label="Mark note as done"
          ${note.done ? "checked" : ""}
        />
        <div class="body">
          <div class="text">${escapeHtml(note.text)}</div>
          <span class="meta">${escapeHtml(formatDate(note.updatedAt || note.createdAt))}</span>
        </div>
        <button class="delete" aria-label="Delete note" title="Delete">×</button>
      `;

      frag.appendChild(li);
    });
    list.appendChild(frag);
  }

  // ---------- Actions ----------
  function addNote(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    notes.unshift({
      id: now.toString(36) + Math.random().toString(36).slice(2, 6),
      text: trimmed.slice(0, MAX_LENGTH),
      done: false,
      createdAt: now,
      updatedAt: now,
    });
    saveNotes();
    render();
  }

  function toggleNote(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    note.done = !note.done;
    note.updatedAt = Date.now();
    saveNotes();
    render();
  }

  function deleteNote(id) {
    notes = notes.filter((n) => n.id !== id);
    saveNotes();
    render();
  }

  function clearAll() {
    if (notes.length === 0) return;
    const ok = confirm(
      `Delete all ${notes.length} note${notes.length === 1 ? "" : "s"}? This cannot be undone.`
    );
    if (!ok) return;
    notes = [];
    saveNotes();
    render();
  }

  // ---------- Event listeners ----------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const value = input.value;
    if (value.length > MAX_LENGTH) {
      // Inform the user that over-length input is being truncated
      // instead of silently dropping the action.
      alert(
        `Your note was longer than ${MAX_LENGTH} characters and has been truncated to fit.`
      );
    }
    addNote(value); // addNote already slices to MAX_LENGTH
    input.value = "";
    updateCharCount();
    input.focus();
  });

  input.addEventListener("input", updateCharCount);

  // Submit on Enter, new line on Shift+Enter
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  list.addEventListener("click", function (e) {
    const li = e.target.closest(".note");
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.classList.contains("delete")) {
      deleteNote(id);
    }
  });

  list.addEventListener("change", function (e) {
    if (e.target.classList.contains("checkbox")) {
      const li = e.target.closest(".note");
      if (li) toggleNote(li.dataset.id);
    }
  });

  clearBtn.addEventListener("click", clearAll);

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // ---------- Init ----------
  updateCharCount();
  render();
})();