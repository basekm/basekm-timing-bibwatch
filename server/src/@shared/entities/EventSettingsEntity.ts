import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Settings for the event this media folder holds (one row; the database lives in the media folder).
 * Bib rules apply to every scan of every video of the event.
 */
@Entity('event_settings')
export class EventSettingsEntity {
  /** Always 1: one event per media folder. */
  @PrimaryColumn()
  id: number;

  @Column({ name: 'min_digits', default: 4, comment: 'Fewest digits a bib number has (races can mix lengths).' })
  minDigits: number;

  @Column({ name: 'max_digits', default: 4, comment: 'Most digits a bib number has.' })
  maxDigits: number;

  @Column({ name: 'min_bib', type: 'integer', nullable: true, comment: 'Lowest bib number; null = 1.' })
  minBib: number | null;

  @Column({
    name: 'max_bib',
    type: 'integer',
    nullable: true,
    comment: 'Highest bib number; null = the highest in registered.txt, else the largest with max_digits digits.',
  })
  maxBib: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
