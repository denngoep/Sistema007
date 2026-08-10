import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  getUsers() {
    return {
      message: 'Módulo de usuarios de Sistema007 funcionando correctamente',
    };
  }
}
