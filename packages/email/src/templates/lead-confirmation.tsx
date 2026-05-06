import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface LeadConfirmationProps {
  recipient_first_name: string;
  campaign_name: string;
  cta_url: string;
  cta_label: string;
  preview_text: string;
  body_paragraphs: string[];
  unsubscribe_url: string;
}

export function LeadConfirmationEmail(props: LeadConfirmationProps) {
  const {
    recipient_first_name,
    campaign_name,
    cta_url,
    cta_label,
    preview_text,
    body_paragraphs,
    unsubscribe_url,
  } = props;

  return (
    <Html lang="nb">
      <Head />
      <Preview>{preview_text}</Preview>
      <Body
        style={{
          fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
          backgroundColor: '#f5f5f5',
          margin: 0,
          padding: '24px 0',
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: 32,
          }}
        >
          <Heading as="h1" style={{ fontSize: 24, margin: '0 0 16px' }}>
            Hei {recipient_first_name},
          </Heading>
          <Text style={{ fontSize: 16, lineHeight: '1.5', margin: '0 0 16px' }}>
            Takk for at du meldte deg på <strong>{campaign_name}</strong>.
          </Text>
          {body_paragraphs.slice(0, 3).map((p, i) => (
            <Text key={i} style={{ fontSize: 16, lineHeight: '1.5', margin: '0 0 16px' }}>
              {p}
            </Text>
          ))}
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={cta_url}
              style={{
                backgroundColor: '#0F172A',
                color: '#ffffff',
                padding: '14px 28px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {cta_label}
            </Button>
          </Section>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 32 }}>
            Vil ikke høre fra oss?{' '}
            <a href={unsubscribe_url} style={{ color: '#666' }}>
              Avmeld
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
