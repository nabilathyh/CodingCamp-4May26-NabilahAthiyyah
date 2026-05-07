/* To-Do List Life Dashboard — Application Logic */

/* ============================================================
 * Storage Key Constants
 * These are the only keys used to read/write Local Storage.
 * ============================================================ */

/** @constant {string} KEY_TASKS — Local Storage key for the Task List widget */
const KEY_TASKS = 'tld_tasks';

/** @constant {string} KEY_LINKS — Local Storage key for the Quick Links widget */
const KEY_LINKS = 'tld_links';

/* ============================================================
 * StorageService
 * Centralises all localStorage access. Widgets must never call
 * localStorage directly — always go through StorageService.
 *
 * Requirements: 5.1 – 5.6
 * ============================================================ */

const StorageService = {
  /**
   * Reads a value from localStorage and JSON-parses it.
   *
   * Returns `defaultValue` when:
   *   - the key does not exist (getItem returns null)
   *   - the stored string is not valid JSON (parse throws)
   *
   * @param {string} key          - The localStorage key to read.
   * @param {*}      defaultValue - Fallback value on missing or corrupt data.
   * @returns {*} The parsed value, or `defaultValue`.
   */
  load(key, defaultValue) {
    const raw = localStorage.getItem(key);

    // Key absent — treat as empty default state (Req 5.4)
    if (raw === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(raw);
    } catch (_err) {
      // Malformed JSON — treat as missing and return default (Req 5.6)
      return defaultValue;
    }
  },

  /**
   * JSON-serialises `value` and writes it to localStorage.
   *
   * On failure (e.g. QuotaExceededError) the method:
   *   1. Dispatches a bubbling 'storage-error' CustomEvent on document
   *      so widgets can display an error indicator to the user (Req 5.5).
   *   2. Returns false.
   *
   * On success returns true.
   *
   * @param {string} key   - The localStorage key to write.
   * @param {*}      value - The value to serialise and store.
   * @returns {boolean} true on success, false on failure.
   */
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      // Notify the rest of the application about the write failure (Req 5.5)
      document.dispatchEvent(
        new CustomEvent('storage-error', {
          bubbles: true,
          detail: { key, error },
        })
      );
      return false;
    }
  },
};

/* Modules for Tasks 3–8 will be added below */

/* ============================================================
 * Pure Helper Functions — Greeting Widget
 * Requirements: 1.1 – 1.6
 * ============================================================ */

/**
 * Returns a time-of-day greeting string based on the given hour.
 *
 * @param {number} hour - Local hour (0–23).
 * @returns {"Good Morning"|"Good Afternoon"|"Good Evening"|"Good Night"}
 */
function getGreeting(hour) {
  if (hour >= 5 && hour <= 11) return 'Good Morning';
  if (hour >= 12 && hour <= 17) return 'Good Afternoon';
  if (hour >= 18 && hour <= 21) return 'Good Evening';
  return 'Good Night'; // 22–04
}

/**
 * Formats a Date object as a zero-padded "HH:MM" string.
 *
 * @param {Date} date - The date/time to format.
 * @returns {string} e.g. "09:05"
 */
function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Formats a Date object as "Weekday, D Month YYYY".
 *
 * @param {Date} date - The date/time to format.
 * @returns {string} e.g. "Monday, 5 May 2026"
 */
function formatDate(date) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months   = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

  const weekday = weekdays[date.getDay()];
  const day     = date.getDate();          // no leading zero per spec ("D")
  const month   = months[date.getMonth()];
  const year    = date.getFullYear();

  return `${weekday}, ${day} ${month} ${year}`;
}

/* ============================================================
 * GreetingWidget
 * Manages the #greeting-widget DOM section.
 * Requirements: 1.1 – 1.6
 * ============================================================ */

const GreetingWidget = {
  /** @type {number|null} */
  _intervalId: null,

  /**
   * Initialises the widget:
   *  1. Renders immediately with the current time.
   *  2. Schedules a one-shot setTimeout to fire at the next wall-clock
   *     minute boundary, then starts a repeating setInterval every 60 s.
   */
  init() {
    this._render(new Date());

    const now        = new Date();
    const msToNextMin = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    setTimeout(() => {
      this._render(new Date());
      this._intervalId = setInterval(() => {
        this._render(new Date());
      }, 60_000);
    }, msToNextMin);
  },

  /**
   * Updates the three DOM elements with the current greeting, time, and date.
   *
   * @param {Date} now - The current date/time snapshot to render.
   */
  _render(now) {
    const greetingEl = document.getElementById('greeting-text');
    const timeEl     = document.getElementById('greeting-time');
    const dateEl     = document.getElementById('greeting-date');

    if (greetingEl) greetingEl.textContent = getGreeting(now.getHours());
    if (timeEl)     timeEl.textContent     = formatTime(now);
    if (dateEl)     dateEl.textContent     = formatDate(now);
  },
};

