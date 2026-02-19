import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { sanitizeMarkdown } from '../components/study/MarkdownContent';

/**
 * Markdown Property-Based Tests
 * 
 * These tests verify the correctness properties of the markdown rendering system
 * as specified in the design document.
 */

// Generator for safe strings (no special markdown or HTML characters)
const safeStringArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => !/[<>*_`\[\]()#\\]/.test(s) && s.trim().length > 0);

// Generator for markdown bold text
const boldMarkdownArb = safeStringArb.map(s => `**${s}**`);

// Generator for markdown italic text
const italicMarkdownArb = safeStringArb.map(s => `*${s}*`);

// Generator for markdown code text
const codeMarkdownArb = safeStringArb.map(s => `\`${s}\``);

// Generator for markdown code blocks
const codeBlockMarkdownArb = safeStringArb.map(s => `\`\`\`\n${s}\n\`\`\``);

// Generator for mixed markdown content
const mixedMarkdownArb = fc.oneof(
  boldMarkdownArb,
  italicMarkdownArb,
  codeMarkdownArb,
  codeBlockMarkdownArb,
  safeStringArb
);

// Generator for XSS payloads
const xssPayloadArb = fc.oneof(
  fc.constant('<script>alert("xss")</script>'),
  fc.constant('<script src="evil.js"></script>'),
  fc.constant('<img onerror="alert(1)" src="x">'),
  fc.constant('<img src="x" onerror="alert(1)">'),
  fc.constant('<a href="javascript:alert(1)">click</a>'),
  fc.constant('<div onclick="alert(1)">click</div>'),
  fc.constant('<body onload="alert(1)">'),
  fc.constant('<svg onload="alert(1)">'),
  fc.constant('<input onfocus="alert(1)">'),
  fc.constant('<iframe src="javascript:alert(1)">'),
  safeStringArb.map(s => `<div onclick="alert('${s}')">`),
  safeStringArb.map(s => `<script>${s}</script>`),
  safeStringArb.map(s => `<a href="javascript:${s}">link</a>`),
  fc.constant('<img src="x" ONERROR="alert(1)">'), // uppercase
  fc.constant('<a href="JAVASCRIPT:alert(1)">link</a>'), // uppercase
  fc.constant('<a href="  javascript:alert(1)">link</a>'), // with spaces
);

/**
 * **Feature: cekatan, Property 8: Markdown Rendering Correctness**
 * **Validates: Requirements 5.1**
 * 
 * For any valid markdown input containing bold (**text**), italic (*text*), or code blocks,
 * the rendered output SHALL contain the corresponding HTML elements (<strong>, <em>, <code>).
 */
