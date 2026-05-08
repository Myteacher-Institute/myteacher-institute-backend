import { Body, Container, Head, Html, Img, Preview, Tailwind, Section, Text,  Link } from 'react-email';

type ResetPasswordEmailT = {
  previewText: string;
  logo_url: string;
  resetLink: string;
  title?: string;
  description?: string;
};

const ResetPasswordEmail = ({
  previewText,
  logo_url,
  resetLink,
  title = 'Reset Your Password',
  description = 'We received a request to reset your password. Click the button below to create a new password.',
}: ResetPasswordEmailT) => {

  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gradient-to-br from-slate-50 to-slate-100 px-2 font-sans" style={{ margin: '0 auto', padding: '20px 0' }}>
          <Preview>{previewText}</Preview>
          <Container className="max-w-[465px] rounded-lg bg-white shadow-lg overflow-hidden" style={{ margin: '40px auto', width: '100%', maxWidth: '465px' }}>
            {/* Header with gradient background */}
            <Section className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-8" align="center">
              <Img src={logo_url} alt="Logo" width="48" height="48" style={{ margin: '0 auto', display: 'block' }} />
            </Section>

            {/* Main content */}
            <Section className="px-6 py-8" align="center">
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: '30px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: '0 0 8px',
                }}
              >
                {title}
              </Text>

              <Text
                style={{
                  textAlign: 'center',
                  fontSize: '14px',
                  color: '#6B7280',
                  lineHeight: '1.6',
                  margin: '0 0 32px',
                }}
              >
                {description}
              </Text>

              <Text
                style={{
                  textAlign: 'center',
                  fontSize: '14px',
                  color: '#6B7280',
                  lineHeight: '1.6',
                  margin: '32px 0 24px',
                }}
              >
                This link will expire in 10 minutes.
              </Text>

              {/* Reset Button */}
              <Section align="center" style={{ textAlign: 'center' }}>
                <Link
                  href={resetLink}
                  style={{
                    backgroundColor: '#3B82F6',
                    borderRadius: '6px',
                    color: '#ffffff',
                    display: 'inline-block',
                    padding: '12px 24px',
                    textDecoration: 'none',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Reset Your Password
                </Link>
              </Section>
            </Section>

            {/* Footer */}
            <Section align="center" className="mt-6" style={{ textAlign: 'center' }}>
              <Text className="text-xs text-gray-500" style={{ textAlign: 'center' }}>
                2025 My Teacher Institute. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

ResetPasswordEmail.PreviewProps = {
  previewText: 'Password Reset Email',
  logo_url:
    'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png',

} as ResetPasswordEmailT;

export default ResetPasswordEmail;
