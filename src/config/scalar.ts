import { apiReference } from '@scalar/express-api-reference';
import { type Express } from 'express';
import { loadOpenApiSpec } from './docs-loader';
import logger from '../utils';

export const configureScalarDocs = (app: Express): void => {
  const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:4000';
  const NODE_ENV = process.env.NODE_ENV ?? 'production';
  const serverDescription = NODE_ENV.includes('prod') ? 'Production Server' : 'Development Server';

  const spec = loadOpenApiSpec([{ url: BACKEND_BASE_URL, description: serverDescription }]);

  app.use(
    '/api/docs',
    apiReference({
      content: spec,
      theme: 'default',
      customCss: `
        .scalar-content {
          padding: 2rem;
        }
      `,
      metaData: {
        title: 'MyTeacher Institute API Documentation',
        description: 'Complete API documentation for MyTeacher Institute Backend',
        ogImage: '/assets/logo.png',
      },
      favicon: '/assets/logo.png',
    }),
  );

  logger.info(`Documentation ---> ${BACKEND_BASE_URL}/api/docs`);
};
