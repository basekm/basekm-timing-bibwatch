import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { VideoEntity } from './VideoEntity';

/**
 * One of your own tags (finisher, photo, …) on a sighting.
 * Keyed by sighting key rather than sighting id: sightings are replaced on every re-sync,
 * and the key (bib@from) is what stays the same.
 */
@Entity('sighting_tags')
@Index('idx_sighting_tag_video_key', ['videoId', 'sightingKey'])
export class SightingTagEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'video_id' })
  videoId: number;

  @Column({ name: 'sighting_key' })
  sightingKey: string;

  @Column()
  tag: string;

  // relationships
  @ManyToOne(() => VideoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: VideoEntity;
}
