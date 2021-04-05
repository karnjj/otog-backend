import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { Op } from 'sequelize';
import { Status, SUBMISSION_REPOSITORY } from 'src/core/constants';
import {
  scodeFileFilter,
  scodeFileSizeFilter,
} from 'src/utils/fileUpload.utils';
import { Submission } from '../../entities/submission.entity';
import { UserDTO } from '../user/dto/user.dto';
import { UploadFileDTO } from './dto/submission.dto';

const fileExt = {
  c: '.c',
  cpp: '.cpp',
};

@Injectable()
export class SubmissionService {
  constructor(
    @Inject(SUBMISSION_REPOSITORY)
    private submissionRepository: typeof Submission,
  ) {}

  findAllWithOutContest(offset: number, limit: number): Promise<Submission[]> {
    return this.submissionRepository.scope('full').findAll({
      where: {
        contestId: null,
        id: {
          [Op.lt]: offset || 1e9,
        },
      },
      limit: limit || 89,
    });
  }

  findAllWithContest(): Promise<Submission[]> {
    return this.submissionRepository.scope('full').findAll({
      where: {
        contestId: {
          [Op.not]: null,
        },
      },
      limit: 100,
    });
  }

  async findOneByResultId(resultId: number) {
    return await this.submissionRepository.scope('full').findOne({
      where: { id: resultId },
      attributes: {
        include: ['sourceCode'],
      },
    });
  }

  async readLatestSourceCode(
    problemId: number,
    userId: number,
    language: string,
  ) {
    const filename = `${problemId}${fileExt[language]}`;
    const dir = `./upload/${userId}`;
    let sourceCode: string;
    try {
      sourceCode = readFileSync(`${dir}/${filename}`).toString();
    } catch {
      sourceCode = `ENOENT: no such file or directory.`;
    }
    return sourceCode;
  }

  fileCheck(file: Express.Multer.File) {
    // check file extension
    if (!scodeFileFilter(file))
      throw new BadRequestException('Only C C++ and Python are allowed!');
    // check file size
    if (!scodeFileSizeFilter(file))
      throw new BadRequestException('File is too large!');
  }

  async create(
    user: UserDTO,
    problemId: number,
    data: UploadFileDTO,
    file: Express.Multer.File,
  ) {
    this.fileCheck(file);
    const submission = new Submission();
    submission.userId = user?.id;
    submission.problemId = problemId;
    submission.language = data.language;
    submission.status = Status.Waiting;
    submission.contestId = Number(data.contestId) || null;
    submission.sourceCode = file.buffer.toString();
    await submission.save();
    return { msg: 'create submission complete.' };
  }

  findAllByUserId(userId: number): Promise<Submission[]> {
    return this.submissionRepository.scope('full').findAll({
      where: { userId },
    });
  }

  findOneByUserId(userId: number): Promise<Submission> {
    return this.submissionRepository.scope('full').findOne({
      where: { userId },
      attributes: {
        include: ['sourceCode'],
      },
    });
  }
}