/* ============================================================
 * FocusTimer
 * Manages the #focus-timer-widget DOM section.
 * Requirements: 2.1 – 2.7
 * ============================================================ */

const FocusTimer = {
  /** @type {number} Seconds remaining (0–1500). */
  _remaining: 1500,

  /** @type {boolean} Whether the countdown is currently active. */
  _isRunning: false,

  /** @type {number|null} setInterval handle, or null when stopped. */
  _intervalId: null,

  /**
   * Starts the countdown.
   * No-op if the timer is already running (Req 2.7).
   */
  _start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._intervalId = setInterval(() => this._tick(), 1000);
  },

  /**
   * Called every second while the timer is running.
   * Decrements _remaining, re-renders, and handles reaching zero (Req 2.3, 2.6).
   */
  _tick() {
    this._remaining -= 1;
    this._render();
    if (this._remaining === 0) {
      this._stop();
      this._showAlert();
    }
  },

  /**
   * Pauses the countdown and retains the current remaining time (Req 2.4).
   */
  _stop() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._isRunning = false;
  },

  /**
   * Stops any active countdown and resets the display to 25:00 (Req 2.5).
   */
  _reset() {
    this._stop();
    this._remaining = 1500;
    this._render();
  },

  /**
   * Updates #timer-display with the current remaining time in MM:SS format (Req 2.3).
   */
  _render() {
    const el = document.getElementById('timer-display');
    if (!el) return;
    const minutes = Math.floor(this._remaining / 60);
    const seconds = this._remaining % 60;
    el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  /**
   * Removes the `hidden` attribute from #timer-alert for 3 seconds, then hides it again (Req 2.6).
   */
  _showAlert() {
    const alertEl = document.getElementById('timer-alert');
    if (!alertEl) return;
    alertEl.removeAttribute('hidden');
    setTimeout(() => {
      alertEl.setAttribute('hidden', '');
    }, 3000);
  },

  /**
   * Initialises the widget:
   *  1. Renders the initial 25:00 display.
   *  2. Wires click listeners for Start, Stop, and Reset buttons.
   */
  init() {
    this._render();
    document.getElementById('timer-start').addEventListener('click', () => this._start());
    document.getElementById('timer-stop').addEventListener('click', () => this._stop());
    document.getElementById('timer-reset').addEventListener('click', () => this._reset());
  },
};

/* ============================================================
 * Pure Helper — Task Description Validation
 * Requirements: 3.1, 3.2, 3.4, 3.5
 * ============================================================ */

/**
 * Validates a task description string.
 *
 * @param {string} text - The raw input from the user.
 * @returns {{ valid: true } | { valid: false, reason: string }}
 */
function validateTaskDescription(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Task description cannot be empty.' };
  }
  if (trimmed.length > 500) {
    return { valid: false, reason: 'Task description cannot exceed 500 characters.' };
  }
  return { valid: true };
}

/* ============================================================
 * TaskList
 * Manages the #task-list-widget DOM section.
 * Requirements: 3.1 – 3.11, 5.1 – 5.6
 * ============================================================ */

