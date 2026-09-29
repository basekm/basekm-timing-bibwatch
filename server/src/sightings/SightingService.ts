import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';

import { currentSightingLabel, LegacySightingLabel, SightingAutoTag } from '../@shared/constants/SightingLabel';
import { SightingSearchQueryDto } from '../@shared/dto/SightingSearchQueryDto';
import { SightingDto } from '../@shared/dto/SightingsSaveRequestDto';
import { SightingEntity } from '../@shared/entities/SightingEntity';
import { SightingTagEntity } from '../@shared/entities/SightingTagEntity';
import { VideoEntity } from '../@shared/entities/VideoEntity';
import { DatabaseWriter } from '../database/DatabaseWriter';
import { VideoService } from '../videos/VideoService';

/** How the viewer keys a sighting (sightingKey in web/src/@shared/utils/sightingTags.ts): bib@from, one decimal. */
export const sightingKeyOf = (sighting: { bib: string; from: number }) =>
  `${sighting.bib}@${sighting.from.toFixed(1)}`;

@Injectable()
export class SightingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly databaseWriter: DatabaseWriter,
    @InjectRepository(SightingEntity)
    private readonly sightingRepository: Repository<SightingEntity>,
    @InjectRepository(SightingTagEntity)
    private readonly sightingTagRepository: Repository<SightingTagEntity>,
    private readonly videoService: VideoService,
  ) {}

  /**
   * Replace every sighting of `videoName` in one transaction (a search never sees half a video).
   * `decidedAt` is when these sightings were decided: a finished scan's file time, or now for a re-sync.
   */
  replaceForVideo(
    videoName: string,
    sightings: SightingDto[],
    options: { duration?: number | null; decidedAt?: Date } = {},
  ) {
    this.databaseWriter.transaction((db) => {
      const videoId = this.databaseWriter.videoIdOf(db, videoName);

      db.prepare('DELETE FROM sightings WHERE video_id = ?').run(videoId);

      const insert = db.prepare(`
        INSERT INTO sightings (video_id, bib, sighting_key, from_time, to_time, cross_time, label,
          zone, direction, template, target, registered, reads, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const sighting of sightings) {
        insert.run(
          videoId,
          sighting.bib,
          sightingKeyOf(sighting),
          sighting.from,
          sighting.to,
          sighting.cross ?? null,
          sighting.label,
          sighting.zone ?? null,
          sighting.direction ?? null,
          sighting.template ?? null,
          sighting.target ? 1 : 0,
          sighting.registered == null ? null : sighting.registered ? 1 : 0,
          sighting.reads ?? 0,
          sighting.note ?? '',
        );
      }

      db.prepare(`
        UPDATE videos SET sightings_updated_at = ?, duration = COALESCE(?, duration),
          updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
        WHERE id = ?`,
      ).run(this.databaseWriter.toDatetime(options.decidedAt ?? new Date()), options.duration || null, videoId);
    });

    return { saved: sightings.length };
  }

  async deleteForVideo(videoName: string) {
    const video = await this.videoService.getByName(videoName);
    if (video) {
      await this.sightingRepository.delete({ videoId: video.id });
      await this.dataSource.getRepository(VideoEntity).update(video.id, { sightingsUpdatedAt: null });
    }
  }

  /** Every sighting matching the bib and/or tag, in every video, earliest reader time first. */
  async search(query: SightingSearchQueryDto) {
    const builder = this.sightingRepository
      .createQueryBuilder('sighting')
      .innerJoinAndSelect('sighting.video', 'video');

    const bibs = query.bibCandidates;
    if (bibs.length) {
      builder.andWhere('sighting.bib IN (:...bibs)', { bibs });
    }
    if (query.video) {
      builder.andWhere('video.name = :video', { video: query.video });
    }

    const tag = query.tag?.trim().toLowerCase();
    if (tag) {
      const matching = Object.entries(SightingAutoTag)
        .filter(([label, auto]) => label === tag || auto.code === tag || auto.name.toLowerCase() === tag)
        .map(([label]) => label);
      // Older scans stored e.g. "lingering" for what is now "near-mat".
      const legacy = Object.keys(LegacySightingLabel).filter((old) => matching.includes(LegacySightingLabel[old]));
      const labels = [...matching, ...legacy];
      const tagged = this.sightingTagRepository
        .createQueryBuilder('sightingTag')
        .select('1')
        .where('sightingTag.video_id = sighting.video_id')
        .andWhere('sightingTag.sighting_key = sighting.sighting_key')
        .andWhere('LOWER(sightingTag.tag) = :tag');
      builder.andWhere(
        labels.length
          ? `(sighting.label IN (:...labels) OR EXISTS (${tagged.getQuery()}))`
          : `EXISTS (${tagged.getQuery()})`,
        { labels, tag },
      );
    }

    const sightings = await builder.getMany();
    const tags = await this.getTagsOf(sightings);

    return sightings
      .map((sighting) => {
        const at = sighting.crossTime ?? sighting.fromTime;
        const label = currentSightingLabel(sighting.label);
        const auto = SightingAutoTag[label];

        return {
          video: sighting.video.name,
          bib: sighting.bib,
          key: sighting.sightingKey,
          from: sighting.fromTime,
          to: sighting.toTime,
          cross: sighting.crossTime,
          /** Video seconds to jump to: the crossing, else the first read. */
          at,
          /** Reader seconds since midnight, when the video's clock is set. */
          readerTime: sighting.video.clockOffset != null ? sighting.video.clockOffset + at : null,
          label,
          autoTag: auto ? `${auto.code} ${auto.name}` : label,
          zone: sighting.zone,
          direction: sighting.direction,
          template: sighting.template,
          target: sighting.target,
          registered: sighting.registered,
          tags: tags.get(`${sighting.videoId}|${sighting.sightingKey}`) ?? [],
        };
      })
      .sort((a, b) => (a.readerTime ?? Infinity) - (b.readerTime ?? Infinity) || a.video.localeCompare(b.video) || a.at - b.at);
  }

  private async getTagsOf(sightings: SightingEntity[]) {
    const videoIds = [...new Set(sightings.map((sighting) => sighting.videoId))];
    const byKey = new Map<string, string[]>();
    if (!videoIds.length) {
      return byKey;
    }

    const rows = await this.sightingTagRepository
      .createQueryBuilder('sightingTag')
      .where('sightingTag.video_id IN (:...videoIds)', { videoIds })
      .getMany();
    for (const row of rows) {
      const key = `${row.videoId}|${row.sightingKey}`;
      byKey.set(key, [...(byKey.get(key) ?? []), row.tag]);
    }
    return byKey;
  }
}
