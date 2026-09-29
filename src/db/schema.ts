import { mysqlTable, varchar, text } from 'drizzle-orm/mysql-core';

export const vendors = mysqlTable('vendors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  website: varchar('website', { length: 255 }),
  description: text('description'),
});