const TaskList = {
  /** @type {Array<{id: string, description: string, done: boolean, createdAt: number}>} */
  _tasks: [],

  /**
   * Loads tasks from StorageService into _tasks.
   */
  _load() {
    this._tasks = StorageService.load(KEY_TASKS, []);
  },

  /**
   * Persists the current _tasks array to StorageService.
   */
  _save() {
    StorageService.save(KEY_TASKS, this._tasks);
  },

  /**
   * Adds a new task with the given description.
   * Validates first; returns false if invalid, true on success.
   *
   * @param {string} description - Raw user input.
   * @returns {boolean}
   */
  _addTask(description) {
    const result = validateTaskDescription(description);
    if (!result.valid) return false;
    this._tasks.push({
      id: crypto.randomUUID(),
      description: description.trim(),
      done: false,
      createdAt: Date.now(),
    });
    this._save();
    this._render();
    return true;
  },

  /**
   * Updates the description of the task with the given id.
   * Validates first; if invalid, calls _render() to restore and returns false.
   *
   * @param {string} id             - Task id.
   * @param {string} newDescription - New raw description from user.
   * @returns {boolean}
   */
  _editTask(id, newDescription) {
    const result = validateTaskDescription(newDescription);
    if (!result.valid) {
      this._render();
      return false;
    }
    const task = this._tasks.find((t) => t.id === id);
    if (task) {
      task.description = newDescription.trim();
      this._save();
    }
    this._render();
    return true;
  },

  /**
   * Flips the done status of the task with the given id.
   *
   * @param {string} id - Task id.
   */
  _toggleTask(id) {
    const task = this._tasks.find((t) => t.id === id);
    if (task) {
      task.done = !task.done;
      this._save();
      this._render();
    }
  },

  /**
   * Removes the task with the given id from _tasks.
   *
   * @param {string} id - Task id.
   */
  _deleteTask(id) {
    this._tasks = this._tasks.filter((t) => t.id !== id);
    this._save();
    this._render();
  },

  /**
   * Fully re-renders the #task-list <ul> from the current _tasks array.
   * Uses event delegation on #task-list for all interactions.
   */
  _render() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    this._tasks.forEach((task) => {
      const li = document.createElement('li');
      li.dataset.id = task.id;

      // Checkbox for toggling done state
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.dataset.id = task.id;
      checkbox.dataset.action = 'toggle';

      // Description span
      const span = document.createElement('span');
      span.textContent = task.description;
      span.dataset.id = task.id;
      if (task.done) {
        span.classList.add('task-done');
      }

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'task-edit-btn';
      editBtn.dataset.id = task.id;
      editBtn.dataset.action = 'edit';

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'task-delete-btn';
      deleteBtn.dataset.id = task.id;
      deleteBtn.dataset.action = 'delete';

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);

      listEl.appendChild(li);
    });
  },

  /**
   * Replaces the description <span> in a <li> with an inline edit <input>.
   * Confirms on Enter or "Save" button; cancels on Escape.
   *
   * @param {HTMLLIElement} li   - The list item element.
   * @param {string}        id   - Task id.
   * @param {string}        originalDescription - Current task description.
   */
  _activateInlineEdit(li, id, originalDescription) {
    const span = li.querySelector('span');
    if (!span) return;

    // Build the inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalDescription;
    input.dataset.id = id;
    input.dataset.action = 'inline-input';
    input.maxLength = 500;

    // Build the Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.dataset.id = id;
    saveBtn.dataset.action = 'save';

    // Replace span with input + save button
    li.replaceChild(input, span);
    // Insert save button before the edit button
    const editBtn = li.querySelector('.task-edit-btn');
    li.insertBefore(saveBtn, editBtn);

    input.focus();

    // Keyboard handling: Enter = save, Escape = cancel
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._editTask(id, input.value);
      } else if (e.key === 'Escape') {
        this._render(); // restore original
      }
    });
  },

  /**
   * Initialises the TaskList widget:
   *  1. Loads tasks from storage.
   *  2. Renders the list.
   *  3. Wires the Add button and Enter key on #task-input.
   *  4. Sets up event delegation on #task-list.
   */
  init() {
    this._load();
    this._render();

    const taskInput = document.getElementById('task-input');
    const addBtn = document.getElementById('task-add-btn');

    // Add task on button click
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (this._addTask(taskInput.value)) {
          taskInput.value = '';
        }
      });
    }

    // Add task on Enter key in the input
    if (taskInput) {
      taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (this._addTask(taskInput.value)) {
            taskInput.value = '';
          }
        }
      });
    }

    // Event delegation on #task-list
    const listEl = document.getElementById('task-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.dataset.action;
        const id = target.dataset.id;

        if (!action || !id) return;

        if (action === 'toggle') {
          this._toggleTask(id);
        } else if (action === 'edit') {
          const li = target.closest('li');
          const span = li && li.querySelector('span');
          if (li && span) {
            this._activateInlineEdit(li, id, span.textContent);
          }
        } else if (action === 'delete') {
          this._deleteTask(id);
        } else if (action === 'save') {
          const li = target.closest('li');
          const input = li && li.querySelector('input[data-action="inline-input"]');
          if (input) {
            this._editTask(id, input.value);
          }
        }
      });
    }
  },
};

/* ============================================================
 * Pure Helper — Link Validation
 * Requirements: 4.1, 4.2
 * ============================================================ */

/**
 * Validates a quick-link label and URL.
 *
 * Returns { valid: true } iff:
 *   - label.trim().length is in [1, 50]
 *   - url is non-empty, starts with "http://" or "https://", and length ≤ 2048
 *
 * @param {string} label - The display label entered by the user.
 * @param {string} url   - The URL entered by the user.
 * @returns {{ valid: true } | { valid: false, reason: string }}
 */
