// src/shared/services/sanitize/index.ts
import sanitizeHtml from 'sanitize-html';

const ALLOWED_IFRAME_HOSTNAMES = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
  'www.dailymotion.com',
  'geo.dailymotion.com',
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
    'sub', 'sup', 'small', 'code', 'kbd', 'samp', 'var',
    'p', 'br', 'hr', 'div', 'span',
    'h2', 'h3', 'h4',
    'blockquote', 'pre',
    'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    'iframe',
  ],

  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'title'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    p: ['class'],
    div: ['class'],
    span: ['class'],
    pre: ['class'],
    code: ['class'],
    blockquote: ['cite'],
  },

  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['https'],
    a: ['https', 'http', 'mailto', 'tel'],
  },

  allowedClasses: {
    code: ['language-*'],
    pre: ['language-*'],
  },

  transformTags: {
    a: (tagName, attribs): sanitizeHtml.Tag => {
      const href = attribs['href'] ?? '';
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
      };
    },

    iframe: (tagName, attribs): sanitizeHtml.Tag => {
      const src = attribs['src'] ?? '';
      let hostname: string;

      try {
        hostname = new URL(src).hostname;
      } catch {
        // URL inválida — troca por parágrafo vazio sem atributos undefined
        return { tagName: 'p', attribs: {} };
      }

      if (!ALLOWED_IFRAME_HOSTNAMES.includes(hostname)) {
        return { tagName: 'p', attribs: {} };
      }

      // Todos os valores são string explícita — sem undefined
      return {
        tagName,
        attribs: {
          src,
          width: attribs['width'] ?? '560',
          height: attribs['height'] ?? '315',
          frameborder: '0',
          allowfullscreen: '',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          title: attribs['title'] ?? 'Vídeo incorporado',
        },
      };
    },

    img: (tagName, attribs): sanitizeHtml.Tag => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy' },
    }),
  },

  exclusiveFilter: (frame) => {
    const VOID_ELEMENTS = ['br', 'hr', 'img', 'input'];
    if (VOID_ELEMENTS.includes(frame.tag)) return false;
    return !frame.text.trim() && !frame.mediaChildren?.length;
  },
};

export function sanitizeArticleContent(html: string): string {
  if (!html || html.trim() === '') return '';
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

export function sanitizePlainText(text: string): string {
  if (!text || text.trim() === '') return '';
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }).trim();
}