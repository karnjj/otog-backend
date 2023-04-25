import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { sha256 } from 'js-sha256';
import { REFRESHTOKEN_REPOSITORY } from 'src/core/constants';
import { RefreshToken } from 'src/entities/refreshToken.entity';
import { v4 as uuidv4 } from 'uuid';
import { UserDTO } from '../user/dto/user.dto';
import { UserService } from '../user/user.service';
import { CreateUserDTO } from './dto/auth.dto';
@Injectable()
export class AuthService {
  constructor(
    @Inject(REFRESHTOKEN_REPOSITORY)
    private refreshTokenRepository: typeof RefreshToken,
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async signup(data: CreateUserDTO) {
    return await this.userService.create(data);
  }

  async validateUser(username: string, pass: string): Promise<UserDTO> {
    const user = await this.userService.findOneByUsername(username);
    const hash = sha256.create();
    hash.update(pass);
    if (user?.password === hash.hex()) {
      const userDTO = new UserDTO(user);
      return userDTO;
    }
    return null;
  }

  async login(user: UserDTO) {
    const token = await this.generateToken(user);
    return { token, user };
  }

  async findOneByRID(rid: string) {
    return await this.refreshTokenRepository.findOne({
      where: { id: rid },
    });
  }

  async reAccessToken(user: UserDTO) {
    const token = await this.generateToken(user);
    return { token, user };
  }

  async generateToken(user: UserDTO) {
    const payload = {
      id: user.id,
      username: user.username,
      showName: user.showName,
      role: user.role,
      rating: user.rating,
    };
    const jwtId = uuidv4();
    const accessToken = this.jwtService.sign(payload, {
      jwtid: jwtId,
    });

    const refreshToken = await this.generateRefreshToken(user, jwtId);
    return { accessToken, refreshToken };
  }

  async generateRefreshToken(user: UserDTO, jwtId: string): Promise<string> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);
    const refreshToken = new RefreshToken();
    refreshToken.id = uuidv4();
    refreshToken.userId = user.id;
    refreshToken.jwtId = jwtId;
    refreshToken.expiryDate = expiryDate;
    await refreshToken.save();
    return refreshToken.id;
  }

  async validateToken(refreshTokenId: string, jwtId: string) {
    const refreshToken = await this.findOneByRID(refreshTokenId);
    if (!this.isRefreshTokenLinkedToToken(refreshToken, jwtId)) {
      throw new ForbiddenException('Access token and refresh token mismatch.');
    }
    if (!this.isRefreshTokenExpired(refreshToken)) {
      throw new ForbiddenException('Refresh token expired.');
    }
    if (!this.isRefreshTokenUsed(refreshToken)) {
      throw new ForbiddenException('refresh token used.');
    }
    refreshToken.used = true;
    await refreshToken.save();
  }

  isRefreshTokenLinkedToToken(refreshToken: RefreshToken, jwtId: string) {
    if (!refreshToken) return false;
    if (refreshToken.jwtId != jwtId) return false;
    return true;
  }

  isRefreshTokenExpired(refreshToken: RefreshToken) {
    const now = new Date();
    if (!refreshToken) return false;
    if (refreshToken.expiryDate < now) return false;
    return true;
  }

  isRefreshTokenUsed(refreshToken: RefreshToken) {
    if (refreshToken.used) return false;
    return true;
  }
}
