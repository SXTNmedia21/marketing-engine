import type { FormField } from '@me/lp-config';
import { escapeHtml as e, escapeAttr as a } from './escape.js';

export function renderForm(
  form: { fields: FormField[]; submit_label: string },
  slug: string,
): string {
  const fields = form.fields.map((f) => renderField(f)).join('');
  return `<form id="me-form" data-slug="${a(slug)}" autocomplete="on" novalidate>
${fields}
<button type="submit">${e(form.submit_label)}</button>
</form>`;
}

function renderField(f: FormField): string {
  const required = f.required ? 'required' : '';
  const placeholder = f.placeholder ? `placeholder="${a(f.placeholder)}"` : '';
  const label = `<label for="f-${a(f.name)}">${e(f.label)}</label>`;
  switch (f.type) {
    case 'textarea':
      return `${label}<textarea id="f-${a(f.name)}" name="${a(f.name)}" ${required} ${placeholder}></textarea>`;
    case 'select': {
      const opts = (f.options ?? []).map((o) => `<option value="${a(o)}">${e(o)}</option>`).join('');
      return `${label}<select id="f-${a(f.name)}" name="${a(f.name)}" ${required}>${opts}</select>`;
    }
    case 'checkbox':
      return `<label class="cb"><input type="checkbox" name="${a(f.name)}" ${required}> ${e(f.label)}</label>`;
    default:
      return `${label}<input type="${a(f.type)}" id="f-${a(f.name)}" name="${a(f.name)}" ${required} ${placeholder}>`;
  }
}
