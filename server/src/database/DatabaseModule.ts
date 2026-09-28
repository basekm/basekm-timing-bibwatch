import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/ConfigModule';
import { ConfigService } from '../config/ConfigService';

import { DatabaseWriter } from './DatabaseWriter';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        if (!configService.DatabaseSQLiteFile) {
          throw new Error('MEDIA_FOLDER is not set: the folder with the videos (see server/.env.example)');
        }
        return {
          type: 'better-sqlite3',
          database: configService.DatabaseSQLiteFile,
          autoLoadEntities: true,
          synchronize: true,
          enableWAL: true,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [DatabaseWriter],
  exports: [DatabaseWriter],
})
export class DatabaseModule {}
