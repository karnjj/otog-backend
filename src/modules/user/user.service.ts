import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { sha256 } from 'js-sha256';
import { Role } from 'src/core/constants';
import { userList } from 'src/utils';
import { CreateUserDTO } from '../auth/dto/auth.dto';
import { UpdateUserDTO } from './dto/user.dto';
import { PrismaService } from 'src/core/database/prisma.service';
import { ContestMode } from '@prisma/client';

export const WITHOUT_PASSWORD = {
  id: true,
  username: true,
  showName: true,
  role: true,
  rating: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserDTO) {
    const userNameExists = await this.findOneByUsername(data.username);
    if (userNameExists) {
      throw new ConflictException('username was taken.');
    }
    const showNameExists = await this.findOneByShowName(data.showName);
    if (showNameExists) {
      throw new ConflictException('showName was taken.');
    }
    const hash = sha256.create();
    hash.update(data.password);
    try {
      await this.prisma.user.create({
        data: {
          username: data.username,
          password: hash.hex(),
          showName: data.showName,
          role: Role.User,
        },
      });
    } catch {
      throw new BadRequestException();
    }
    return { message: 'Create user complete.', status: true };
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'desc' },
      select: WITHOUT_PASSWORD,
    });
  }

  async findOneByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      select: WITHOUT_PASSWORD,
    });
  }

  async findOneById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: WITHOUT_PASSWORD,
    });
  }

  async findOneByShowName(showName: string) {
    return this.prisma.user.findUnique({
      where: { showName },
      select: WITHOUT_PASSWORD,
    });
  }

  async updateShowNameById(showName: string, id: number) {
    const showNameExists = await this.findOneByShowName(showName);
    if (showNameExists) {
      throw new ConflictException('showName was taken.');
    }
    return this.prisma.user.update({
      where: { id },
      data: { showName },
      select: WITHOUT_PASSWORD,
    });
  }

  async getUserProfileById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...WITHOUT_PASSWORD,
        userContest: {
          select: {
            contest: true,
            rank: true,
            ratingAfterUpdate: true,
          },
          where: { rank: { not: null }, contest: { mode: ContestMode.rated } },
        },
      },
    });
  }

  async onlineUser() {
    const checkList = new Map();
    const onlineUser = Array.from(userList.values());
    return onlineUser.filter((user) => {
      if (checkList.get(user.id)) return false;
      checkList.set(user.id, true);
      return true;
    });
  }

  async updateUser(userId: number, userData: UpdateUserDTO) {
    if (userData.password) {
      const hash = sha256.create();
      hash.update(userData.password);
      return this.prisma.user.update({
        where: { id: userId },
        data: { password: hash.hex() },
      });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: userData,
    });
  }
}
