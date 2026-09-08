'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Button, Modal } from '@/shared/ui';

import { documentsApi } from '../api/documents.api';
import { previewKindOf, sanitizeHrefs } from '../services/preview.service';
import { type Document } from '../schemas/document.schema';

/**
 * Full-size viewer for one revision's file.
 *
 * The backend already serves revisions with `Content-Disposition: inline` and
 * their real media type, so PDFs and images need nothing but an `<iframe>` —
 * the browser's own viewer is better than anything worth building here. Text
 * formats are fetched and shown as text; Word and Excel have no browser
 * renderer at all, so those offer a download instead of an empty frame.
 *
 * .docx has no native viewer either, so mammoth converts it to HTML in the
 * page. .xlsx stays download-only — see `preview.service.ts` for why.
 *
 * ponytail: no PDF.js. Chrome's own viewer is better than anything worth
 * building, and mammoth is the one converter that earns its place.
 */
export function DocumentPreviewModal({
  projectId,
  document,
  onClose,
}: {
  projectId: string;
  document: Document | null;
  onClose: () => void;
}) {
  const { t } = useI18n();

  if (!document?.revisionId) return null;

  const url = documentsApi.viewUrl(projectId, document.id, document.revisionId);
  const kind = previewKindOf(document.mediaType ?? undefined, document.fileName ?? document.name);

  return (
    <Modal
      open
      title={document.name}
      icon={FileText}
      onClose={onClose}
      className="w-[min(64rem,calc(100vw-2rem))]"
      footer={
        <>
          {/* A plain link, not a fetch: the response sets Content-Disposition,
              so the browser saves it with the right name on its own. */}
          <Button asChild variant="outline">
            <a
              href={documentsApi.downloadUrl(projectId, document.id, document.revisionId)}
              download
            >
              <Download aria-hidden />
              {t('documents.action.download')}
            </a>
          </Button>
          <Button asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              {t('preview.openInTab')}
            </a>
          </Button>
        </>
      }
    >
      <div className="border-border bg-surface-muted/30 h-[65vh] overflow-hidden rounded-lg border">
        {kind === 'unsupported' ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 p-6 text-center">
            <p className="text-sm font-medium">
              {t('preview.unsupported', { format: document.format })}
            </p>
            <p className="text-muted-foreground text-xs">{t('preview.unsupportedHint')}</p>
          </div>
        ) : kind === 'text' ? (
          <TextPreview url={url} />
        ) : kind === 'docx' ? (
          <DocxPreview url={url} />
        ) : (
          <BlobFrame url={url} title={document.name} isPdf={kind === 'pdf'} />
        )}
      </div>
    </Modal>
  );
}

/**
 * Fetch the file, then frame it from a blob URL.
 *
 * Framing the endpoint directly does not work for PDFs: Chrome's built-in
 * viewer refuses to run in an iframe when the response carries
 * `X-Content-Type-Options: nosniff`, and shows a broken-plugin box instead. The
 * same URL opened in a tab renders fine, which is how this was pinned down.
 * Dropping `nosniff` would fix it too — but that header is real protection and
 * a blob is a smaller price than losing it.
 *
 * Images are framed the same way for one behaviour, and because the fetch is
 * what surfaces a 401 or 404 as a message rather than as a blank box.
 */
function BlobFrame({ url, title, isPdf }: { url: string; title: string; isPdf: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ url: string; blobUrl: string | null; failed: boolean }>({
    url,
    blobUrl: null,
    failed: false,
  });

  if (state.url !== url) setState({ url, blobUrl: null, failed: false });

  useEffect(() => {
    const controller = new AbortController();
    let created: string | null = null;

    fetch(url, { signal: controller.signal, credentials: 'same-origin' })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('failed'))))
      .then((blob) => {
        created = URL.createObjectURL(blob);
        setState({ url, blobUrl: created, failed: false });
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name !== 'AbortError') setState({ url, blobUrl: null, failed: true });
      });

    return () => {
      controller.abort();
      // Revoked on unmount, or every open leaks the whole file for the tab's life.
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  if (state.failed) {
    return (
      <p className="text-status-failed flex h-full items-center justify-center p-6 text-sm">
        {t('preview.loadFailed')}
      </p>
    );
  }

  if (!state.blobUrl) return <div className="size-full" />;

  // An <img> for images: it scales to fit, where an iframe would show the raw
  // file at natural size with its own scrollbars.
  return isPdf ? (
    <iframe src={state.blobUrl} title={title} className="size-full border-0" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image cannot take one
    <img src={state.blobUrl} alt={title} className="size-full object-contain" />
  );
}