function validateLink(label, url) {
  const trimmedLabel = typeof label === 'string' ? label.trim() : '';
  if (trimmedLabel.length === 0) {
    return { valid: false, reason: 'Label cannot be empty.' };
  }
  if (trimmedLabel.length > 50) {
    return { valid: false, reason: 'Label cannot exceed 50 characters.' };
  }

  const trimmedUrl = typeof url === 'string' ? url : '';
  if (trimmedUrl.length === 0) {
    return { valid: false, reason: 'URL cannot be empty.' };
  }
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return { valid: false, reason: 'URL must start with http:// or https://.' };
  }
  if (trimmedUrl.length > 2048) {
    return { valid: false, reason: 'URL cannot exceed 2048 characters.' };
  }

  return { valid: true };
}

/* ============================================================
 * QuickLinks
 * Manages the #quick-links-widget DOM section.
 * Requirements: 4.1 – 4.8, 5.1 – 5.6
 * ============================================================ */

const QuickLinks = {
  /** @type {Array<{id: string, label: string, url: string, createdAt: number}>} */
  _links: [],

  /**
   * Loads links from StorageService into _links.
   */
  _load() {
    this._links = StorageService.load(KEY_LINKS, []);
  },

  /**
   * Persists the current _links array to StorageService.
   */
  _save() {
    StorageService.save(KEY_LINKS, this._links);
  },

  /**
   * Adds a new link with the given label and URL.
   * Enforces the 20-link maximum (Req 4.8).
   * Validates first; returns false if invalid, true on success.
   *
   * @param {string} label - Raw label input from the user.
   * @param {string} url   - Raw URL input from the user.
   * @returns {boolean}
   */
  _addLink(label, url) {
    if (this._links.length >= 20) {
      alert('You have reached the maximum of 20 quick links. Please delete one before adding another.');
      return false;
    }

    const result = validateLink(label, url);
    if (!result.valid) return false;

    this._links.push({
      id: crypto.randomUUID(),
      label: label.trim(),
      url,
      createdAt: Date.now(),
    });
    this._save();
    this._render();
    return true;
  },

  /**
   * Removes the link with the given id from _links.
   *
   * @param {string} id - Link id.
   */
  _deleteLink(id) {
    this._links = this._links.filter((link) => link.id !== id);
    this._save();
    this._render();
  },

  /**
   * Fully re-renders the #links-container from the current _links array.
   * Each link is wrapped in a <div class="link-item"> containing:
   *   - an <a> button that opens the URL in a new tab
   *   - a Delete <button> with data-id and data-action="delete"
   */
  _render() {
    const container = document.getElementById('links-container');
    if (!container) return;

    container.innerHTML = '';

    this._links.forEach((link) => {
      const item = document.createElement('div');
      item.className = 'link-item';

      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.className = 'link-btn';
      anchor.textContent = link.label;

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'link-delete-btn';
      deleteBtn.dataset.id = link.id;
      deleteBtn.dataset.action = 'delete';

      item.appendChild(anchor);
      item.appendChild(deleteBtn);
      container.appendChild(item);
    });
  },

  /**
   * Initialises the QuickLinks widget:
   *  1. Loads links from storage.
   *  2. Renders the link list.
   *  3. Wires the Add Link button click.
   *  4. Sets up event delegation on #links-container for delete actions.
   */
  init() {
    this._load();
    this._render();

    const addBtn = document.getElementById('link-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const labelInput = document.getElementById('link-label-input');
        const urlInput = document.getElementById('link-url-input');
        if (this._addLink(labelInput.value, urlInput.value)) {
          labelInput.value = '';
          urlInput.value = '';
        }
      });
    }

    // Event delegation on #links-container for delete actions (Req 4.4)
    const container = document.getElementById('links-container');
    if (container) {
      container.addEventListener('click', (e) => {
        const target = e.target;
        if (target.dataset.action === 'delete' && target.dataset.id) {
          this._deleteLink(target.dataset.id);
        }
      });
    }
  },
};

/* ============================================================
 * Bootstrap — initialise widgets when the DOM is ready
 * ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  GreetingWidget.init();
  FocusTimer.init();
  TaskList.init();
  QuickLinks.init();

  // Storage-error handler — Req 5.5, 5.6
  // Displays a non-blocking toast banner when a localStorage write fails.
  document.addEventListener('storage-error', () => {
    // Avoid stacking duplicate banners
    if (document.querySelector('.storage-error-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'storage-error-banner';
    banner.textContent = '⚠ Could not save data. Storage may be full.';
    document.body.appendChild(banner);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      banner.remove();
    }, 5000);
  });
});
