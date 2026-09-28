import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { BetterSqlite3Driver } from 'typeorm/driver/better-sqlite3/BetterSqlite3Driver';
import { DateUtils } from 'typeorm/util/DateUtils';

import { Database } from 'better-sqlite3';
import { DataSource } from 'typeorm';

/**
 * Bulk writes (replacing a video's sightings or tags) as one synchronous better-sqlite3 transaction.
 *
 * - Fast: prepared statements instead of TypeORM building each insert; 20,000 rows take milliseconds,
 *   so video streaming (same Node thread) is never held up by a save.
 * - Safe: nothing else runs until it returns (no `await` inside), so two saves can't interleave on
 *   TypeORM's single shared SQLite connection.
 *
 * Reads and small updates stay on TypeORM repositories.
 */
@Injectable()
export class DatabaseWriter {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  transaction<T>(work: (db: Database) => T): T {
    const db: Database = (this.dataSource.driver as BetterSqlite3Driver).databaseConnection;
    return db.transaction(() => work(db))();
  }

  /** The id of the video named `name`, creating its row if needed. Use inside `transaction`. */
  videoIdOf(db: Database, name: string): number {
    db.prepare('INSERT OR IGNORE INTO videos (name) VALUES (?)').run(name);
    return (db.prepare('SELECT id FROM videos WHERE name = ?').get(name) as { id: number }).id;
  }

  /** A date as TypeORM stores datetime columns in SQLite (UTC, milliseconds). */
  toDatetime(date: Date): string {
    return DateUtils.mixedDateToUtcDatetimeString(date);
  }
}
