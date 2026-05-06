import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface NurtureEmailProps {
  recipient_first_name: string;
  campaign_name: string;
  preview_text: string;
  hook_paragraph: string;
  value_paragraphs: string[];
  cta_url: string;
  cta_label: string;
  social_proof?: { quote: string; author: string };
  unsubscribe_url: string;
}

export function NurtureEmail(props: NurtureEmailProps) {
  const {
    recipient_first_name,
    campaign_name,
    preview_text,
    hook_paragraph,
    value_paragraphs,
    cta_url,
    cta_label,
    social_proof,
    unsubscribe_url,
  } = props;

  return (
    <Html lang="nb">
      <Head />
      <Preview>{preview_text}</Preview>
      <Body
        style={{
          fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
          backgroundColor: '#fafafa',
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
          <Heading as="h1" style={{ fontSize: 22, margin: '0 0 16px' }}>
            Hei {recipient_first_name},
          </Heading>
          <Text style={{ fontSize: 17, lineHeight: '1.5', margin: '0 0 20px' }}>
            {hook_paragraph}
          </Text>
          {value_paragraphs.slice(0, 4).map((p, i) => (
            <Text key={i} style={{ fontSize: 16, lineHeight: '1.55', margin: '0 0 16px' }}>
              {p}
            </Text>
          ))}
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
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
          {social_proof && (
            <>
              <Hr style={{ margin: '32px 0', borderColor: '#e5e5e5' }} />
              <Text
                style={{
                  fontSize: 15,
                  fontStyle: 'italic',
                  color: '#444',
                  margin: '0 0 8px',
                  borderLeft: '3px solid #0F172A',
                  paddingLeft: 16,
                }}
              >
                "{social_proof.quote}"
              </Text>
              <Text style={{ fontSize: 14, color: '#666', margin: '0 0 16px', paddingLeft: 16 }}>
                — {social_proof.author}
              </Text>
            </>
          )}
          <Text style={{ fontSize: 12, color: '#888', marginTop: 32 }}>
            Sendt fra kampanje <em>{campaign_name}</em>.{' '}
            <a href={unsubscribe_url} style={{ color: '#888' }}>
              Avmeld
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