/**
 * Text and Markdown are fetched rather than framed: an `<iframe>` of `text/plain`
 * inherits none of the page's typography and scrolls in its own box, which reads
 * worse than the same content in the app's own styles.
 *
 * Rendered as plain text, never as HTML — the file is user-uploaded, and not
 * parsing it as markup avoids XSS rather than defending against it.
 */
function TextPreview({ url }: { url: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ url: string; text: string | null; failed: boolean }>({
    url,
    text: null,
    failed: false,
  });

  // Reset during render, not in an effect: deriving from `url` keeps the
  // previous file's contents from flashing under the new file's title, and
  // avoids the cascading render a synchronous setState in an effect causes.
  if (state.url !== url) setState({ url, text: null, failed: false });

  useEffect(() => {
    const controller = new AbortController();

    fetch(url, { signal: controller.signal, credentials: 'same-origin' })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error('failed'))))
      .then((text) => setState({ url, text, failed: false }))
      .catch((error: unknown) => {
        if ((error as Error)?.name !== 'AbortError') setState({ url, text: null, failed: true });
      });

    return () => controller.abort();
  }, [url]);

  if (state.failed) {
    return (
      <p className="text-status-failed flex h-full items-center justify-center p-6 text-sm">
        {t('preview.loadFailed')}
      </p>
    );
  }

  return (
    <pre className="scroll-thin size-full overflow-auto p-4 font-mono text-xs whitespace-pre-wrap">
      {state.text}
    </pre>
  );
}

/**
 * Word, converted to HTML in the browser.
 *
 * mammoth is loaded on demand — it is ~2.5 MB, and most previews are not Word,
 * so it has no business in the main bundle.
 *
 * The HTML it produces is inserted with `dangerouslySetInnerHTML`, which needs
 * justifying: the input is a user-uploaded .docx, so it cannot be trusted. What
 * makes it safe is that mammoth does not pass markup through — it walks the
 * OOXML document tree and emits its own tags from a fixed whitelist (headings,
 * paragraphs, lists, tables, bold/italic, links). A `<script>` written inside a
 * Word file is text in the document body, not a node in the output. The one
 * thing it can carry is a hyperlink `href`, which is why `sanitizeHrefs` runs
 * over the result and strips anything that is not http(s) — a `javascript:`
 * link is the one hole this shape leaves.
 */
function DocxPreview({ url }: { url: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ url: string; html: string | null; failed: boolean }>({
    url,
    html: null,
    failed: false,
  });

  if (state.url !== url) setState({ url, html: null, failed: false });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const [response, mammoth] = await Promise.all([
          fetch(url, { signal: controller.signal, credentials: 'same-origin' }),
          import('mammoth/mammoth.browser'),
        ]);
        if (!response.ok) throw new Error('failed');
        const buffer = await response.arrayBuffer();
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (!cancelled) setState({ url, html: sanitizeHrefs(value), failed: false });
      } catch (error) {
        if (!cancelled && (error as Error)?.name !== 'AbortError') {
          setState({ url, html: null, failed: true });
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  if (state.failed) {
    return (
      <p className="text-status-failed flex h-full items-center justify-center p-6 text-sm">
        {t('preview.loadFailed')}
      </p>
    );
  }

  if (state.html === null) return <div className="size-full" />;

  return (
    <div
      className="docx-preview scroll-thin size-full overflow-auto p-6 text-sm leading-relaxed"
      // Safe because mammoth generates these tags rather than passing markup
      // through, and `sanitizeHrefs` has already stripped non-http(s) links.
      dangerouslySetInnerHTML={{ __html: state.html }}
    />
  );
}
