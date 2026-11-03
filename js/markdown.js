// markdown.js — Markdown 渲染（marked + highlight.js + KaTeX）
(function (global) {
  'use strict';

  if (global.marked) {
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 提取并保护数学公式，渲染后再替换回去
  function protectMath(text) {
    const blocks = [];
    // 块级 $$...$$
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => {
      blocks.push({ display: true, eq: eq.trim() });
      return `@@MATH${blocks.length - 1}@@`;
    });
    // 行内 $...$（不跨行，避免误吃货币）
    text = text.replace(/(^|[^\\$])\$([^\$\n]+?)\$/g, (_, pre, eq) => {
      blocks.push({ display: false, eq: eq.trim() });
      return `${pre}@@MATH${blocks.length - 1}@@`;
    });
    return { text, blocks };
  }

  function restoreMath(html, blocks) {
    return html.replace(/@@MATH(\d+)@@/g, (_, i) => {
      const b = blocks[Number(i)];
      if (!b) return '';
      try {
        if (global.katex) {
          return katex.renderToString(b.eq, {
            displayMode: b.display,
            throwOnError: false
          });
        }
      } catch (e) { /* ignore */ }
      return escapeHtml(b.eq);
    });
  }

  function highlight(code, lang) {
    try {
      if (global.hljs && lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      if (global.hljs) {
        return hljs.highlightAuto(code).value;
      }
    } catch (e) { /* ignore */ }
    return escapeHtml(code);
  }

  function render(text) {
    if (!global.marked) return escapeHtml(text || '').replace(/\n/g, '<br>');

    const { text: protectedText, blocks } = protectMath(text || '');

    let html;
    try {
      html = marked.parse(protectedText, {
        highlight: function (code, lang) { return highlight(code, lang); }
      });
    } catch (e) {
      html = escapeHtml(text || '').replace(/\n/g, '<br>');
    }

    html = restoreMath(html, blocks);
    return html;
  }

  global.MD = { render };
})(window);
