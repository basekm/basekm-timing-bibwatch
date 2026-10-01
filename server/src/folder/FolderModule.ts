import { Global, Module } from '@nestjs/common';

import { FolderController } from './FolderController';
import { FolderService } from './FolderService';

@Global()
@Module({
  controllers: [FolderController],
  providers: [FolderService],
  exports: [FolderService],
})
export class FolderModule {}
