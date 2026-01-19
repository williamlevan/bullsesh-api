import path from 'node:path';
import type { PrismaConfig } from 'prisma';

export default {
  schema: path.join(__dirname, 'schema.prisma'),

  migrate: {
    async adapter() {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { Pool } = await import('pg');
      const url = process.env.DATABASE_URL;
      const pool = new Pool({ connectionString: url });
      return new PrismaPg(pool);
    },
  },
} satisfies PrismaConfig;
