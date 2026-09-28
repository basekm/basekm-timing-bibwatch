import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ConfigService } from './ConfigService';

const paths = {
  development: ['.env', '.env.local', '.env.development'],
  production: ['.env.production'],
};

const envPath = paths[process.env.NODE_ENV] || paths.development;

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: envPath,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
