import { render } from '@react-email/render';
import type { ReactElement } from 'react';

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderEmail(node: ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(node, { pretty: false }),
    render(node, { plainText: true }),
  ]);
  return { html, text };
}
