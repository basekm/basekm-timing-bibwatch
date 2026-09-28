import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { VideoEntity } from '../@shared/entities/VideoEntity';

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(VideoEntity)
    private readonly videoRepository: Repository<VideoEntity>,
  ) {}

  getByName(name: string) {
    return this.videoRepository.findOneBy({ name });
  }

  /** The video's row, created on first use. */
  async findOrCreate(name: string) {
    await this.videoRepository.createQueryBuilder().insert().values({ name }).orIgnore().execute();

    return this.videoRepository.findOneByOrFail({ name });
  }

  async setClock(name: string, clockOffset: number | null) {
    const video = await this.findOrCreate(name);
    await this.videoRepository.update(video.id, { clockOffset });

    return { video: name, clockOffset };
  }

  /** Reader time at video 0:00 for every video that has one: video name → seconds. */
  async getClocks() {
    const videos = await this.videoRepository.find({ select: { name: true, clockOffset: true } });

    return Object.fromEntries(
      videos.filter((video) => video.clockOffset != null).map((video) => [video.name, video.clockOffset]),
    );
  }
}
