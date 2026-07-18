import { memo, useMemo, useEffect, useRef } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { invoke } from '@tauri-apps/api/core';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function codeLanguageClass(lang: string | undefined) {
  const normalized = lang?.trim().split(/\s+/)[0];
  return normalized ? ` class="language-${normalized}"` : '';
}

function alignAttribute(align: string | null) {
  return align ? ` style="text-align: ${align}"` : '';
}

const marked = new Marked({
  async: false,
  breaks: false,
  gfm: true,
  pedantic: false,
  silent: true,
  renderer: {
    paragraph({ tokens }) {
      return `<p class="md-p">${this.parser.parseInline(tokens)}</p>`;
    },
    heading({ tokens, depth }) {
      return `<h${depth} class="md-h md-h${depth}">${this.parser.parseInline(tokens)}</h${depth}>`;
    },
    list(token) {
      const tag = token.ordered ? 'ol' : 'ul';
      const cls = token.ordered ? 'md-ol' : 'md-ul';
      const start = token.ordered && typeof token.start === 'number' && token.start !== 1
        ? ` start="${token.start}"` : '';
      return `<${tag}${start} class="${cls}">${token.items.map((item) => this.listitem(item)).join('')}</${tag}>`;
    },
    listitem(item) {
      const checkbox = item.task
        ? `<input disabled type="checkbox"${item.checked ? ' checked' : ''}> `
        : '';
      return `<li class="md-li">${checkbox}${this.parser.parse(item.tokens)}</li>`;
    },
    blockquote({ tokens }) {
      return `<blockquote class="md-blockquote">${this.parser.parse(tokens)}</blockquote>`;
    },
    code({ text, lang }) {
      return `<pre class="md-pre"><code${codeLanguageClass(lang)}>${escapeHtml(text)}</code></pre>`;
    },
    codespan({ text }) {
      return `<code class="md-code">${escapeHtml(text)}</code>`;
    },
    link({ href, title, tokens }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener"${titleAttr} class="md-link">${this.parser.parseInline(tokens)}</a>`;
    },
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" class="md-img">`;
    },
    table(token) {
      const header = token.header.map((cell) => this.tablecell({ ...cell, header: true })).join('');
      const body = token.rows.map((row) =>
        `<tr>${row.map((cell) => this.tablecell(cell)).join('')}</tr>`
      ).join('');
      return `<table class="md-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
    },
    tablecell({ tokens, header, align }) {
      const tag = header ? 'th' : 'td';
      const cls = header ? 'md-th' : 'md-td';
      return `<${tag}${alignAttribute(align)} class="${cls}">${this.parser.parseInline(tokens)}</${tag}>`;
    },
    hr() {
      return `<hr class="md-hr">`;
    },
    strong({ tokens }) {
      return `<strong>${this.parser.parseInline(tokens)}</strong>`;
    },
    em({ tokens }) {
      return `<em>${this.parser.parseInline(tokens)}</em>`;
    },
    del({ tokens }) {
      return `<del>${this.parser.parseInline(tokens)}</del>`;
    },
  },
});

function renderMarkdown(text: string): string {
  if (!text.trim()) return '';
  const raw = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel', 'class', 'disabled', 'checked', 'start', 'style'],
  });
}

/**
 * Wrap image in a capped-height preview container.
 * Shows only ~120px of the image with gradient fade + "Show full image" button.
 * Click to expand; then shows "Show less" to collapse back.
 * (openwork pattern)
 */
function wrapImageWithPreview(img: HTMLImageElement) {
  // Already wrapped?
  if (img.parentElement?.classList.contains('md-img-preview')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'md-img-preview-wrapper';

  const previewDiv = document.createElement('div');
  previewDiv.className = 'md-img-preview';

  // Move img into preview container
  img.parentElement?.insertBefore(wrapper, img);
  previewDiv.appendChild(img);
  wrapper.appendChild(previewDiv);

  // Create overlay (gradient + button) — placed on wrapper, not inside clipped div
  const overlay = document.createElement('div');
  overlay.className = 'md-img-overlay';

  const expandBtn = document.createElement('button');
  expandBtn.type = 'button';
  expandBtn.className = 'md-img-expand-btn';
  expandBtn.textContent = 'Show full image';
  overlay.appendChild(expandBtn);
  wrapper.appendChild(overlay);

  // Create collapse button (shown after expand)
  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'md-img-collapse-btn';
  collapseBtn.textContent = 'Show less';

  expandBtn.addEventListener('click', () => {
    previewDiv.classList.add('md-img-preview--revealed');
    overlay.remove();
    wrapper.appendChild(collapseBtn);
  });

  collapseBtn.addEventListener('click', () => {
    previewDiv.classList.remove('md-img-preview--revealed');
    wrapper.appendChild(overlay);
    collapseBtn.remove();
  });
}

/**
 * Resolve local image paths to data URIs via Tauri backend,
 * then wrap each image in a collapsible preview container.
 */
async function resolveAndWrapImages(container: HTMLElement, cwd?: string) {
  const imgs = container.querySelectorAll<HTMLImageElement>('img.md-img');
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (!src) continue;

    // Skip data URIs (already resolved)
    if (/^(data:|blob:)/i.test(src)) {
      wrapImageWithPreview(img);
      continue;
    }

    // Remote URLs — just wrap
    if (/^https?:/i.test(src)) {
      wrapImageWithPreview(img);
      continue;
    }

    // Resolve relative/absolute local path via backend
    const absolutePath = src.startsWith('/') ? src : (cwd ? `${cwd}/${src}` : src);

    try {
      const dataUri = await invoke<string>('read_file_as_data_uri', { filePath: absolutePath });
      img.src = dataUri;
      wrapImageWithPreview(img);
    } catch {
      console.warn(`Failed to load image: ${absolutePath}`);
    }
  }
}

interface MarkdownProps {
  children: string;
  className?: string;
  /** Working directory for resolving relative image/link paths */
  cwd?: string;
}

function MarkdownInner({ children, className, cwd }: MarkdownProps) {
  const html = useMemo(() => renderMarkdown(children), [children]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && html) {
      resolveAndWrapImages(containerRef.current, cwd);
    }
  }, [html, cwd]);

  if (!html) return null;

  return (
    <div
      ref={containerRef}
      className={`md-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const Markdown = memo(MarkdownInner);
Markdown.displayName = 'Markdown';
