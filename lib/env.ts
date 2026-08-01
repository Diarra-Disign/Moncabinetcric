import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Add other environment variables here later
});

export const env = envSchema.parse(process.env);
