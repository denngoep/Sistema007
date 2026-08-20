import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  getUsers() {
    return {
      message: 'Módulo de usuarios de Sistema007 funcionando correctamente',
    };
  }

  async createUser(createUserDto: CreateUserDto) {
    const existingUser = await this.usersRepository.findByEmail(
      createUserDto.correo,
    );

    if (existingUser) {
      throw new ConflictException('El correo ya se encuentra registrado');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.usersRepository.create(
      createUserDto.nombre,
      createUserDto.correo,
      hashedPassword,
    );

    return {
      message: 'Usuario registrado correctamente',
      user,
    };
  }
}
