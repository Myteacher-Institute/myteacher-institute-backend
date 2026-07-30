import { Body, Container, Head, Html, Img, Preview, Tailwind, Section, Text } from "react-email"

type PasswordResetCodeEmailT = {
    previewText: string
    logo_url: string
    username: string
    code?: string
}

const PasswordResetCodeEmail = ({
    previewText,
    logo_url,
    username,
    code = "65664646"
}: PasswordResetCodeEmailT) => {
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
                                Password Reset Code
                            </Text>

                            <Text className="text-center text-gray-500 text-sm mb-6">
                                Hello {username},
                            </Text>

                            <div className="flex flex-col gap-3 items-center ">
                                <Text className="text-gray-600 text-center text-sm leading-relaxed mb-8">
                                    You have requested to reset your password. Use the following code to reset your password.
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

PasswordResetCodeEmail.PreviewProps = {
    previewText: "Your password reset code",
    logo_url: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png",
    username: "John Doe",
    code: "123456"
} as PasswordResetCodeEmailT

export default PasswordResetCodeEmail
