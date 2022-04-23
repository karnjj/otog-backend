import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmissionService } from './submission.service';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  SubmissionDTO,
  SubmissionWithSourceCodeDTO,
  UploadFileDTO,
} from './dto/submission.dto';
import { RolesGuard } from 'src/core/guards/roles.guard';
import { Roles } from 'src/core/decorators/roles.decorator';
import { Role } from 'src/core/constants';
import { User } from 'src/core/decorators/user.decorator';
import { UserDTO } from '../user/dto/user.dto';
import { ContestService } from '../contest/contest.service';
import { OptionalIntPipe } from 'src/utils/optional.pipe';

@ApiTags('submission')
@Controller('submission')
@UseGuards(RolesGuard)
export class SubmissionController {
  constructor(
    private submissionService: SubmissionService,
    private contestService: ContestService,
  ) {}

  @Get()
  @ApiQuery({ name: 'offset', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiOkResponse({
    type: SubmissionDTO,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (numeric string is expected)',
  })
  getAllSubmission(
    @User() user: UserDTO,
    @Query('offset', OptionalIntPipe) offset?: number,
    @Query('limit', OptionalIntPipe) limit?: number,
  ) {
    return user.role === Role.Admin
      ? this.submissionService.findAll(offset, limit)
      : this.submissionService.findAllWithOutContestAndAdmin(offset, limit);
  }

  @Get('/contest')
  @ApiQuery({ name: 'offset', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiOkResponse({
    type: SubmissionDTO,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (numeric string is expected)',
  })
  getContestSubmission(
    @Query('offset', OptionalIntPipe) offset: number,
    @Query('limit', OptionalIntPipe) limit: number,
  ) {
    return this.submissionService.findAllWithContest(offset, limit);
  }

  @Roles(Role.Admin, Role.User)
  @Get('/problem/:problemId/latest')
  @ApiOkResponse({ type: SubmissionWithSourceCodeDTO })
  @ApiNotFoundResponse({ description: 'Submission for the problem not found' })
  @ApiNotFoundResponse({ description: 'Problem not found' })
  getLatestSubmissionByProblemId(
    @Param('problemId', ParseIntPipe) problemId: number,
    @User() user: UserDTO,
  ) {
    return this.submissionService.findOneByProblemIdAndUserId(
      problemId,
      user.id,
    );
  }

  @Roles(Role.User, Role.Admin)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileDTO })
  @Post('/problem/:problemId')
  @ApiCreatedResponse({ description: 'Submit successfully' })
  @ApiNotFoundResponse({ description: 'Problem not found' })
  @UseInterceptors(FileInterceptor('sourceCode'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Param('problemId', ParseIntPipe) problemId: number,
    @User() user: UserDTO,
    @Body() data: UploadFileDTO,
  ) {
    if (data.contestId) {
      await this.contestService.addUserToContest(data.contestId, user.id);
    }
    return this.submissionService.create(user, problemId, data, file);
  }

  @Roles(Role.User, Role.Admin)
  @Get('/latest')
  @ApiOkResponse({
    type: SubmissionDTO,
    description: 'Get the latest submission',
  })
  getLatestSubmissionWithUserId(@User() user: UserDTO) {
    return this.submissionService.findOneByUserId(user.id);
  }

  @Roles(Role.User, Role.Admin)
  @Get('/user/:userId')
  @ApiQuery({ name: 'offset', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiOkResponse({
    type: SubmissionDTO,
    isArray: true,
    description: 'Get some submissions from query',
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (numeric string is expected)',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiForbiddenResponse({
    description: 'User id must be the same as userId',
  })
  getAllSubmissionByUserId(
    @User() user: UserDTO,
    @Param('userId', ParseIntPipe) userId: number,
    @Query('offset', OptionalIntPipe) offset?: number,
    @Query('limit', OptionalIntPipe) limit?: number,
  ) {
    if (user.role === 'admin') {
      return this.submissionService.findAllByUserId(userId, offset, limit);
    }
    if (user.id === userId) {
      return this.submissionService.findAllByUserIdWithOutContest(
        userId,
        offset,
        limit,
      );
    }
    throw new ForbiddenException();
  }

  @Roles(Role.User, Role.Admin)
  @Get('/:resultId')
  @ApiOkResponse({
    type: SubmissionWithSourceCodeDTO,
    description: 'Get submission by id',
  })
  @ApiNotFoundResponse({ description: 'Submission not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async getSubmissionById(
    @Param('resultId', ParseIntPipe) resultId: number,
    @User() user: UserDTO,
  ) {
    const submission = await this.submissionService.findOneByResultId(resultId);
    if (!submission) throw new NotFoundException();

    if (submission.user.id !== user.id && user.role !== Role.Admin)
      throw new ForbiddenException();

    return submission;
  }
}
