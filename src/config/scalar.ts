import { apiReference } from '@scalar/express-api-reference';
import { type Express } from 'express';
import logger from '../utils';

export const configureScalarDocs = (app: Express): void => {


  const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? "http://localhost:3000"
  const NODE_ENV = process.env.NODE_ENV ?? "production"
  const serverDescription = NODE_ENV.includes("prod") ? "Production Server" : "Development Server"

  app.use(
    '/api/docs',
    apiReference({
      content: {
        openapi: '3.0.0',
        info: {
          title: 'MyTeacher Institute API',
          version: '1.0.0',
          description: 'API documentation for MyTeacher Institute Backend - Authentication System',

        },
        servers: [
          {
            url: BACKEND_BASE_URL,
            description: serverDescription
          },
        ],
        paths: {
          '/api/auth/initiate': {
            post: {
              tags: ['Authentication'],
              summary: 'Initiate authentication process',
              description:
                'Starts the authentication flow by checking if user exists and determining next steps (password or OTP)',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email'],
                      properties: {
                        email: {
                          type: 'string',
                          format: 'email',
                          description: 'User email address',
                          example: 'user@example.com',
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Authentication initiated successfully',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          {
                            type: 'object',
                            properties: {
                              status: { type: 'string', enum: ['success'] },
                              instruction: { type: 'string', enum: ['give-password'] },
                              message: { type: 'string' },
                            },
                            example: {
                              status: 'success',
                              instruction: 'give-password',
                              message: 'User onboarded, password required',
                            },
                          },
                          {
                            type: 'object',
                            properties: {
                              status: { type: 'string', enum: ['success'] },
                              instruction: { type: 'string', enum: ['give-code'] },
                              message: { type: 'string' },
                            },
                            example: {
                              status: 'success',
                              instruction: 'give-code',
                              message:
                                'An OTP code has been sent to your email. Please verify to continue.',
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                '400': {
                  description: 'Invalid input',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          errorOnInput: { type: 'boolean' },
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          errorOnInput: true,
                          status: 'failed',
                          message: 'Email is required',
                        },
                      },
                    },
                  },
                },
                '429': {
                  description: 'Rate limited',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          errorOnInput: { type: 'boolean' },
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          errorOnInput: false,
                          status: 'failed',
                          message:
                            'Too many attempts. Please wait 15 minutes to request another code.',
                        },
                      },
                    },
                  },
                },
                '500': {
                  description: 'Internal server error',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          errorOnInput: { type: 'boolean' },
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          errorOnInput: false,
                          status: 'failed',
                          message: 'Internal server error',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/api/auth/verify-password': {
            post: {
              tags: ['Authentication'],
              summary: 'Verify user password',
              description:
                'Authenticates user with password and returns access token or sends OTP for new device',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email', 'password'],
                      properties: {
                        email: {
                          type: 'string',
                          format: 'email',
                          description: 'User email address',
                          example: 'user@example.com',
                        },
                        password: {
                          type: 'string',
                          minLength: 6,
                          description: 'User password (min 6 characters)',
                          example: 'password123',
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Password verified successfully',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          {
                            type: 'object',
                            properties: {
                              status: { type: 'string', enum: ['success'] },
                              isTrusted: { type: 'boolean', const: true },
                              message: { type: 'string' },
                              access_code: { type: 'string' },
                            },
                            example: {
                              status: 'success',
                              isTrusted: true,
                              message:
                                'Welcome back! You have successfully logged in to your account.',
                              access_code: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                            },
                          },
                          {
                            type: 'object',
                            properties: {
                              status: { type: 'string', enum: ['success'] },
                              isTrusted: { type: 'boolean', const: false },
                              isGiveCode: { type: 'boolean', const: true },
                              isCompleted: { type: 'boolean', const: false },
                              message: { type: 'string' },
                            },
                            example: {
                              status: 'success',
                              isTrusted: false,
                              isGiveCode: true,
                              isCompleted: false,
                              message:
                                'A verification code has been sent to your email. Please enter it to continue.',
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                '400': {
                  description: 'Invalid credentials or input',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          errorOnInput: { type: 'string', enum: ['email', 'password', false] },
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          errorOnInput: 'password',
                          status: 'failed',
                          message: 'The password you entered is incorrect. Please try again.',
                        },
                      },
                    },
                  },
                },
                '404': {
                  description: 'User not found or not onboarded',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          errorOnInput: { type: 'boolean' },
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          errorOnInput: false,
                          status: 'failed',
                          message: 'Wrong endpoint. Please contact support.',
                        },
                      },
                    },
                  },
                },
                '500': {
                  description: 'Internal server error',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          errorOnInput: { type: 'boolean' },
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          errorOnInput: false,
                          status: 'failed',
                          message: 'Something unexpected happened. Please try again.',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/api/auth/verify-otp': {
            post: {
              tags: ['Authentication'],
              summary: 'Verify OTP code',
              description: 'Verifies OTP code sent to user email and completes authentication',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['otp', 'email'],
                      properties: {
                        otp: {
                          type: 'string',
                          pattern: '^[0-9]{6}$',
                          description: '6-digit OTP code',
                          example: '123456',
                        },
                        email: {
                          type: 'string',
                          format: 'email',
                          description: 'User email address',
                          example: 'user@example.com',
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'OTP verified successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['success'] },
                          message: { type: 'string' },
                          authUser: {
                            type: 'object',
                            properties: {
                              _id: { type: 'string' },
                              email: { type: 'string' },
                              hasOnboarded: { type: 'boolean' },
                              createdAt: { type: 'string', format: 'date-time' },
                              updatedAt: { type: 'string', format: 'date-time' },
                            },
                          },
                          accessToken: { type: 'string' },
                        },
                        example: {
                          status: 'success',
                          message: 'OTP verified successfully',
                          authUser: {
                            _id: '64a1b2c3d4e5f6789012345',
                            email: 'user@example.com',
                            hasOnboarded: true,
                            createdAt: '2023-07-01T12:00:00.000Z',
                            updatedAt: '2023-07-01T12:00:00.000Z',
                          },
                          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                        },
                      },
                    },
                  },
                },
                '400': {
                  description: 'Invalid OTP or input',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message: 'Invalid or expired OTP code',
                        },
                      },
                    },
                  },
                },
                '500': {
                  description: 'Internal server error',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message: 'Internal server error',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/api/auth/new-access-code': {
            get: {
              tags: ['Authentication'],
              summary: 'Get new access token',
              description: 'Generates a new access token using refresh token from cookie',
              security: [
                {
                  bearerAuth: [],
                },
              ],
              responses: {
                '200': {
                  description: 'New access token generated',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          type: { type: 'string', enum: ['success'] },
                          message: { type: 'string' },
                          accessToken: { type: 'string' },
                        },
                        example: {
                          type: 'success',
                          message: 'Access token generated successfully',
                          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                        },
                      },
                    },
                  },
                },
                '401': {
                  description: 'No refresh token provided',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          type: { type: 'string', enum: ['no-refresh'] },
                          message: { type: 'string' },
                        },
                        example: {
                          type: 'no-refresh',
                          message: 'No refresh token provided',
                        },
                      },
                    },
                  },
                },
                '403': {
                  description: 'Invalid refresh token',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          type: { type: 'string', enum: ['invalid-refresh'] },
                          message: { type: 'string' },
                        },
                        example: {
                          type: 'invalid-refresh',
                          message: 'Invalid refresh token',
                        },
                      },
                    },
                  },
                },
                '500': {
                  description: 'Server error',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          type: { type: 'string', enum: ['server-error'] },
                          message: { type: 'string' },
                        },
                        example: {
                          type: 'server-error',
                          message: 'Failed to generate access token',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/api/auth/request-reset-account-instructions': {
            post: {
              tags: ['Authentication'],
              summary: 'Request password reset instructions',
              description: 'Sends password reset link to user email',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email'],
                      properties: {
                        email: {
                          type: 'string',
                          format: 'email',
                          description: 'User email address',
                          example: 'user@example.com',
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Reset instructions sent successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['success'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'success',
                          message: 'Password reset instructions have been sent to your email',
                        },
                      },
                    },
                  },
                },
                '400': {
                  description: 'Invalid input',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message: 'Email is required',
                        },
                      },
                    },
                  },
                },
                '404': {
                  description: 'User not found',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message: 'User not found',
                        },
                      },
                    },
                  },
                },
                '429': {
                  description: 'Rate limited',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message: 'Too many reset attempts. Please try again later.',
                        },
                      },
                    },
                  },
                },
                '500': {
                  description: 'Internal server error',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message: 'Failed to send reset instructions',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/api/auth/reset-password-with-code': {
            post: {
              tags: ['Authentication'],
              summary: 'Reset password with code',
              description: 'Resets user password using reset code and optional device logout',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['code', 'password', 'confirmPassword'],
                      properties: {
                        code: {
                          type: 'string',
                          description: '6-digit reset code sent to email',
                          example: '123456',
                        },
                        password: {
                          type: 'string',
                          minLength: 6,
                          description: 'New password (min 6 characters)',
                          example: 'newPassword123',
                        },
                        confirmPassword: {
                          type: 'string',
                          description: 'Password confirmation',
                          example: 'newPassword123',
                        },
                        logoutAllDevices: {
                          type: 'boolean',
                          description: 'Whether to logout all devices after password reset',
                          example: false,
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Password reset successful',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['success'] },
                          message: { type: 'string' },
                        },
                        examples: {
                          'with logout': {
                            summary: 'Success with device logout',
                            value: {
                              status: 'success',
                              message:
                                'Password has been reset successfully and all devices have been logged out',
                            },
                          },
                          'without logout': {
                            summary: 'Success without device logout',
                            value: {
                              status: 'success',
                              message: 'Password has been reset successfully',
                            },
                          },
                        },
                      },
                    },
                  },
                },
                '400': {
                  description: 'Invalid input or validation error',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        examples: {
                          'missing code': {
                            summary: 'Reset code required',
                            value: {
                              status: 'failed',
                              message: 'Reset code is required',
                            },
                          },
                          'password too short': {
                            summary: 'Password too short',
                            value: {
                              status: 'failed',
                              message: 'Password must be at least 6 characters long',
                            },
                          },
                          'passwords mismatch': {
                            summary: 'Passwords do not match',
                            value: {
                              status: 'failed',
                              message: 'Passwords do not match',
                            },
                          },
                          'invalid code': {
                            summary: 'Invalid reset code',
                            value: {
                              status: 'failed',
                              message: 'Invalid or expired reset code',
                            },
                          },
                        },
                      },
                    },
                  },
                },
                '403': {
                  description: 'Account not onboarded',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message:
                            'This feature is not available for your account. Please complete account setup first.',
                        },
                      },
                    },
                  },
                },
                '404': {
                  description: 'User not found',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message: 'User not found',
                        },
                      },
                    },
                  },
                },
                '500': {
                  description: 'Internal server error',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['failed'] },
                          message: { type: 'string' },
                        },
                        example: {
                          status: 'failed',
                          message: 'Internal server error',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT access token obtained from authentication endpoints',
            },
          },
        },
      },
      theme: 'default',
      customCss: `
      .scalar-content { 
        padding: 2rem; 
      }
    `,
      metaData: {
        title: 'MyTeacher Institute API Documentation',
        description:
          'Complete API documentation for MyTeacher Institute Backend Authentication System',
        ogImage: '/assets/logo.png',
      },
      favicon: '/assets/logo.png',
    })
  );
  const apiDocsUrl = `${process.env.BACKEND_BASE_URL}/api/docs`
  logger.info(`Documentation ---> ${apiDocsUrl}`)
};