describe('Property 8: Markdown Rendering Correctness', () => {
  test('Bold markdown (**text**) is preserved through sanitization', () => {
    fc.assert(
      fc.property(safeStringArb, (text) => {
        const markdown = `**${text}**`;
        const sanitized = sanitizeMarkdown(markdown);
        
        // Bold markdown syntax should be preserved (not stripped)
        expect(sanitized).toContain(`**${text}**`);
      }),
      { numRuns: 100 }
    );
  });

  test('Italic markdown (*text*) is preserved through sanitization', () => {
    fc.assert(
      fc.property(safeStringArb, (text) => {
        const markdown = `*${text}*`;
        const sanitized = sanitizeMarkdown(markdown);
        
        // Italic markdown syntax should be preserved
        expect(sanitized).toContain(`*${text}*`);
      }),
      { numRuns: 100 }
    );
  });

  test('Code markdown (`text`) is preserved through sanitization', () => {
    fc.assert(
      fc.property(safeStringArb, (text) => {
        const markdown = `\`${text}\``;
        const sanitized = sanitizeMarkdown(markdown);
        
        // Code markdown syntax should be preserved
        expect(sanitized).toContain(`\`${text}\``);
      }),
      { numRuns: 100 }
    );
  });

  test('Code block markdown is preserved through sanitization', () => {
    fc.assert(
      fc.property(safeStringArb, (text) => {
        const markdown = `\`\`\`\n${text}\n\`\`\``;
        const sanitized = sanitizeMarkdown(markdown);
        
        // Code block syntax should be preserved
        expect(sanitized).toContain('```');
        expect(sanitized).toContain(text);
      }),
      { numRuns: 100 }
    );
  });

  test('Mixed markdown content is preserved through sanitization', () => {
    fc.assert(
      fc.property(mixedMarkdownArb, (markdown) => {
        const sanitized = sanitizeMarkdown(markdown);
        
        // Safe markdown should pass through unchanged
        // (no XSS content means no changes)
        expect(sanitized).toBe(markdown);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cekatan, Property 9: Markdown XSS Sanitization**
 * **Validates: Requirements 5.4**
 * 
 * For any input containing <script> tags, javascript: URLs, or on* event handlers,
 * the sanitized output SHALL NOT contain executable code.
 */
describe('Property 9: Markdown XSS Sanitization', () => {
  test('Script tags are removed from input', () => {
    fc.assert(
      fc.property(safeStringArb, (content) => {
        const malicious = `<script>${content}</script>`;
        const sanitized = sanitizeMarkdown(malicious);
        
        // Script tags should be completely removed
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toContain('</script>');
      }),
      { numRuns: 100 }
    );
  });

  test('javascript: URLs are neutralized', () => {
    fc.assert(
      fc.property(safeStringArb, (content) => {
        const malicious = `<a href="javascript:${content}">link</a>`;
        const sanitized = sanitizeMarkdown(malicious);
        
        // javascript: protocol should be removed
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
      }),
      { numRuns: 100 }
    );
  });

  test('on* event handlers are removed', () => {
    const eventHandlers = ['onclick', 'onerror', 'onload', 'onfocus', 'onmouseover'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...eventHandlers),
        safeStringArb,
        (handler, content) => {
          const malicious = `<div ${handler}="alert('${content}')">test</div>`;
          const sanitized = sanitizeMarkdown(malicious);
          
          // Event handlers should be removed
          expect(sanitized.toLowerCase()).not.toMatch(new RegExp(`${handler}\\s*=`));
        }
      ),
      { numRuns: 100 }
    );
  });

  test('All XSS payloads are neutralized', () => {
    fc.assert(
      fc.property(xssPayloadArb, (payload) => {
        const sanitized = sanitizeMarkdown(payload);
        
        // None of these dangerous patterns should remain
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toMatch(/javascript\s*:/);
        expect(sanitized.toLowerCase()).not.toMatch(/\bon\w+\s*=/);
      }),
      { numRuns: 100 }
    );
  });

  test('XSS payloads mixed with valid markdown are sanitized', () => {
    fc.assert(
      fc.property(xssPayloadArb, safeStringArb, (payload, safeText) => {
        const mixed = `**${safeText}** ${payload} *more text*`;
        const sanitized = sanitizeMarkdown(mixed);
        
        // XSS should be removed
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toMatch(/javascript\s*:/);
        expect(sanitized.toLowerCase()).not.toMatch(/\bon\w+\s*=/);
        
        // But safe markdown should remain
        expect(sanitized).toContain(`**${safeText}**`);
        expect(sanitized).toContain('*more text*');
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cekatan, Property 10: Markdown Round-Trip Consistency**
 * **Validates: Requirements 5.5**
 * 
 * For any markdown string, parsing and re-serializing (where applicable)
 * SHALL produce consistent output.
 * 
 * Note: Since we're using react-markdown which doesn't provide a serializer,
 * we test that sanitization is idempotent (applying it twice gives same result).
 */
describe('Property 10: Markdown Round-Trip Consistency', () => {
  test('Sanitization is idempotent (applying twice gives same result)', () => {
    fc.assert(
      fc.property(mixedMarkdownArb, (markdown) => {
        const once = sanitizeMarkdown(markdown);
        const twice = sanitizeMarkdown(once);
        
        // Sanitizing twice should give the same result as sanitizing once
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });

  test('Sanitization of XSS payloads is idempotent', () => {
    fc.assert(
      fc.property(xssPayloadArb, (payload) => {
        const once = sanitizeMarkdown(payload);
        const twice = sanitizeMarkdown(once);
        
        // Sanitizing twice should give the same result
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });

  test('Mixed content sanitization is idempotent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(mixedMarkdownArb, xssPayloadArb), { minLength: 1, maxLength: 5 }),
        (parts) => {
          const combined = parts.join(' ');
          const once = sanitizeMarkdown(combined);
          const twice = sanitizeMarkdown(once);
          
          expect(twice).toBe(once);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Plain text passes through unchanged', () => {
    fc.assert(
      fc.property(safeStringArb, (text) => {
        const sanitized = sanitizeMarkdown(text);
        
        // Plain safe text should be unchanged
        expect(sanitized).toBe(text);
      }),
      { numRuns: 100 }
    );
  });
});
