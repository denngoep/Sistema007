import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { RolUsuario } from '../generated/prisma/enums';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  getUsers() {
    return this.usersRepository.findAll();
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto) {
    if (updateUserDto.correo) {
      const existingUser = await this.usersRepository.findByEmail(
        updateUserDto.correo,
      );

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('El correo ya se encuentra registrado');
      }
    }

    const data: {
      nombre?: string;
      correo?: string;
      password?: string;
      rol?: RolUsuario;
    } = {
      nombre: updateUserDto.nombre,
      correo: updateUserDto.correo,
      rol: updateUserDto.rol,
    };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const user = await this.usersRepository.update(id, data);

    return {
      message: 'Usuario actualizado correctamente',
      user,
    };
  }

  async updateUserStatus(id: number, updateUserStatusDto: UpdateUserStatusDto) {
    const user = await this.usersRepository.updateStatus(
      id,
      updateUserStatusDto.activo,
    );

    return {
      message: updateUserStatusDto.activo
        ? 'Usuario activado correctamente'
        : 'Usuario desactivado correctamente',
      user,
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
      createUserDto.rol,
    );

    return {
      message: 'Usuario registrado correctamente',
      user,
    };
  }
}
