import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SightingEntity } from './SightingEntity';

export type ManualRead = { bib: string; t: number; box: [number, number, number, number] };

@Entity('videos')
export class VideoEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
    comment: 'Path inside the media folder, as the viewer and the API name it (e.g. GX011760.MP4).',
  })
  name: string;

  @Column({ type: 'real', nullable: true })
  duration: number | null;

  @Column({
    name: 'clock_offset',
    type: 'real',
    nullable: true,
    comment: 'Reader time (seconds since midnight) at video 0:00. Reader time of any moment = clock_offset + video time.',
  })
  clockOffset: number | null;

  @Column({
    name: 'tag_codes',
    type: 'simple-json',
    nullable: true,
    comment: 'Codes of your own typed tags for this video (tag → "104", …); presets 100-103 are fixed.',
  })
  tagCodes: Record<string, string> | null;

  @Column({
    name: 'manual_reads',
    type: 'simple-json',
    nullable: true,
    comment: 'Bibs you added by clicking a person on the video: [{ bib, t, box }]. Merged into the scan like any read.',
  })
  manualReads: ManualRead[] | null;

  @Column({
    name: 'sightings_updated_at',
    type: 'datetime',
    nullable: true,
    comment: 'When the sightings were last replaced (by a finished scan or a viewer re-sync).',
  })
  sightingsUpdatedAt: Date | null;

  @Column({
    name: 'tags_imported_at',
    type: 'datetime',
    nullable: true,
    comment: 'When scans/<video>/tags.json was copied in; after that the database is the only copy that changes.',
  })
  tagsImportedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // relationships
  @OneToMany(() => SightingEntity, (sighting) => sighting.video)
  sightings: SightingEntity[];
}
