import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { SightingTagEntity } from '../@shared/entities/SightingTagEntity';
import { DatabaseWriter } from '../database/DatabaseWriter';
import { VideoService } from '../videos/VideoService';

/**
 * Your own tags, in the shape the viewer keeps them:
 * `{ "0227@24.0": ["finisher"], …, "__codes": { "spectator": "104" } }`.
 */
export type VideoTags = Record<string, string[]> & { __codes?: Record<string, string> };

const CODES_KEY = '__codes';

@Injectable()
export class TagService {
  constructor(
    private readonly databaseWriter: DatabaseWriter,
    @InjectRepository(SightingTagEntity)
    private readonly sightingTagRepository: Repository<SightingTagEntity>,
    private readonly videoService: VideoService,
  ) {}

  async getTags(videoName: string): Promise<VideoTags> {
    const video = await this.videoService.getByName(videoName);
    if (!video) {
      return {};
    }

    const tags: VideoTags = {};
    const rows = await this.sightingTagRepository.find({ where: { videoId: video.id }, order: { id: 'ASC' } });
    for (const row of rows) {
      (tags[row.sightingKey] ??= []).push(row.tag);
    }
    if (video.tagCodes && Object.keys(video.tagCodes).length) {
      tags[CODES_KEY] = video.tagCodes;
    }
    return tags;
  }

  /** Replace all of this video's tags (the viewer always sends the whole set). */
  saveTags(videoName: string, tags: VideoTags) {
    const rows = Object.entries(tags as Record<string, unknown>)
      .filter((entry): entry is [string, unknown[]] => entry[0] !== CODES_KEY && Array.isArray(entry[1]))
      .flatMap(([sightingKey, list]) => [...new Set(list.map(String))].map((tag) => [sightingKey, tag]));
    const codes = tags[CODES_KEY];
    const tagCodes = codes && typeof codes === 'object' && !Array.isArray(codes) ? JSON.stringify(codes) : null;

    this.databaseWriter.transaction((db) => {
      const videoId = this.databaseWriter.videoIdOf(db, videoName);

      db.prepare('DELETE FROM sighting_tags WHERE video_id = ?').run(videoId);
      const insert = db.prepare('INSERT INTO sighting_tags (video_id, sighting_key, tag) VALUES (?, ?, ?)');
      for (const [sightingKey, tag] of rows) {
        insert.run(videoId, sightingKey, tag);
      }

      // Once tags are saved here, an old tags.json must never be copied over them.
      db.prepare(`
        UPDATE videos SET tag_codes = ?, tags_imported_at = COALESCE(tags_imported_at, ?),
          updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
        WHERE id = ?`,
      ).run(tagCodes, this.databaseWriter.toDatetime(new Date()), videoId);
    });

    return { saved: true };
  }
}
