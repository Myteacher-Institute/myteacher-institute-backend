<<<<<<< HEAD

import { Body, Container, Head, Html, Img, Preview, Tailwind, Section, Text } from "react-email"

type VerifyAccountEmailT = {
    previewText: string
    logo_url: string
    username: string
    code?: string
}

const VerifyAccountEmail = ({
    previewText,
    logo_url,
    username,
    code = "65664646"
}: VerifyAccountEmailT) => {
    const codeDigits = code.split('')

    return (
        <Html>
            <Head />
            <Tailwind>
                <Body className="mx-auto my-auto bg-gradient-to-br from-slate-50 to-slate-100 px-2 font-sans">
                    <Preview>{previewText}</Preview>
                    <Container className="mx-auto my-[40px] max-w-[465px] rounded-lg bg-white shadow-lg overflow-hidden">

                        {/* Header with gradient background */}
                        <Section className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-8">
                            <Img
                                src={logo_url}
                                alt="Logo"
                                width="48"
                                height="48"
                                className="mx-auto"
                            />
                        </Section>

                        {/* Main content */}
                        <Section className="px-6 py-8">
                            <Text className="text-center text-3xl font-bold text-gray-900 mb-2">
                                Verify Your Account
                            </Text>

                            <Text className="text-center text-gray-500 text-sm mb-6">
                                Hello {username},
                            </Text>

                            <div className="flex flex-col gap-3 items-center ">
                                <Text className="text-gray-600 text-center text-sm leading-relaxed mb-8">
                                    This is your verification account code. Enter the code below to verify your account and get started.
                                </Text>

                                {/* Code input fields */}
                                <Section className="flex justify-center gap-5 mb-8">
                                    {codeDigits.map((digit, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '8px',
                                                fontSize: '24px',
                                                fontWeight: '600',
                                            }}
                                        >
                                            {digit}
                                        </div>
                                    ))}
                                </Section>
                            </div>

                            <Text className="text-center text-xs text-gray-500">
                                This code will expire in 10 minutes
                            </Text>
                        </Section>
                    </Container>

                    {/* Footer */}
                    <Section className="text-center mt-6">
                        <Text className="text-xs text-gray-500">
                            © 2025 My Teacher Institute. All rights reserved.
                        </Text>
                    </Section>
                </Body>
            </Tailwind>
        </Html>
    )
}

VerifyAccountEmail.PreviewProps = {
    previewText: "Verify your account with your 6-digit code",
    logo_url: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png",
    username: "John Doe",
    code: "123456"
} as VerifyAccountEmailT

export default VerifyAccountEmail
=======
import { Body, Container, Head, Html, Img, Preview, Tailwind, Section, Text } from 'react-email';

type VerifyAccountEmailT = {
  previewText: string;
  logo_url: string;
  code?: string;
};

const VerifyAccountEmail = ({
  previewText,
  logo_url,

  code = '65664646',
}: VerifyAccountEmailT) => {
  const codeDigits = code.split('');

  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="mx-auto my-auto bg-gradient-to-br from-slate-50 to-slate-100 px-2 font-sans">
          <Preview>{previewText}</Preview>
          <Container className="mx-auto my-[40px] max-w-[465px] rounded-lg bg-white shadow-lg overflow-hidden">
            {/* Header with gradient background */}
            <Section className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-8">
              <Img src={logo_url} alt="Logo" width="48" height="48" className="mx-auto" />
            </Section>

            {/* Main content */}
            <Section className="px-6 py-8">
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: '30px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: '0 0 8px',
                }}
              >
                Verify Your Account
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
                This is your verification account code. Enter the code below to verify your account
                and get started.
              </Text>

              {/* Digit cells — table is the only reliable centering primitive in email */}
              <table cellPadding="0" cellSpacing="0" border={0} width="100%">
                <tbody>
                  <tr>
                    <td align="center">
                      <table cellPadding="0" cellSpacing="0" border={0}>
                        <tbody>
                          <tr>
                            {codeDigits.map((digit, index) => (
                              <td
                                key={index}
                                style={{
                                  padding: '0 6px',
                                  fontSize: '24px',
                                  fontWeight: '600',
                                  color: '#111827',
                                }}
                              >
                                {digit}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          </Container>

          {/* Footer */}
          <Section className="text-center mt-6">
            <Text className="text-xs text-gray-500">
              © 2025 My Teacher Institute. All rights reserved.
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
};

VerifyAccountEmail.PreviewProps = {
  previewText: 'Verify your account with your 6-digit code',
  logo_url:
    'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png',
  username: 'John Doe',
  code: '123456',
} as VerifyAccountEmailT;

export default VerifyAccountEmail;
>>>>>>> messiah/feat-auth-polish
