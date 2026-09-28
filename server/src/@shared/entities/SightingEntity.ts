import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { VideoEntity } from './VideoEntity';

/**
 * One bib seen in one video, as last decided (by the scanner, or by the viewer after a re-sync).
 * Replaced as a whole per video; your own tags live in sighting_tags, keyed by `sightingKey`.
 */
@Entity('sightings')
// "Where was this bib seen, in any video" — the query this table exists for.
@Index('idx_sighting_bib', ['bib'])
@Index('idx_sighting_video', ['videoId'])
export class SightingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'video_id' })
  videoId: number;

  @Column()
  bib: string;

  @Column({
    name: 'sighting_key',
    comment: 'bib@from (e.g. 0227@24.0): how the viewer keys your tags on this sighting.',
  })
  sightingKey: string;

  @Column({ name: 'from_time', type: 'real', comment: 'Video seconds when the bib was first read.' })
  fromTime: number;

  @Column({ name: 'to_time', type: 'real', comment: 'Video seconds when the bib was last read.' })
  toTime: number;

  @Column({
    name: 'cross_time',
    type: 'real',
    nullable: true,
    comment: 'Video seconds when the runner crossed the mat (interpolated); null when no crossing was decided.',
  })
  crossTime: number | null;

  @Column({ comment: 'crossed | viewed | near-mat | passing | camera-moving | duplicate | needs-scan' })
  label: string;

  @Column({ type: 'varchar', nullable: true, comment: 'background | before-mat | on-mat | past-mat' })
  zone: string | null;

  @Column({ type: 'varchar', nullable: true, comment: 'toward | away | still' })
  direction: string | null;

  @Column({ type: 'varchar', nullable: true, comment: 'Name of the bib template (design) that read it.' })
  template: string | null;

  @Column({ default: false })
  target: boolean;

  @Column({ type: 'boolean', nullable: true, comment: 'In the race participant list (registered.txt); null when there is no list.' })
  registered: boolean | null;

  @Column({ default: 0 })
  reads: number;

  @Column({ default: '' })
  note: string;

  // relationships
  @ManyToOne(() => VideoEntity, (video) => video.sightings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: VideoEntity;
}
