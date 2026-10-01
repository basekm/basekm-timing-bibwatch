import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseWriter } from './DatabaseWriter';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      // Each folder has its own bibwatch.sqlite; FolderService switches to it when the folder is
      // opened. Until then the database is an empty one in memory.
      useFactory: () => ({
        type: 'better-sqlite3',
        database: ':memory:',
        autoLoadEntities: true,
        synchronize: true,
        enableWAL: true,
      }),
    }),
  ],
  providers: [DatabaseWriter],
  exports: [DatabaseWriter],
})
export class DatabaseModule {}
