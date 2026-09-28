import { Module } from '@nestjs/common';

import { BibwatchService } from './BibwatchService';

@Module({
  providers: [BibwatchService],
  exports: [BibwatchService],
})
export class BibwatchModule {}
