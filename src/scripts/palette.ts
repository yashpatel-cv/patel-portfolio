/**
 * palette.ts — Thread Finder runtime.
 *
 * Fuzzy subsequence search over build-time entries; full keyboard combobox
 * (ArrowUp/Down, Enter, Escape, Home/End), ⌘K / Ctrl+K / "/" global
 * shortcuts, click-outside dismiss, clipboard action support.
 * Zero dependencies, ~3 KB minified.
 */

interface PaletteEntry {
  label: string;
  hint: string;
  href?: string;
  action?: 'copy-email';
  keys: string;
}

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Subsequence fuzzy score: lower = better; null = no match. */
function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;

  let score = 0;
  let ti = 0;
  let lastHit = -1;
  for (const char of q) {
    const found = t.indexOf(char, ti);
    if (found === -1) return null;
    score += found - (lastHit + 1); // penalize gaps
    lastHit = found;
    ti = found + 1;
  }
  score += t.length * 0.01; // tiebreak: prefer shorter targets
  return score;
}

class ThreadFinder {
  private readonly dialog: HTMLDialogElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private readonly entries: PaletteEntry[];
  private filtered: PaletteEntry[] = [];
  private cursor = 0;

  constructor(dialog: HTMLDialogElement, entries: PaletteEntry[]) {
    this.dialog = dialog;
    this.entries = entries;
    this.input = dialog.querySelector<HTMLInputElement>('.tf-input')!;
    this.list = dialog.querySelector<HTMLUListElement>('.tf-list')!;

    this.input.addEventListener('input', () => this.filter());
    this.input.addEventListener('keydown', (event) => this.onKeydown(event));

    /* click-outside (backdrop) dismiss */
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) this.close();
    });
    dialog.addEventListener('close', () => {
      this.input.value = '';
    });
  }

  open(): void {
    if (this.dialog.open) return;
    this.dialog.showModal();
    this.filter();
    this.input.focus();
  }

  close(): void {
    if (this.dialog.open) this.dialog.close();
  }

  toggle(): void {
    if (this.dialog.open) this.close();
    else this.open();
  }

  private filter(): void {
    const query = this.input.value.trim();
    const scored = this.entries
      .map((entry) => ({
        entry,
        score: fuzzyScore(query, `${entry.label} ${entry.keys}`),
      }))
      .filter((item): item is { entry: PaletteEntry; score: number } => item.score !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 9);

    this.filtered = scored.map((item) => item.entry);
    this.cursor = 0;
    this.render();
  }

  private render(): void {
    this.list.replaceChildren();

    if (this.filtered.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'tf-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = 'no threads match — try a project, skill, or section name';
      this.list.appendChild(empty);
      this.input.removeAttribute('aria-activedescendant');
      return;
    }

    this.filtered.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = 'tf-opt';
      li.id = `tf-opt-${index}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(index === this.cursor));

      const label = document.createElement('span');
      label.className = 'tf-label';
      label.textContent = entry.label;
      const hint = document.createElement('span');
      hint.className = 'tf-hint';
      hint.textContent = entry.hint;
      li.append(label, hint);

      li.addEventListener('pointermove', () => this.setCursor(index));
      li.addEventListener('click', () => void this.activate(index));
      this.list.appendChild(li);
    });

    this.input.setAttribute('aria-activedescendant', `tf-opt-${this.cursor}`);
  }

  private setCursor(index: number): void {
    if (index === this.cursor) return;
    this.cursor = index;
    this.list.querySelectorAll<HTMLElement>('.tf-opt').forEach((opt, i) => {
      opt.setAttribute('aria-selected', String(i === this.cursor));
    });
    this.input.setAttribute('aria-activedescendant', `tf-opt-${this.cursor}`);
    this.list.children[this.cursor]?.scrollIntoView({ block: 'nearest' });
  }

  private onKeydown(event: KeyboardEvent): void {
    const max = this.filtered.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.setCursor(Math.min(this.cursor + 1, max));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.setCursor(Math.max(this.cursor - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        this.setCursor(0);
        break;
      case 'End':
        event.preventDefault();
        this.setCursor(Math.max(max, 0));
        break;
      case 'Enter':
        event.preventDefault();
        void this.activate(this.cursor);
        break;
    }
  }

  private async activate(index: number): Promise<void> {
    const entry = this.filtered[index];
    if (!entry) return;

    if (entry.action === 'copy-email') {
      const email = entry.label.split('— ')[1] ?? '';
      try {
        await navigator.clipboard.writeText(email);
        const option = this.list.children[index];
        if (option) option.querySelector('.tf-label')!.textContent = '✓ copied to clipboard';
        await new Promise((resolve) => setTimeout(resolve, 550));
      } catch {
        /* clipboard denied — fall through and just close */
      }
      this.close();
      return;
    }

    if (!entry.href) return;
    this.close();

    if (entry.href.startsWith('#')) {
      document
        .querySelector(entry.href)
        ?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    } else {
      window.location.href = entry.href;
    }
  }
}

function initPalette(): void {
  const dialog = document.querySelector<HTMLDialogElement>('dialog[data-palette]');
  const dataEl = document.querySelector<HTMLScriptElement>('script[data-palette-data]');
  if (!dialog || !dataEl) return;

  let entries: PaletteEntry[] = [];
  try {
    entries = JSON.parse(dataEl.textContent ?? '[]') as PaletteEntry[];
  } catch {
    return;
  }

  const finder = new ThreadFinder(dialog, entries);

  document.querySelectorAll<HTMLElement>('[data-palette-open]').forEach((button) => {
    button.addEventListener('click', () => finder.open());
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      finder.toggle();
      return;
    }
    const target = event.target as HTMLElement | null;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable;
    if (event.key === '/' && !typing && !dialog.open) {
      event.preventDefault();
      finder.open();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPalette, { once: true });
} else {
  initPalette();
}

export {};
